"""Previsão horária de demanda, baseline e regras de atenção.

A série usa o DATETIME gravado, sem conversão de fuso. O treino é só o
passado; o teste são os últimos 21 dias. O modelo publicado é o de menor
erro no horário de operação (8h–19h), e o baseline permanece se o
aprendizado não reduzir o MAE em pelo menos 5%.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from statistics import median

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HORA_INICIO = 8
HORA_FIM = 19
DIAS_TESTE = 21
DIAS_HORIZONTE = 7
LAG_MINIMO = 168
MELHORA_MINIMA = 0.05
DIAS_ANTERIORES = 78
DIAS_RECENTES = 14
MINIMO_HISTORICO_CLIENTE = 8
MINIMO_RECENTES_CLIENTE = 8
FATOR_CLIENTE = 2
FATOR_ESPERA = 1.5
PISO_DESVIO = 5
FATOR_DESVIO = 0.5

_FEATURES = (
    "hora",
    "dia_semana",
    "seno_hora",
    "cosseno_hora",
    "seno_dia",
    "cosseno_dia",
    "defasagem_1h",
    "defasagem_24h",
    "defasagem_168h",
    "media_24h",
    "media_168h",
)
def completar_serie(contagens):
    if not contagens:
        return []
    inicio = min(contagens)
    fim = max(contagens)
    inicio = inicio.replace(minute=0, second=0, microsecond=0)
    fim = fim.replace(minute=0, second=0, microsecond=0)
    serie = []
    cursor = inicio
    while cursor <= fim:
        serie.append((cursor, int(contagens.get(cursor, 0))))
        cursor += timedelta(hours=1)
    return serie


def _operacao(momento):
    return HORA_INICIO <= momento.hour <= HORA_FIM


def _features(volumes, indice, momento):
    if indice < LAG_MINIMO:
        return None
    hora = momento.hour
    dia = momento.weekday()
    return [
        hora,
        dia,
        math.sin(2 * math.pi * hora / 24),
        math.cos(2 * math.pi * hora / 24),
        math.sin(2 * math.pi * dia / 7),
        math.cos(2 * math.pi * dia / 7),
        volumes[indice - 1],
        volumes[indice - 24],
        volumes[indice - 168],
        sum(volumes[indice - 24 : indice]) / 24,
        sum(volumes[indice - 168 : indice]) / 168,
    ]


def _mae(real, previsto):
    if not real:
        return None
    return sum(abs(a - b) for a, b in zip(real, previsto)) / len(real)


def _rmse(real, previsto):
    if not real:
        return None
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(real, previsto)) / len(real))


def _wape(real, previsto):
    total = sum(abs(valor) for valor in real)
    if total == 0:
        return None
    return sum(abs(a - b) for a, b in zip(real, previsto)) / total


def _arredondar(valor):
    if valor is None:
        return None
    return round(float(valor), 2)


def _iso(momento):
    return momento.strftime("%Y-%m-%dT%H:%M:%S")


def _baseline(treino):
    grupos = {}
    for momento, volume in treino:
        grupos.setdefault((momento.weekday(), momento.hour), []).append(volume)
    return {chave: sum(valores) / len(valores) for chave, valores in grupos.items()}


def _modelos():
    return {
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=1.0)),
        "hist_gradient_boosting": HistGradientBoostingRegressor(
            max_depth=3,
            max_iter=80,
            learning_rate=0.08,
            random_state=0,
        ),
    }


def _matriz(serie, volumes, indices):
    linhas = []
    alvos = []
    usados = []
    for indice in indices:
        vetor = _features(volumes, indice, serie[indice][0])
        if vetor is None:
            continue
        linhas.append(vetor)
        alvos.append(volumes[indice])
        usados.append(indice)
    if not linhas:
        return np.empty((0, len(_FEATURES))), np.empty(0), []
    return np.array(linhas, dtype=float), np.array(alvos, dtype=float), usados


def _metricas(serie, volumes, indices, previsto):
    real = []
    estimativa = []
    for indice in indices:
        if not _operacao(serie[indice][0]):
            continue
        real.append(volumes[indice])
        estimativa.append(previsto[indice])
    return {
        "mae": _arredondar(_mae(real, estimativa)),
        "rmse": _arredondar(_rmse(real, estimativa)),
        "wape": _arredondar(_wape(real, estimativa)),
    }


def _prever_futuro(serie, volumes, publicado, modelo, baseline):
    momentos = [item[0] for item in serie]
    historico = list(volumes)
    futuro = []
    cursor = momentos[-1]
    for _ in range(DIAS_HORIZONTE * 24):
        cursor += timedelta(hours=1)
        if publicado == "baseline_dia_hora":
            estimado = baseline.get((cursor.weekday(), cursor.hour), 0.0)
        else:
            vetor = _features(historico, len(historico), cursor)
            estimado = float(modelo.predict(np.array([vetor], dtype=float))[0])
        estimado = max(0.0, estimado)
        historico.append(estimado)
        futuro.append((cursor, estimado))
    return futuro


def _faixas(horas):
    if not horas:
        return []
    horas = sorted(horas)
    faixas = []
    inicio = horas[0]
    anterior = horas[0]
    for hora in horas[1:]:
        if hora == anterior + 1:
            anterior = hora
            continue
        faixas.append((inicio, anterior))
        inicio = hora
        anterior = hora
    faixas.append((inicio, anterior))
    return faixas


def clientes_fora_do_padrao(clientes):
    alertas = []
    for item in clientes:
        anteriores = int(item["anteriores"])
        recentes = int(item["recentes"])
        if anteriores < MINIMO_HISTORICO_CLIENTE or recentes < MINIMO_RECENTES_CLIENTE:
            continue
        taxa_anterior = anteriores / (DIAS_ANTERIORES / 7)
        taxa_recente = recentes / (DIAS_RECENTES / 7)
        if taxa_anterior <= 0 or taxa_recente < FATOR_CLIENTE * taxa_anterior:
            continue
        alertas.append(
            {
                "contato": item["contact_id"],
                "recentes": recentes,
                "anteriores": anteriores,
                "taxa_recente_semana": _arredondar(taxa_recente),
                "taxa_anterior_semana": _arredondar(taxa_anterior),
                "relacao": _arredondar(taxa_recente / taxa_anterior),
            }
        )
    alertas.sort(key=lambda item: item["relacao"], reverse=True)
    return alertas[:8]


def montar_artefato(contagens, operadores_por_hora, clientes, espera):
    serie = completar_serie(contagens)
    if len(serie) <= DIAS_TESTE * 24 + LAG_MINIMO:
        raise ValueError("Histórico horário insuficiente para o teste de 21 dias.")
    volumes = [volume for _, volume in serie]
    n_teste = DIAS_TESTE * 24
    treino = serie[:-n_teste]
    teste = serie[-n_teste:]
    baseline = _baseline(treino)
    previsto_baseline = {
        indice: baseline.get((serie[indice][0].weekday(), serie[indice][0].hour), 0.0)
        for indice in range(len(serie))
    }
    indices_treino = range(0, len(serie) - n_teste)
    indices_teste = range(len(serie) - n_teste, len(serie))
    x_treino, y_treino, _ = _matriz(serie, volumes, indices_treino)
    x_teste, _, usados_teste = _matriz(serie, volumes, indices_teste)
    metricas = {
        "baseline_dia_hora": _metricas(serie, volumes, indices_teste, previsto_baseline)
    }
    ajustados = {}
    previsoes = {"baseline_dia_hora": previsto_baseline}
    for nome, modelo in _modelos().items():
        modelo.fit(x_treino, y_treino)
        bruto = modelo.predict(x_teste)
        mapa = dict(previsto_baseline)
        for indice, valor in zip(usados_teste, bruto):
            mapa[indice] = max(0.0, float(valor))
        previsoes[nome] = mapa
        metricas[nome] = _metricas(serie, volumes, indices_teste, mapa)
        ajustados[nome] = modelo

    mae_base = metricas["baseline_dia_hora"]["mae"]
    publicado = "baseline_dia_hora"
    for nome in ("ridge", "hist_gradient_boosting"):
        mae_modelo = metricas[nome]["mae"]
        if mae_modelo is None or mae_base is None:
            continue
        if mae_modelo < mae_base * (1 - MELHORA_MINIMA):
            if (
                publicado == "baseline_dia_hora"
                or mae_modelo < metricas[publicado]["mae"]
            ):
                publicado = nome

    modelo_futuro = ajustados.get(publicado)
    futuro = _prever_futuro(
        serie, volumes, publicado, modelo_futuro, baseline
    )
    taxa = _ritmo(operadores_por_hora, treino[0][0], treino[-1][0])
    tipicos = _operadores_tipicos(operadores_por_hora, treino[0][0], treino[-1][0])
    pontos = []
    pontos.extend(_pontos_capacidade(futuro, taxa, tipicos))
    pontos.extend(_pontos_desvio(teste, previsto_baseline, len(serie) - n_teste))
    pontos.extend(_pontos_clientes(clientes_fora_do_padrao(clientes)))
    pontos.extend(_ponto_espera(espera))

    importancia = None
    if publicado == "hist_gradient_boosting":
        valores = ajustados[publicado].feature_importances_
        pares = sorted(zip(_FEATURES, valores), key=lambda item: item[1], reverse=True)
        importancia = [
            {"variavel": nome, "importancia": _arredondar(valor)}
            for nome, valor in pares[:5]
        ]

    return {
        "disponivel": True,
        "relogio": "DATETIME operacional gravado, sem conversão para UTC",
        "fim_carga": _iso(serie[-1][0]),
        "aviso_tempo_real": (
            "A carga termina em "
            f"{serie[-1][0].strftime('%d/%m/%Y %Hh')}. "
            "Não há registros do dia corrente, nem fila, nem escala de quem estava disponível."
        ),
        "ultimo_dia": _ultimo_dia(teste, previsto_baseline, len(serie) - n_teste),
        "modelo": {
            "publicado": publicado,
            "ml_superou_baseline": publicado != "baseline_dia_hora",
            "treino_de": _iso(treino[0][0]),
            "treino_ate": _iso(treino[-1][0]),
            "teste_de": _iso(teste[0][0]),
            "teste_ate": _iso(teste[-1][0]),
            "janela": "8h–19h",
            "melhora_minima": MELHORA_MINIMA,
            "metricas": metricas,
            "importancia": importancia,
            "nota_importancia": (
                "Importância mede associação com a previsão, não causa do volume."
            ),
            "ritmo_por_operador_hora": _arredondar(taxa),
            "regra_capacidade": (
                "Ritmo = mediana de atendimentos abertos por operador ativo, "
                "no treino, entre 8h e 19h. Operadores típicos = mediana de "
                "operadores distintos naquela hora, nos dias de treino com movimento. "
                "A capacidade estimada é ritmo × operadores típicos. "
                "Não é a escala decidida nem a capacidade máxima."
            ),
        },
        "teste_horario": _serie_teste(teste, previsoes[publicado], len(serie) - n_teste),
        "teste_diario": _agregar_dias(teste, previsoes[publicado], len(serie) - n_teste),
        "futuro_horario": _serie_futura(futuro, taxa, tipicos),
        "futuro_diario": _dias_futuros(futuro, taxa, tipicos),
        "pontos": pontos,
        "nao_implementado": [
            {
                "item": "Movimento de hoje, fila e operadores disponíveis",
                "motivo": "Não há registro depois do fim da carga nem campo de fila ou escala.",
            },
            {
                "item": "Previsão de categoria ou problema",
                "motivo": "Não existe categoria. A tag está vazia em 6.323 de 6.756 registros e só marca loop ou fora do horário.",
            },
            {
                "item": "Propensão individual de novo atendimento por modelo",
                "motivo": "Três meses e muitos contatos com poucos chamados não sustentam validação temporal de uma probabilidade por cliente.",
            },
            {
                "item": "Pergunte aos dados",
                "motivo": "Não há LLM nesta etapa. As consultas continuam nos endpoints de análise.",
            },
        ],
    }


def _ritmo(operadores_por_hora, inicio, fim):
    taxas = []
    for momento, volume, operadores in operadores_por_hora:
        if momento < inicio or momento > fim or not _operacao(momento):
            continue
        if operadores <= 0:
            continue
        taxas.append(volume / operadores)
    if not taxas:
        return None
    return float(median(taxas))


def _operadores_tipicos(operadores_por_hora, inicio, fim):
    grupos = {hora: [] for hora in range(HORA_INICIO, HORA_FIM + 1)}
    for momento, volume, operadores in operadores_por_hora:
        if momento < inicio or momento > fim or not _operacao(momento):
            continue
        if volume <= 0:
            continue
        grupos[momento.hour].append(operadores)
    return {
        hora: float(median(valores)) if valores else None
        for hora, valores in grupos.items()
    }


def _pontos_capacidade(futuro, taxa, tipicos):
    if not taxa:
        return []
    por_dia = {}
    for momento, previsto in futuro:
        if not _operacao(momento):
            continue
        tipico = tipicos.get(momento.hour)
        if not tipico:
            continue
        capacidade = taxa * tipico
        if previsto <= capacidade:
            continue
        por_dia.setdefault(momento.date(), []).append(
            (momento.hour, previsto, capacidade, tipico)
        )
    pontos = []
    for dia, horas in por_dia.items():
        faixas = _faixas([hora for hora, *_ in horas])
        demandas = [item[1] for item in horas]
        capacidades = [item[2] for item in horas]
        texto = ", ".join(f"{inicio:02d}h–{fim:02d}h" for inicio, fim in faixas)
        pontos.append(
            {
                "tipo": "Capacidade",
                "titulo": f"{dia.strftime('%d/%m')} {texto}",
                "detalhe": (
                    "A demanda prevista supera o ritmo da equipe típica nessa hora."
                ),
                "evidencia": (
                    f"Previsto: {_arredondar(min(demandas))} a {_arredondar(max(demandas))} "
                    f"atendimentos/hora. Ritmo histórico × operadores típicos: "
                    f"{_arredondar(min(capacidades))} a {_arredondar(max(capacidades))}."
                ),
            }
        )
    return pontos


def _pontos_desvio(teste, baseline, deslocamento):
    achados = []
    for posicao, (momento, real) in enumerate(teste):
        if not _operacao(momento):
            continue
        esperado = baseline[deslocamento + posicao]
        if real < esperado + max(PISO_DESVIO, FATOR_DESVIO * esperado):
            continue
        achados.append((real - esperado, momento, real, esperado))
    achados.sort(reverse=True)
    return [
        {
            "tipo": "Desvio",
            "titulo": momento.strftime("%d/%m %Hh"),
            "detalhe": (
                "No período de teste, o volume ficou acima do esperado para essa hora e esse dia da semana."
            ),
            "evidencia": (
                f"Real: {real}. Esperado pelo baseline: {_arredondar(esperado)}. "
                f"Diferença: {_arredondar(folga)}."
            ),
        }
        for folga, momento, real, esperado in achados[:5]
    ]


def _pontos_clientes(alertas):
    return [
        {
            "tipo": "Cliente",
            "titulo": item["contato"],
            "detalhe": (
                "A taxa semanal recente ficou pelo menos duas vezes acima da taxa anterior desse mesmo contato."
            ),
            "evidencia": (
                f"Últimos 14 dias da carga: {item['recentes']} atendimentos "
                f"({item['taxa_recente_semana']}/semana). "
                f"Período anterior: {item['anteriores']} "
                f"({item['taxa_anterior_semana']}/semana)."
            ),
        }
        for item in alertas
    ]


def _ponto_espera(espera):
    if not espera:
        return []
    antes = espera.get("espera_antes")
    depois = espera.get("espera_depois")
    if antes in (None, 0) or depois is None or depois < FATOR_ESPERA * antes:
        return []
    atendimento_antes = espera.get("atendimento_antes")
    atendimento_depois = espera.get("atendimento_depois")
    return [
        {
            "tipo": "Tempo",
            "titulo": "Espera diurna nas últimas duas semanas da carga",
            "detalhe": (
                "A espera média recente, entre 8h e 19h e abaixo de 2 horas, "
                "é pelo menos 1,5 vez a do período anterior."
            ),
            "evidencia": (
                f"Espera: {depois} s contra {antes} s antes. "
                f"Atendimento, no mesmo recorte: {atendimento_depois} s contra {atendimento_antes} s."
            ),
        }
    ]


def _ultimo_dia(teste, baseline, deslocamento):
    ultimo = teste[-1][0].date()
    real = 0
    esperado = 0.0
    for posicao, (momento, volume) in enumerate(teste):
        if momento.date() != ultimo or not _operacao(momento):
            continue
        real += volume
        esperado += baseline[deslocamento + posicao]
    if esperado == 0:
        desvio = None
    else:
        desvio = round((real - esperado) / esperado * 100, 1)
    return {
        "data": ultimo.isoformat(),
        "real": real,
        "esperado": _arredondar(esperado),
        "desvio_percentual": desvio,
        "recorte": "8h–19h do último dia presente na carga",
    }


def _serie_teste(teste, previsto, deslocamento):
    pontos = []
    for posicao, (momento, real) in enumerate(teste):
        if not _operacao(momento):
            continue
        if momento < teste[-1][0] - timedelta(days=7):
            continue
        pontos.append(
            {
                "inicio": _iso(momento),
                "real": real,
                "previsto": _arredondar(previsto[deslocamento + posicao]),
            }
        )
    return pontos


def _agregar_dias(teste, previsto, deslocamento):
    dias = {}
    for posicao, (momento, real) in enumerate(teste):
        chave = momento.date().isoformat()
        item = dias.setdefault(chave, {"data": chave, "real": 0, "previsto": 0.0})
        item["real"] += real
        item["previsto"] += previsto[deslocamento + posicao]
    return [
        {
            "data": item["data"],
            "real": item["real"],
            "previsto": _arredondar(item["previsto"]),
        }
        for item in dias.values()
    ]


def _serie_futura(futuro, taxa, tipicos):
    pontos = []
    for momento, previsto in futuro:
        if not _operacao(momento):
            continue
        tipico = tipicos.get(momento.hour)
        capacidade = None if not taxa or not tipico else taxa * tipico
        pontos.append(
            {
                "inicio": _iso(momento),
                "previsto": _arredondar(previsto),
                "capacidade": _arredondar(capacidade),
                "operadores_tipicos": _arredondar(tipico),
                "operadores_estimados": (
                    None if not taxa or taxa <= 0 else math.ceil(previsto / taxa)
                ),
            }
        )
    return pontos


def _dias_futuros(futuro, taxa, tipicos):
    dias = {}
    for momento, previsto in futuro:
        chave = momento.date().isoformat()
        item = dias.setdefault(
            chave,
            {
                "data": chave,
                "previsto": 0.0,
                "pico_hora": momento.hour,
                "pico": -1.0,
                "risco": False,
            },
        )
        item["previsto"] += previsto
        if _operacao(momento) and previsto > item["pico"]:
            item["pico"] = previsto
            item["pico_hora"] = momento.hour
        tipico = tipicos.get(momento.hour)
        if taxa and tipico and _operacao(momento) and previsto > taxa * tipico:
            item["risco"] = True
    return [
        {
            "data": item["data"],
            "previsto": _arredondar(item["previsto"]),
            "pico_hora": item["pico_hora"],
            "pico": _arredondar(item["pico"] if item["pico"] >= 0 else 0),
            "acima_do_ritmo": item["risco"],
        }
        for item in dias.values()
        if item["pico"] >= 0
    ]


def _slot_hora(coluna, dialeto):
    from sqlalchemy import Integer, cast, func

    if dialeto == "sqlite":
        return func.strftime("%Y-%m-%d %H:00:00", coluna), cast(
            func.strftime("%H", coluna), Integer
        )
    return func.date_format(coluna, "%Y-%m-%d %H:00:00"), func.hour(coluna)


def _como_datetime(valor):
    if isinstance(valor, datetime):
        return valor.replace(tzinfo=None)
    return datetime.strptime(str(valor)[:19], "%Y-%m-%d %H:%M:%S")


def _inteiro_opcional(valor):
    if valor is None:
        return None
    return int(round(float(valor)))


def agregar_atendimentos(sessao):
    from sqlalchemy import and_, case, func

    from modelos import Atendimento

    fim = sessao.query(func.max(Atendimento.criado)).scalar()
    if fim is None:
        raise ValueError("Não há atendimentos para treinar a previsão.")
    ultimo = _como_datetime(fim)
    corte = datetime.combine(
        ultimo.date() - timedelta(days=DIAS_RECENTES - 1),
        datetime.min.time(),
    )
    dialeto = sessao.get_bind().dialect.name
    slot, hora = _slot_hora(Atendimento.criado, dialeto)
    contagens = {
        _como_datetime(momento): int(volume)
        for momento, volume in sessao.query(slot, func.count())
        .group_by(slot)
        .all()
    }
    operadores = [
        (_como_datetime(momento), int(volume), int(pessoas))
        for momento, volume, pessoas in sessao.query(
            slot,
            func.count(),
            func.count(func.distinct(Atendimento.user_id)),
        )
        .filter(hora.between(HORA_INICIO, HORA_FIM))
        .group_by(slot)
        .all()
    ]
    clientes = [
        {
            "contact_id": contato,
            "recentes": int(recentes or 0),
            "anteriores": int(anteriores or 0),
        }
        for contato, recentes, anteriores in sessao.query(
            Atendimento.contact_id,
            func.sum(case((Atendimento.criado >= corte, 1), else_=0)),
            func.sum(case((Atendimento.criado < corte, 1), else_=0)),
        )
        .filter(
            Atendimento.contact_id.is_not(None),
            Atendimento.contact_id != "",
        )
        .group_by(Atendimento.contact_id)
        .all()
    ]
    diurno = hora.between(HORA_INICIO, HORA_FIM)
    curto = 7200
    espera = sessao.query(
        func.round(
            func.avg(
                case(
                    (
                        and_(
                            Atendimento.criado < corte,
                            Atendimento.tempo_espera_segundos < curto,
                        ),
                        Atendimento.tempo_espera_segundos,
                    ),
                    else_=None,
                )
            )
        ),
        func.round(
            func.avg(
                case(
                    (
                        and_(
                            Atendimento.criado >= corte,
                            Atendimento.tempo_espera_segundos < curto,
                        ),
                        Atendimento.tempo_espera_segundos,
                    ),
                    else_=None,
                )
            )
        ),
        func.round(
            func.avg(
                case(
                    (
                        and_(
                            Atendimento.criado < corte,
                            Atendimento.tempo_atendimento_segundos < curto,
                        ),
                        Atendimento.tempo_atendimento_segundos,
                    ),
                    else_=None,
                )
            )
        ),
        func.round(
            func.avg(
                case(
                    (
                        and_(
                            Atendimento.criado >= corte,
                            Atendimento.tempo_atendimento_segundos < curto,
                        ),
                        Atendimento.tempo_atendimento_segundos,
                    ),
                    else_=None,
                )
            )
        ),
    ).filter(diurno).one()
    return (
        contagens,
        operadores,
        clientes,
        {
            "espera_antes": _inteiro_opcional(espera[0]),
            "espera_depois": _inteiro_opcional(espera[1]),
            "atendimento_antes": _inteiro_opcional(espera[2]),
            "atendimento_depois": _inteiro_opcional(espera[3]),
        },
    )


def gravar_previsao(sessao, caminho):
    artefato = montar_artefato(*agregar_atendimentos(sessao))
    destino = Path(caminho)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(
        json.dumps(artefato, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return artefato
