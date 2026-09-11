import hashlib
import secrets

from pwdlib import PasswordHash

import config

_hasher = PasswordHash.recommended()
_hash_dummy = _hasher.hash("nao-e-uma-senha-real")


def normalizar_email(email):
    return email.strip().lower()


def gerar_token():
    return secrets.token_urlsafe(32)


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_senha(senha):
    return _hasher.hash(senha)


def senha_valida(senha):
    if senha is None:
        return False
    tamanho = len(senha)
    return config.SENHA_MINIMO <= tamanho <= config.SENHA_MAXIMO


def verificar_senha(senha, senha_hash):
    try:
        return _hasher.verify(senha, senha_hash)
    except Exception:
        return False


def verificar_senha_dummy(senha):
    verificar_senha(senha, _hash_dummy)
