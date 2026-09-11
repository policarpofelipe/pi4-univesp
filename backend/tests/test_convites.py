from datetime import timedelta
from unittest.mock import patch

from datas import agora_utc
from email_smtp import FalhaEnvioEmail
from modelos import ConviteUsuario, Usuario
from rotas_convites import status_convite
from seguranca import gerar_token, hash_token
from tests.helpers import cabecalho_origem


def _entrar(cliente, email, senha):
    return cliente.post(
        "/api/autenticacao/entrar",
        json={"email": email, "senha": senha},
        headers=cabecalho_origem(),
    )


def test_usuario_comum_nao_cria_convite(cliente, usuario_comum):
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    resposta = cliente.post(
        "/api/convites",
        json={"nome": "Ana", "email": "ana@example.com"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 403


def test_mestre_cria_convite(cliente, mestre):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite") as envio:
        resposta = cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "Ana@Example.com"},
            headers=cabecalho_origem(),
        )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert "token" not in corpo
    assert "token_hash" not in corpo
    assert corpo["email"] == "ana@example.com"
    assert corpo["status"] == "enviado"
    envio.assert_called_once()
    link = envio.call_args[0][2]
    assert "#token=" in link


def test_email_existente_rejeitado(cliente, mestre, usuario_comum):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite"):
        resposta = cliente.post(
            "/api/convites",
            json={"nome": usuario_comum.nome, "email": usuario_comum.email},
            headers=cabecalho_origem(),
        )
    assert resposta.status_code == 409


def test_smtp_falha_mantem_convite(cliente, mestre, sessao):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite", side_effect=FalhaEnvioEmail("falha")):
        resposta = cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "ana@example.com"},
            headers=cabecalho_origem(),
        )
    assert resposta.status_code == 502
    sessao.expire_all()
    convite = sessao.query(ConviteUsuario).one()
    assert convite.erro_envio_em is not None
    assert convite.email_enviado_em is None
    assert convite.utilizado_em is None
    assert status_convite(convite, agora_utc()) == "falha de envio"


def test_token_expirado_rejeitado(sessao, mestre):
    agora = agora_utc()
    token = gerar_token()
    convite = ConviteUsuario(
        nome="Ana",
        email="ana@example.com",
        token_hash=hash_token(token),
        criado_por_usuario_id=mestre.id,
        criado_em=agora - timedelta(hours=30),
        expira_em=agora - timedelta(hours=1),
    )
    sessao.add(convite)
    sessao.commit()
    assert status_convite(convite, agora) == "expirado"


def test_aceite_cria_usuario_uma_vez(cliente, mestre, sessao):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite") as envio:
        cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "ana@example.com"},
            headers=cabecalho_origem(),
        )
    token = envio.call_args[0][2].split("#token=", 1)[1]
    resposta = cliente.post(
        "/api/convites/aceitar",
        json={
            "token": token,
            "senha": "senha-definitiva",
            "confirmacao_senha": "senha-definitiva",
        },
    )
    assert resposta.status_code == 200
    sessao.expire_all()
    assert sessao.query(Usuario).filter(Usuario.email == "ana@example.com").count() == 1

    repetido = cliente.post(
        "/api/convites/aceitar",
        json={
            "token": token,
            "senha": "senha-definitiva",
            "confirmacao_senha": "senha-definitiva",
        },
    )
    assert repetido.status_code == 400
    sessao.expire_all()
    convite = sessao.query(ConviteUsuario).one()
    assert convite.utilizado_em is not None


def test_token_nao_aparece_na_listagem(cliente, mestre):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite"):
        cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "ana@example.com"},
            headers=cabecalho_origem(),
        )
    lista = cliente.get("/api/convites", headers=cabecalho_origem())
    assert lista.status_code == 200
    assert lista.json()[0]["status"] == "enviado"
    texto = lista.text
    assert "token_hash" not in texto
    assert "#token=" not in texto


def test_validar_token_invalido(cliente):
    resposta = cliente.post(
        "/api/convites/validar",
        json={"token": "token-inexistente"},
    )
    assert resposta.status_code == 200
    assert resposta.json()["valido"] is False
    assert resposta.json()["motivo"] == "invalido"


def test_aceite_token_invalido(cliente):
    resposta = cliente.post(
        "/api/convites/aceitar",
        json={
            "token": "token-inexistente",
            "senha": "senha-definitiva",
            "confirmacao_senha": "senha-definitiva",
        },
    )
    assert resposta.status_code == 400
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    with patch("rotas_convites.enviar_convite"):
        primeiro = cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "ana@example.com"},
            headers=cabecalho_origem(),
        )
        segundo = cliente.post(
            "/api/convites",
            json={"nome": "Ana Teste", "email": "ana@example.com"},
            headers=cabecalho_origem(),
        )
    assert primeiro.status_code == 200
    assert segundo.status_code == 409


def test_validar_token_invalido(cliente):
    resposta = cliente.post(
        "/api/convites/validar",
        json={"token": "token-inexistente"},
    )
    assert resposta.status_code == 200
    assert resposta.json()["valido"] is False
    assert resposta.json()["motivo"] == "invalido"


def test_aceite_token_invalido(cliente):
    resposta = cliente.post(
        "/api/convites/aceitar",
        json={
            "token": "token-inexistente",
            "senha": "senha-definitiva",
            "confirmacao_senha": "senha-definitiva",
        },
    )
    assert resposta.status_code == 400
