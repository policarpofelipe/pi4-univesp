import os
from urllib.parse import quote_plus

from dotenv import load_dotenv

load_dotenv()


def _bool(valor, padrao=False):
    if valor is None:
        return padrao
    return valor.strip().lower() in {"1", "true", "sim", "yes", "on"}


def _int(nome, padrao):
    bruto = os.getenv(nome)
    if bruto is None or bruto.strip() == "":
        return padrao
    return int(bruto)


DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "flivocom_pi4")
DB_USER = os.getenv("DB_USER", "flivocom_pi4app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

DATABASE_URL = os.getenv("DATABASE_URL") or (
    f"mysql+pymysql://{DB_USER}:{quote_plus(DB_PASSWORD)}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

APP_URL = os.getenv("APP_URL", "https://pi4.flivo.com.br").rstrip("/")
CONVITE_EXPIRACAO_HORAS = _int("CONVITE_EXPIRACAO_HORAS", 24)
SESSAO_DURACAO_HORAS = _int("SESSAO_DURACAO_HORAS", 8)
COOKIE_SECURE = _bool(os.getenv("COOKIE_SECURE"), True)
COOKIE_NOME = "pi4_sessao"

LOGIN_TENTATIVAS_MAX = _int("LOGIN_TENTATIVAS_MAX", 5)
LOGIN_BLOQUEIO_MINUTOS = _int("LOGIN_BLOQUEIO_MINUTOS", 15)

SENHA_MINIMO = 12
SENHA_MAXIMO = 128

SMTP_HOST = os.getenv("SMTP_HOST", "pi4.flivo.com.br")
SMTP_PORT = _int("SMTP_PORT", 465)
SMTP_USER = os.getenv("SMTP_USER", "info@pi4.flivo.com.br")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "info@pi4.flivo.com.br")
SMTP_USE_SSL = _bool(os.getenv("SMTP_USE_SSL"), True)

NOME_MESTRE_PADRAO = "FELIPE MARTINS POLICARPO"
