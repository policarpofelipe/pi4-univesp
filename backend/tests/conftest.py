"""SQLite em memória NÃO valida o schema MariaDB.

A primeira migration Alembic deve ser aplicada e conferida no MariaDB
real (flivocom_pi4) como gate manual, após a rotação ADR-012, antes do deploy.
"""

import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["COOKIE_SECURE"] = "false"
os.environ["APP_URL"] = "https://pi4.flivo.com.br"
os.environ["SMTP_PASSWORD"] = "teste"
os.environ["SMTP_HOST"] = "localhost"
os.environ["SMTP_PORT"] = "465"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import app
from banco import obter_sessao
from datas import agora_utc
from modelos import Base, Usuario
from seguranca import hash_senha

ORIGEM = "http://localhost:5173"


def pytest_report_header():
    return (
        "AVISO: testes usam SQLite em memória e não validam o schema MariaDB."
    )


@pytest.fixture
def engine_teste():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def sessao(engine_teste):
    Fabrica = sessionmaker(bind=engine_teste, autoflush=False, autocommit=False)
    db = Fabrica()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def cliente(sessao):
    def override():
        yield sessao

    app.dependency_overrides[obter_sessao] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def mestre(sessao):
    agora = agora_utc()
    usuario = Usuario(
        nome="FELIPE MARTINS POLICARPO",
        email="mestre@pi4.flivo.com.br",
        senha_hash=hash_senha("senha-mestre-ok"),
        perfil="mestre",
        ativo=True,
        email_verificado_em=agora,
        tentativas_login_falhas=0,
        criado_em=agora,
        atualizado_em=agora,
    )
    sessao.add(usuario)
    sessao.commit()
    sessao.refresh(usuario)
    return usuario


@pytest.fixture
def usuario_comum(sessao):
    agora = agora_utc()
    usuario = Usuario(
        nome="Pessoa Convidada",
        email="pessoa@example.com",
        senha_hash=hash_senha("senha-usuario-ok"),
        perfil="usuario",
        ativo=True,
        email_verificado_em=agora,
        tentativas_login_falhas=0,
        criado_em=agora,
        atualizado_em=agora,
    )
    sessao.add(usuario)
    sessao.commit()
    sessao.refresh(usuario)
    return usuario


def cabecalho_origem():
    return {"Origin": ORIGEM, "Content-Type": "application/json"}
