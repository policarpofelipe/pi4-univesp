from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import config
from banco import obter_sessao
from datas import agora_utc
from modelos import SessaoUsuario, Usuario
from seguranca import hash_token


def sessao_db(sessao: Session = Depends(obter_sessao)):
    return sessao


def origem_permitida(origin):
    if not origin:
        return False
    permitidas = {config.APP_URL}
    if not config.COOKIE_SECURE:
        permitidas.update(
            {
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            }
        )
    return origin.rstrip("/") in permitidas


def exigir_origem(request: Request):
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if not origem_permitida(origin):
        raise HTTPException(status_code=403, detail="Origem não permitida.")


def obter_usuario_atual(
    request: Request,
    sessao: Session = Depends(sessao_db),
    pi4_sessao: str | None = Cookie(default=None, alias=config.COOKIE_NOME),
):
    if not pi4_sessao:
        raise HTTPException(status_code=401, detail="Não autenticado.")

    agora = agora_utc()
    registro = (
        sessao.query(SessaoUsuario)
        .filter(SessaoUsuario.token_hash == hash_token(pi4_sessao))
        .first()
    )
    if registro is None:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    if registro.revogada_em is not None:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    if registro.expira_em <= agora:
        raise HTTPException(status_code=401, detail="Não autenticado.")

    usuario = sessao.get(Usuario, registro.usuario_id)
    if usuario is None or not usuario.ativo:
        raise HTTPException(status_code=401, detail="Não autenticado.")

    registro.ultimo_acesso_em = agora
    sessao.add(registro)
    sessao.commit()
    return usuario


def exigir_usuario_mestre(usuario: Usuario = Depends(obter_usuario_atual)):
    if usuario.perfil != "mestre":
        raise HTTPException(status_code=403, detail="Acesso restrito.")
    return usuario


def aplicar_cookie_sessao(resposta, token):
    resposta.set_cookie(
        key=config.COOKIE_NOME,
        value=token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        path="/",
        max_age=int(timedelta(hours=config.SESSAO_DURACAO_HORAS).total_seconds()),
    )


def remover_cookie_sessao(resposta):
    resposta.delete_cookie(
        key=config.COOKIE_NOME,
        path="/",
        secure=config.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )
