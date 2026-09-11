from seguranca import (
    gerar_token,
    hash_senha,
    hash_token,
    senha_valida,
    verificar_senha,
)


def test_hash_senha_nao_guarda_texto():
    senha = "uma-senha-longa"
    digest = hash_senha(senha)
    assert senha not in digest
    assert verificar_senha(senha, digest)
    assert not verificar_senha("outra-senha-longa", digest)


def test_token_hash_nao_e_reversivel():
    token = gerar_token()
    digest = hash_token(token)
    assert token not in digest
    assert len(digest) == 64
    assert hash_token(token) == digest


def test_politica_senha():
    assert not senha_valida("curta")
    assert senha_valida("doze-chars!!")
    assert not senha_valida("x" * 129)
