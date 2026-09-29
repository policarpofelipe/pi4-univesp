import csv
import io
import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from dependencias import exigir_origem, obter_usuario_atual, sessao_db
from modelos import Atendimento

router = APIRouter(
    prefix="/api/fonte",
    tags=["fonte"],
    dependencies=[Depends(exigir_origem), Depends(obter_usuario_atual)],
)

COLUNAS = (
    "protocolo",
    "id_ticket",
    "origem",
    "contact_id",
    "conexao",
    "user_id",
    "criado",
    "iniciado",
    "fim",
    "tempo_espera_segundos",
    "tempo_atendimento_segundos",
    "setores",
    "setores_transfers",
    "rating",
    "tags",
)

_FORMATOS_DATA = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
)
_MAX_BYTES = 2_000_000
_MAX_LINHAS = 10_000
_MAX_ERROS = 30
_MAX_LISTA = 20
_UINT = 4_294_967_295


def _data_iso(valor):
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date().isoformat()
    return str(valor)[:10]


def _grupos(sessao, coluna):
    linhas = (
        sessao.query(coluna, func.count(Atendimento.id))
        .filter(coluna.is_not(None), coluna != "")
        .group_by(coluna)
        .order_by(func.count(Atendimento.id).desc(), coluna)
        .all()
    )
    return [{"nome": nome, "volume": int(volume)} for nome, volume in linhas]


@router.get("")
def retrato_fonte(sessao: Session = Depends(sessao_db)):
    total, minimo, maximo, com_rating = sessao.query(
        func.count(Atendimento.id),
        func.min(Atendimento.criado),
        func.max(Atendimento.criado),
        func.count(Atendimento.rating),
    ).one()
    total = int(total or 0)
    com_rating = int(com_rating or 0)
    sem_origem = sessao.query(func.count(Atendimento.id)).filter(
        or_(Atendimento.origem.is_(None), Atendimento.origem == "")
    ).scalar()
    return {
        "total": total,
        "de": _data_iso(minimo),
        "ate": _data_iso(maximo),
        "com_rating": com_rating,
        "sem_rating": total - com_rating,
        "sem_origem": int(sem_origem or 0),
        "origens": _grupos(sessao, Atendimento.origem),
        "conexoes": _grupos(sessao, Atendimento.conexao),
        "setores": _grupos(sessao, Atendimento.setores),
        "operadores": _grupos(sessao, Atendimento.user_id),
        "colunas": list(COLUNAS),
    }


def _separador(primeira_linha):
    if primeira_linha.count(";") > primeira_linha.count(","):
        return ";"
    return ","


def _ler_csv(conteudo):
    if len(conteudo) > _MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="O arquivo passa de 2 MB.",
        )
    try:
        texto = conteudo.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="O arquivo precisa estar em UTF-8.",
        )
    if not texto.strip():
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")
    primeira = texto.splitlines()[0]
    leitor = csv.reader(io.StringIO(texto), delimiter=_separador(primeira))
    try:
        linhas = list(leitor)
    except csv.Error:
        raise HTTPException(status_code=400, detail="Não foi possível ler o CSV.")
    if not linhas:
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")
    cabecalho = [coluna.strip() for coluna in linhas[0]]
    if any(not coluna for coluna in cabecalho) or len(cabecalho) != len(set(cabecalho)):
        raise HTTPException(
            status_code=400,
            detail="O cabeçalho precisa ter cada coluna uma vez, sem nome vazio.",
        )
    recebidas = set(cabecalho)
    esperadas = set(COLUNAS)
    if recebidas != esperadas:
        faltam = sorted(esperadas - recebidas)
        sobram = sorted(recebidas - esperadas)
        partes = []
        if faltam:
            partes.append("Faltam: " + ", ".join(faltam) + ".")
        if sobram:
            partes.append("Fora do formato: " + ", ".join(sobram) + ".")
        raise HTTPException(status_code=400, detail=" ".join(partes))
    dados = linhas[1:]
    if len(dados) > _MAX_LINHAS:
        raise HTTPException(
            status_code=400,
            detail=f"O arquivo passa de {_MAX_LINHAS} linhas.",
        )
    return cabecalho, dados


def _texto(valor, nome, limite, obrigatorio):
    bruto = (valor or "").strip()
    if not bruto:
        if obrigatorio:
            return None, f"{nome} é obrigatório."
        return None, None
    if len(bruto) > limite:
        return None, f"{nome} passa de {limite} caracteres."
    return bruto, None


def _inteiro(valor, nome, minimo, maximo, obrigatorio):
    bruto = (valor or "").strip()
    if not bruto:
        if obrigatorio:
            return None, f"{nome} é obrigatório."
        return None, None
    if not re.fullmatch(r"\d+", bruto):
        return None, f"{nome} deve ser um inteiro."
    numero = int(bruto)
    if numero < minimo or numero > maximo:
        return None, f"{nome} está fora do intervalo."
    return numero, None


def _datahora(valor, nome):
    bruto = (valor or "").strip()
    if not bruto:
        return None, f"{nome} é obrigatório."
    if bruto.endswith("Z") or "+" in bruto[10:]:
        return None, f"{nome} deve ser data e hora sem fuso."
    for formato in _FORMATOS_DATA:
        try:
            return datetime.strptime(bruto, formato), None
        except ValueError:
            continue
    return None, f"{nome} deve estar como AAAA-MM-DD HH:MM:SS."


def _montar_linha(mapa):
    protocolo, erro = _inteiro(mapa["protocolo"], "protocolo", 1, _UINT, True)
    if erro:
        return None, erro
    id_ticket, erro = _inteiro(mapa["id_ticket"], "id_ticket", 0, 65535, False)
    if erro:
        return None, erro
    origem, erro = _texto(mapa["origem"], "origem", 10, False)
    if erro:
        return None, erro
    contact_id, erro = _texto(mapa["contact_id"], "contact_id", 20, False)
    if erro:
        return None, erro
    conexao, erro = _texto(mapa["conexao"], "conexao", 10, True)
    if erro:
        return None, erro
    user_id, erro = _texto(mapa["user_id"], "user_id", 20, True)
    if erro:
        return None, erro
    criado, erro = _datahora(mapa["criado"], "criado")
    if erro:
        return None, erro
    iniciado, erro = _datahora(mapa["iniciado"], "iniciado")
    if erro:
        return None, erro
    fim, erro = _datahora(mapa["fim"], "fim")
    if erro:
        return None, erro
    if iniciado < criado or fim < iniciado:
        return None, "A ordem precisa ser criado, depois iniciado, depois fim."
    espera, erro = _inteiro(
        mapa["tempo_espera_segundos"], "tempo_espera_segundos", 0, _UINT, True
    )
    if erro:
        return None, erro
    atendimento, erro = _inteiro(
        mapa["tempo_atendimento_segundos"],
        "tempo_atendimento_segundos",
        0,
        _UINT,
        True,
    )
    if erro:
        return None, erro
    setores, erro = _texto(mapa["setores"], "setores", 20, True)
    if erro:
        return None, erro
    transfers, erro = _texto(mapa["setores_transfers"], "setores_transfers", 100, False)
    if erro:
        return None, erro
    rating, erro = _inteiro(mapa["rating"], "rating", 1, 5, False)
    if erro:
        return None, erro
    tags, erro = _texto(mapa["tags"], "tags", 50, False)
    if erro:
        return None, erro
    return (
        Atendimento(
            protocolo=protocolo,
            id_ticket=id_ticket,
            origem=origem,
            contact_id=contact_id,
            conexao=conexao,
            user_id=user_id,
            criado=criado,
            iniciado=iniciado,
            fim=fim,
            tempo_espera_segundos=espera,
            tempo_atendimento_segundos=atendimento,
            setores=setores,
            setores_transfers=transfers,
            rating=rating,
            tags=tags,
        ),
        None,
    )


@router.post("/importar")
def importar_fonte(
    arquivo: UploadFile = File(),
    sessao: Session = Depends(sessao_db),
):
    conteudo = arquivo.file.read(_MAX_BYTES + 1)
    cabecalho, dados = _ler_csv(conteudo)
    novos = []
    erros = []
    duplicados = []
    vistos = set()
    protocolos = []
    mapas = []
    for numero, celulas in enumerate(dados, start=2):
        if not any(celula.strip() for celula in celulas):
            continue
        if len(celulas) != len(cabecalho):
            erros.append(
                {"linha": numero, "motivo": "A linha não tem o número de colunas do cabeçalho."}
            )
            continue
        mapa = {
            cabecalho[indice]: celulas[indice].strip()
            for indice in range(len(cabecalho))
        }
        item, erro = _montar_linha(mapa)
        if erro:
            erros.append({"linha": numero, "motivo": erro})
            continue
        if item.protocolo in vistos:
            duplicados.append(item.protocolo)
            continue
        vistos.add(item.protocolo)
        protocolos.append(item.protocolo)
        mapas.append(item)

    existentes = set()
    if protocolos:
        linhas = (
            sessao.query(Atendimento.protocolo)
            .filter(Atendimento.protocolo.in_(protocolos))
            .all()
        )
        existentes = {linha[0] for linha in linhas}
    for item in mapas:
        if item.protocolo in existentes:
            duplicados.append(item.protocolo)
            continue
        novos.append(item)

    if novos:
        try:
            sessao.add_all(novos)
            sessao.commit()
        except IntegrityError:
            sessao.rollback()
            raise HTTPException(
                status_code=409,
                detail="Não foi possível gravar a carga. Tente de novo.",
            )

    return {
        "inseridos": len(novos),
        "duplicados": len(duplicados),
        "invalidos": len(erros),
        "protocolos_duplicados": duplicados[:_MAX_LISTA],
        "erros": erros[:_MAX_ERROS],
        "erros_omitidos": max(0, len(erros) - _MAX_ERROS),
    }
