from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import config
from datas import agora_utc
from dependencias import (
    aplicar_cookie_sessao,
    exigir_origem,
    obter_usuario_atual,
    remover_cookie_sessao,
    sessao_db,
)
from modelos import SessaoUsuario, Usuario
from seguranca import (
    gerar_token,
    hash_token,
    normalizar_email,
    verificar_senha,
    verificar_senha_dummy,
)

router = APIRouter(
    prefix="/api/autenticacao",
    tags=["autenticacao"],
    dependencies=[Depends(exigir_origem)],
)


class DadosEntrada(BaseModel):
    email: EmailStr
    senha: str


def _publico(usuario: Usuario):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "perfil": usuario.perfil,
    }


@router.post("/entrar")
def entrar(dados: DadosEntrada, resposta: Response, sessao: Session = Depends(sessao_db)):
    email = normalizar_email(str(dados.email))
    agora = agora_utc()
    usuario = sessao.query(Usuario).filter(Usuario.email == email).first()

    if usuario is None:
        verificar_senha_dummy(dados.senha)
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    if usuario.bloqueado_ate and usuario.bloqueado_ate > agora:
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    if not usuario.ativo or not verificar_senha(dados.senha, usuario.senha_hash):
        usuario.tentativas_login_falhas += 1
        if usuario.tentativas_login_falhas >= config.LOGIN_TENTATIVAS_MAX:
            usuario.bloqueado_ate = agora + timedelta(
                minutes=config.LOGIN_BLOQUEIO_MINUTOS
            )
        usuario.atualizado_em = agora
        sessao.add(usuario)
        sessao.commit()
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    usuario.tentativas_login_falhas = 0
    usuario.bloqueado_ate = None
    usuario.ultimo_login_em = agora
    usuario.atualizado_em = agora

    token = gerar_token()
    registro = SessaoUsuario(
        usuario_id=usuario.id,
        token_hash=hash_token(token),
        criado_em=agora,
        expira_em=agora + timedelta(hours=config.SESSAO_DURACAO_HORAS),
        ultimo_acesso_em=agora,
        revogada_em=None,
    )
    sessao.add(usuario)
    sessao.add(registro)
    sessao.commit()

    aplicar_cookie_sessao(resposta, token)
    return _publico(usuario)


@router.get("/usuario-atual")
def usuario_atual(usuario: Usuario = Depends(obter_usuario_atual)):
    return _publico(usuario)


@router.post("/sair")
def sair(
    request: Request,
    resposta: Response,
    sessao: Session = Depends(sessao_db),
    usuario: Usuario = Depends(obter_usuario_atual),
):
    token = request.cookies.get(config.COOKIE_NOME)
    if token:
        registro = (
            sessao.query(SessaoUsuario)
            .filter(SessaoUsuario.token_hash == hash_token(token))
            .first()
        )
        if registro and registro.revogada_em is None:
            registro.revogada_em = agora_utc()
            sessao.add(registro)
            sessao.commit()
    remover_cookie_sessao(resposta)
    return {"status": "ok"}
