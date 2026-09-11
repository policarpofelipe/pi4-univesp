from datetime import timedelta

from datas import agora_utc
from modelos import SessaoUsuario
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
