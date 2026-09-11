from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

import config
from datas import agora_utc
from dependencias import exigir_origem, exigir_usuario_mestre, sessao_db
from email_smtp import FalhaEnvioEmail, enviar_convite
from modelos import ConviteUsuario, Usuario
from seguranca import (
    gerar_token,
    hash_senha,
    hash_token,
    normalizar_email,
    senha_valida,
)

router = APIRouter(prefix="/api/convites", tags=["convites"])


class DadosConvite(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    email: EmailStr


class DadosToken(BaseModel):
    token: str


class DadosAceite(BaseModel):
    token: str
    senha: str
    confirmacao_senha: str


def status_convite(convite, agora):
    if convite.cancelado_em:
        return "cancelado"
    if convite.utilizado_em:
        return "utilizado"
    if convite.expira_em <= agora:
        return "expirado"
    return "pendente"


def _convite_pendente(convite, agora):
    return status_convite(convite, agora) == "pendente"


@router.post("", dependencies=[Depends(exigir_origem)])
def criar_convite(
    dados: DadosConvite,
    sessao: Session = Depends(sessao_db),
    mestre: Usuario = Depends(exigir_usuario_mestre),
):
    agora = agora_utc()
    email = normalizar_email(str(dados.email))
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome.")

    existente = sessao.query(Usuario).filter(Usuario.email == email).first()
    if existente and existente.ativo:
        raise HTTPException(
            status_code=409,
            detail="Já existe um usuário ativo com este e-mail.",
        )

    pendentes = (
        sessao.query(ConviteUsuario)
        .filter(ConviteUsuario.email == email)
        .all()
    )
    if any(_convite_pendente(item, agora) for item in pendentes):
        raise HTTPException(
            status_code=409,
            detail="Já existe um convite pendente para este e-mail.",
        )

    token = gerar_token()
    convite = ConviteUsuario(
        nome=nome,
        email=email,
        token_hash=hash_token(token),
        criado_por_usuario_id=mestre.id,
        criado_em=agora,
        expira_em=agora + timedelta(hours=config.CONVITE_EXPIRACAO_HORAS),
    )
    sessao.add(convite)
    sessao.commit()
    sessao.refresh(convite)

    link = f"{config.APP_URL}/convite.html#token={token}"
    try:
        enviar_convite(nome, email, link, config.CONVITE_EXPIRACAO_HORAS)
        convite.email_enviado_em = agora_utc()
        convite.erro_envio_em = None
        sessao.add(convite)
        sessao.commit()
    except FalhaEnvioEmail:
        convite.erro_envio_em = agora_utc()
        sessao.add(convite)
        sessao.commit()
        raise HTTPException(
            status_code=502,
            detail="Convite criado, mas o e-mail não foi enviado.",
        )

    return {
        "id": convite.id,
        "nome": convite.nome,
        "email": convite.email,
        "criado_em": convite.criado_em.isoformat() + "Z",
        "expira_em": convite.expira_em.isoformat() + "Z",
        "status": "pendente",
        "email_enviado": True,
    }


@router.get("", dependencies=[Depends(exigir_origem)])
def listar_convites(
    sessao: Session = Depends(sessao_db),
    mestre: Usuario = Depends(exigir_usuario_mestre),
):
    agora = agora_utc()
    itens = (
        sessao.query(ConviteUsuario)
        .order_by(ConviteUsuario.criado_em.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": item.id,
            "nome": item.nome,
            "email": item.email,
            "criado_em": item.criado_em.isoformat() + "Z",
            "expira_em": item.expira_em.isoformat() + "Z",
            "status": status_convite(item, agora),
            "email_enviado": item.email_enviado_em is not None,
            "erro_envio": item.erro_envio_em is not None
            and item.email_enviado_em is None,
        }
        for item in itens
    ]


@router.post("/validar")
def validar_convite(dados: DadosToken, sessao: Session = Depends(sessao_db)):
    agora = agora_utc()
    convite = (
        sessao.query(ConviteUsuario)
        .filter(ConviteUsuario.token_hash == hash_token(dados.token))
        .first()
    )
    if convite is None or not _convite_pendente(convite, agora):
        return {"valido": False}

    return {
        "valido": True,
        "nome": convite.nome,
        "email": convite.email,
        "expira_em": convite.expira_em.isoformat() + "Z",
    }


@router.post("/aceitar")
def aceitar_convite(dados: DadosAceite, sessao: Session = Depends(sessao_db)):
    if dados.senha != dados.confirmacao_senha:
        raise HTTPException(status_code=400, detail="As senhas não coincidem.")
    if not senha_valida(dados.senha):
        raise HTTPException(
            status_code=400,
            detail=f"A senha deve ter entre {config.SENHA_MINIMO} e {config.SENHA_MAXIMO} caracteres.",
        )

    agora = agora_utc()
    convite = (
        sessao.query(ConviteUsuario)
        .filter(ConviteUsuario.token_hash == hash_token(dados.token))
        .first()
    )
    if convite is None or not _convite_pendente(convite, agora):
        raise HTTPException(status_code=400, detail="Convite inválido ou expirado.")

    if sessao.query(Usuario).filter(Usuario.email == convite.email).first():
        raise HTTPException(status_code=409, detail="Este e-mail já possui conta.")

    try:
        usuario = Usuario(
            nome=convite.nome,
            email=convite.email,
            senha_hash=hash_senha(dados.senha),
            perfil="usuario",
            ativo=True,
            email_verificado_em=agora,
            tentativas_login_falhas=0,
            criado_em=agora,
            atualizado_em=agora,
        )
        sessao.add(usuario)
        sessao.flush()
        convite.utilizado_em = agora
        convite.usuario_criado_id = usuario.id
        sessao.add(convite)
        sessao.commit()
    except Exception:
        sessao.rollback()
        raise HTTPException(status_code=500, detail="Não foi possível concluir o convite.")

    return {"status": "ok"}
