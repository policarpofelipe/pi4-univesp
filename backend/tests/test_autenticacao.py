from datetime import timedelta
from unittest.mock import patch

from datas import agora_utc
from modelos import SessaoUsuario, Usuario
from tests.helpers import cabecalho_origem


def test_login_correto(cliente, mestre):
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert "senha_hash" not in corpo
    assert corpo["perfil"] == "mestre"
    assert "pi4_sessao" in resposta.cookies


def test_login_incorreto_generico(cliente, mestre):
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-errada-12"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "E-mail ou senha inválidos."


def test_login_email_inexistente_generico(cliente):
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": "naoexiste@example.com", "senha": "senha-errada-12"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "E-mail ou senha inválidos."


def test_bloqueio_apos_tentativas(cliente, mestre):
    for _ in range(5):
        cliente.post(
            "/api/autenticacao/entrar",
            json={"email": mestre.email, "senha": "senha-errada-12"},
            headers=cabecalho_origem(),
        )
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 401


def test_rota_protegida_sem_sessao(cliente):
    resposta = cliente.get("/api/autenticacao/usuario-atual")
    assert resposta.status_code == 401


def test_logout_revoga_sessao(cliente, mestre):
    cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    saida = cliente.post("/api/autenticacao/sair", headers=cabecalho_origem())
    assert saida.status_code == 200
    atual = cliente.get("/api/autenticacao/usuario-atual")
    assert atual.status_code == 401


def test_sessao_expirada_rejeitada(cliente, mestre, sessao):
    cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    sessao.expire_all()
    registro = sessao.query(SessaoUsuario).one()
    registro.expira_em = agora_utc() - timedelta(minutes=1)
    sessao.add(registro)
    sessao.commit()
    atual = cliente.get("/api/autenticacao/usuario-atual")
    assert atual.status_code == 401


def test_status_preservado(cliente):
    resposta = cliente.get("/api/status")
    assert resposta.status_code == 200
    assert resposta.json()["backend"] == "FastAPI"


def test_dummy_hash_se_email_inexistente(cliente):
    with patch("rotas_autenticacao.verificar_senha_dummy") as dummy:
        resposta = cliente.post(
            "/api/autenticacao/entrar",
            json={"email": "naoexiste@example.com", "senha": "senha-errada-12"},
            headers=cabecalho_origem(),
        )
    assert resposta.status_code == 401
    dummy.assert_called_once()


def test_login_correto_limpa_bloqueio(cliente, mestre, sessao):
    for _ in range(3):
        cliente.post(
            "/api/autenticacao/entrar",
            json={"email": mestre.email, "senha": "senha-errada-12"},
            headers=cabecalho_origem(),
        )
    ok = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    assert ok.status_code == 200
    sessao.expire_all()
    usuario = sessao.query(Usuario).filter(Usuario.email == mestre.email).one()
    assert usuario.tentativas_login_falhas == 0
    assert usuario.bloqueado_ate is None
    assert usuario.ultimo_login_em is not None


def test_sessao_revogada_rejeitada(cliente, mestre, sessao):
    cliente.post(
        "/api/autenticacao/entrar",
        json={"email": mestre.email, "senha": "senha-mestre-ok"},
        headers=cabecalho_origem(),
    )
    sessao.expire_all()
    registro = sessao.query(SessaoUsuario).one()
    registro.revogada_em = agora_utc()
    sessao.add(registro)
    sessao.commit()
    atual = cliente.get("/api/autenticacao/usuario-atual")
    assert atual.status_code == 401


def test_usuario_inativo_rejeitado(cliente, usuario_comum, sessao):
    usuario_comum.ativo = False
    sessao.add(usuario_comum)
    sessao.commit()
    resposta = cliente.post(
        "/api/autenticacao/entrar",
        json={"email": usuario_comum.email, "senha": "senha-usuario-ok"},
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "E-mail ou senha inválidos."
