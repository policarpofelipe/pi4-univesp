from datetime import date, datetime, timedelta
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from dependencias import exigir_origem, obter_usuario_atual, sessao_db
from modelos import Atendimento
from previsao_demanda import gravar_previsao

router = APIRouter(
    prefix="/api/analise",
    tags=["analise"],
    dependencies=[Depends(exigir_origem), Depends(obter_usuario_atual)],
)

_ROTULOS_DIA = (
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
)
_AVALIACOES = ("com", "sem", "1", "2", "3", "4", "5")
_LIMITE_CONTATOS = 15
_ARTEFATO = Path(__file__).resolve().parents[1] / "models" / "previsao_demanda.json"


def _texto(valor):
    if valor is None:
        return None
    limpo = str(valor).strip()
    return limpo or None


def _data(valor, nome):
    texto = _texto(valor)
    if texto is None:
        return None
    try:
        return date.fromisoformat(texto)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"{nome} inválida. Use AAAA-MM-DD.",
        )


def _inteiro(valor):
    if valor is None:
        return None
    return int(round(float(valor)))


def _decimal(valor):
    if valor is None:
        return None
    return round(float(valor), 1)


def _data_iso(valor):
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date().isoformat()
    if isinstance(valor, date):
        return valor.isoformat()
    return str(valor)[:10]


def _dialeto(sessao):
    return sessao.get_bind().dialect.name


def _hora(coluna, dialeto):
    if dialeto == "sqlite":
        return cast(func.strftime("%H", coluna), Integer)
    return func.hour(coluna)


def _dia_semana(coluna, dialeto):
    # 0 = domingo … 6 = sábado, nos dois bancos.
    if dialeto == "sqlite":
        return cast(func.strftime("%w", coluna), Integer)
    return func.dayofweek(coluna) - 1


def _criterios(de, ate, origem, conexao, setores, user_id, rating):
    criterios = []
    if de is not None:
        criterios.append(func.date(Atendimento.criado) >= de.isoformat())
    if ate is not None:
        criterios.append(func.date(Atendimento.criado) <= ate.isoformat())
    if origem is not None:
        criterios.append(Atendimento.origem == origem)
    if conexao is not None:
        criterios.append(Atendimento.conexao == conexao)
    if setores is not None:
        criterios.append(Atendimento.setores == setores)
    if user_id is not None:
        criterios.append(Atendimento.user_id == user_id)
    if rating == "com":
        criterios.append(Atendimento.rating.is_not(None))
    elif rating == "sem":
        criterios.append(Atendimento.rating.is_(None))
    elif rating is not None:
        criterios.append(Atendimento.rating == int(rating))
    return criterios


def _consulta(sessao, criterios, extra=()):
    consulta = sessao.query(Atendimento)
    for criterio in (*criterios, *extra):
        consulta = consulta.filter(criterio)
    return consulta


def _bloco(consulta):
    volume, espera, atendimento = consulta.with_entities(
        func.count(Atendimento.id),
        func.avg(Atendimento.tempo_espera_segundos),
        func.avg(Atendimento.tempo_atendimento_segundos),
    ).one()
    return {
        "volume": int(volume or 0),
        "espera_media_segundos": _inteiro(espera),
        "atendimento_medio_segundos": _inteiro(atendimento),
    }


def _distintos(sessao, coluna):
    linhas = (
        sessao.query(coluna)
        .filter(coluna.is_not(None), coluna != "")
        .distinct()
        .order_by(coluna)
        .all()
    )
    return [linha[0] for linha in linhas]


def _preencher_dias(linhas):
    if not linhas:
        return []
    por_data = {str(dia)[:10]: int(volume) for dia, volume in linhas}
    inicio = date.fromisoformat(min(por_data))
    fim = date.fromisoformat(max(por_data))
    serie = []
    cursor = inicio
    while cursor <= fim:
        chave = cursor.isoformat()
        serie.append({"data": chave, "volume": por_data.get(chave, 0)})
        cursor += timedelta(days=1)
    return serie


def _ler_filtros(de, ate, origem, conexao, setores, user_id, rating):
    inicio = _data(de, "Data inicial")
    final = _data(ate, "Data final")
    if inicio and final and inicio > final:
        raise HTTPException(
            status_code=400,
            detail="A data inicial não pode ser posterior à data final.",
        )
    nota = _texto(rating)
    if nota is not None and nota not in _AVALIACOES:
        raise HTTPException(status_code=400, detail="Avaliação inválida.")
    return (
        inicio,
        final,
        _texto(origem),
        _texto(conexao),
        _texto(setores),
        _texto(user_id),
        nota,
    )


@router.get("/meta")
def meta_analise(sessao: Session = Depends(sessao_db)):
    minimo, maximo = sessao.query(
        func.min(Atendimento.criado),
        func.max(Atendimento.criado),
    ).one()
    return {
        "de": _data_iso(minimo),
        "ate": _data_iso(maximo),
        "origens": _distintos(sessao, Atendimento.origem),
        "conexoes": _distintos(sessao, Atendimento.conexao),
        "setores": _distintos(sessao, Atendimento.setores),
        "operadores": _distintos(sessao, Atendimento.user_id),
    }


@router.get("/resumo")
def resumo_analise(
    de: str | None = Query(default=None, max_length=10),
    ate: str | None = Query(default=None, max_length=10),
    origem: str | None = Query(default=None, max_length=10),
    conexao: str | None = Query(default=None, max_length=10),
    setores: str | None = Query(default=None, max_length=20),
    user_id: str | None = Query(default=None, max_length=20),
    rating: str | None = Query(default=None, max_length=3),
    sessao: Session = Depends(sessao_db),
):
    filtros = _ler_filtros(de, ate, origem, conexao, setores, user_id, rating)
    criterios = _criterios(*filtros)
    dialeto = _dialeto(sessao)
    hora = _hora(Atendimento.criado, dialeto)
    dia = _dia_semana(Atendimento.criado, dialeto)

    def recorte(*extra):
        return _consulta(sessao, criterios, extra)

    volume, espera, atendimento, rating_medio, com_rating = recorte().with_entities(
        func.count(Atendimento.id),
        func.avg(Atendimento.tempo_espera_segundos),
        func.avg(Atendimento.tempo_atendimento_segundos),
        func.avg(Atendimento.rating),
        func.count(Atendimento.rating),
    ).one()
    volume = int(volume or 0)
    com_rating = int(com_rating or 0)

    por_hora = {
        int(valor): int(contagem)
        for valor, contagem in (
            recorte()
            .with_entities(hora, func.count(Atendimento.id))
            .group_by(hora)
            .all()
        )
        if valor is not None
    }
    tempos = {
        int(valor): (espera_h, atendimento_h, int(contagem))
        for valor, espera_h, atendimento_h, contagem in recorte().with_entities(
            hora,
            func.avg(Atendimento.tempo_espera_segundos),
            func.avg(Atendimento.tempo_atendimento_segundos),
            func.count(Atendimento.id),
        )
        .group_by(hora)
        .all()
        if valor is not None
    }
    por_dia = {
        int(valor): int(contagem)
        for valor, contagem in recorte().with_entities(
            dia, func.count(Atendimento.id)
        )
        .group_by(dia)
        .all()
        if valor is not None
    }
    calor = {
        (int(valor_dia), int(valor_hora)): int(contagem)
        for valor_dia, valor_hora, contagem in recorte().with_entities(
            dia, hora, func.count(Atendimento.id)
        )
        .group_by(dia, hora)
        .all()
        if valor_dia is not None and valor_hora is not None
    }
    serie = _preencher_dias(
        recorte()
        .with_entities(func.date(Atendimento.criado), func.count(Atendimento.id))
        .group_by(func.date(Atendimento.criado))
        .all()
    )
    notas = {
        int(valor): int(contagem)
        for valor, contagem in recorte(Atendimento.rating.is_not(None)).with_entities(
            Atendimento.rating, func.count(Atendimento.id)
        )
        .group_by(Atendimento.rating)
        .all()
    }

    def ranking(coluna, limite=None):
        consulta_ranking = recorte(coluna.is_not(None), coluna != "")
        linhas = (
            consulta_ranking.with_entities(
                coluna,
                func.count(Atendimento.id),
                func.avg(Atendimento.tempo_espera_segundos),
                func.avg(Atendimento.tempo_atendimento_segundos),
                func.avg(Atendimento.rating),
            )
            .group_by(coluna)
            .order_by(func.count(Atendimento.id).desc(), coluna)
        )
        if limite is not None:
            linhas = linhas.limit(limite)
        linhas = linhas.all()
        return [
            {
                "nome": nome,
                "volume": int(contagem),
                "espera_media_segundos": _inteiro(espera_item),
                "atendimento_medio_segundos": _inteiro(atendimento_item),
                "rating_medio": _decimal(nota),
            }
            for nome, contagem, espera_item, atendimento_item, nota in linhas
        ]

    return {
        "kpis": {
            "volume": volume,
            "espera_media_segundos": _inteiro(espera),
            "atendimento_medio_segundos": _inteiro(atendimento),
            "rating_medio": _decimal(rating_medio),
            "com_rating": com_rating,
            "sem_rating": volume - com_rating,
        },
        "regras": {
            "almoco": "hora de criado de 12 a 13",
            "apos_20h": "hora de criado maior ou igual a 20",
            "sabado": "dia da semana de criado igual a sábado",
            "relogio": "DATETIME operacional gravado, sem conversão para UTC",
        },
        "comparacoes": {
            "almoco": _bloco(recorte(hora.between(12, 13))),
            "fora_almoco": _bloco(recorte(~hora.between(12, 13))),
            "apos_20h": _bloco(recorte(hora >= 20)),
            "antes_20h": _bloco(recorte(hora < 20)),
            "sabado": _bloco(recorte(dia == 6)),
            "demais_dias": _bloco(recorte(dia != 6)),
        },
        "volume_por_hora": [
            {"hora": indice, "volume": por_hora.get(indice, 0)} for indice in range(24)
        ],
        "volume_por_dia": [
            {
                "dia": indice,
                "rotulo": _ROTULOS_DIA[indice],
                "volume": por_dia.get(indice, 0),
            }
            for indice in range(7)
        ],
        "serie_diaria": serie,
        "heatmap": [
            {
                "dia": indice_dia,
                "rotulo": _ROTULOS_DIA[indice_dia],
                "hora": indice_hora,
                "volume": calor.get((indice_dia, indice_hora), 0),
            }
            for indice_dia in range(7)
            for indice_hora in range(24)
        ],
        "tempos_por_hora": [
            {
                "hora": indice,
                "volume": tempos.get(indice, (None, None, 0))[2],
                "espera_media_segundos": _inteiro(
                    tempos.get(indice, (None, None, 0))[0]
                ),
                "atendimento_medio_segundos": _inteiro(
                    tempos.get(indice, (None, None, 0))[1]
                ),
            }
            for indice in range(24)
        ],
        "rating": [
            {"nota": nota, "volume": notas.get(nota, 0)} for nota in range(1, 6)
        ],
        "operadores": ranking(Atendimento.user_id),
        "contatos": ranking(Atendimento.contact_id, _LIMITE_CONTATOS),
    }


@router.get("/inteligencia")
def inteligencia_analise():
    if not _ARTEFATO.is_file():
        return {
            "disponivel": False,
            "motivo": "A previsão ainda não foi treinada.",
        }
    return json.loads(_ARTEFATO.read_text(encoding="utf-8"))


@router.post("/inteligencia/treinar")
def treinar_inteligencia(sessao: Session = Depends(sessao_db)):
    try:
        return gravar_previsao(sessao, _ARTEFATO)
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro)) from erro
