"""Previsão de demanda: split temporal, baseline e leitura do artefato."""

import json
from datetime import datetime, timedelta

import rotas_analise
from previsao_demanda import (
    _features,
    _pontos_capacidade,
    _serie_futura,
    clientes_fora_do_padrao,
    montar_artefato,
)
from tests.helpers import cabecalho_origem


def _entrar(cliente, email, senha):
    return cliente.post(
        "/api/autenticacao/entrar",
        json={"email": email, "senha": senha},
        headers=cabecalho_origem(),
    )


def _contagens(dias=45):
    inicio = datetime(2026, 6, 1, 8, 0)
    contagens = {}
    operadores = []
    for passo in range(dias * 24):
        momento = inicio + timedelta(hours=passo)
        volume = 4 if momento.weekday() < 5 and 8 <= momento.hour <= 19 else 0
        if volume:
            contagens[momento] = volume
            operadores.append((momento, volume, 2))
    return contagens, operadores


def test_features_usam_somente_o_passado():
    volumes = list(range(200))
    vetor = _features(volumes, 180, datetime(2026, 8, 1, 10, 0))
    assert vetor[6] == volumes[179]
    assert vetor[7] == volumes[156]
    assert vetor[8] == volumes[12]


def test_cliente_sem_historico_proprio_nao_entra():
    alertas = clientes_fora_do_padrao(
        [
            {"contact_id": "Contato 705", "recentes": 8, "anteriores": 0},
            {"contact_id": "Contato 709", "recentes": 14, "anteriores": 3},
            {"contact_id": "Contato 713", "recentes": 14, "anteriores": 9},
        ]
    )
    assert [item["contato"] for item in alertas] == ["Contato 713"]


def test_capacidade_e_regra_e_arredonda_para_cima():
    futuro = [(datetime(2026, 9, 1, 10, 0), 7.1)]
    serie = _serie_futura(futuro, 2.0, {10: 3})
    assert serie[0]["operadores_estimados"] == 4
    assert serie[0]["capacidade"] == 6.0
    pontos = _pontos_capacidade(futuro, 2.0, {10: 3})
    assert pontos[0]["tipo"] == "Capacidade"


def test_serie_estavel_publica_o_baseline():
    contagens, operadores = _contagens()
    artefato = montar_artefato(contagens, operadores, [], None)
    modelo = artefato["modelo"]
    assert modelo["publicado"] == "baseline_dia_hora"
    assert modelo["ml_superou_baseline"] is False
    assert modelo["metricas"]["baseline_dia_hora"]["mae"] == 0
    inicio = datetime.fromisoformat(modelo["teste_de"])
    fim = datetime.fromisoformat(modelo["teste_ate"])
    assert fim - inicio == timedelta(hours=21 * 24 - 1)
    assert artefato["futuro_horario"][0]["inicio"] > modelo["teste_ate"]


def test_agregar_no_sqlite(sessao):
    from modelos import Atendimento

    from previsao_demanda import agregar_atendimentos

    criado = datetime(2026, 8, 31, 9, 15)
    sessao.add(
        Atendimento(
            protocolo=9001,
            origem="Receptivo",
            contact_id="Contato 1",
            conexao="PDVx",
            user_id="Operador 1",
            criado=criado,
            iniciado=criado,
            fim=criado,
            tempo_espera_segundos=120,
            tempo_atendimento_segundos=300,
            setores="Suporte",
        )
    )
    sessao.commit()
    contagens, operadores, clientes, espera = agregar_atendimentos(sessao)
    assert sum(contagens.values()) == 1
    assert operadores[0][2] == 1
    assert clientes[0]["contact_id"] == "Contato 1"
    assert espera["espera_depois"] == 120


def test_inteligencia_exige_sessao(cliente):
    resposta = cliente.get("/api/analise/inteligencia")
    assert resposta.status_code == 401


def test_inteligencia_sem_arquivo(cliente, mestre, monkeypatch, tmp_path):
    monkeypatch.setattr(rotas_analise, "_ARTEFATO", tmp_path / "ausente.json")
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    resposta = cliente.get("/api/analise/inteligencia")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["disponivel"] is False
    assert "treinada" in corpo["motivo"]


def test_inteligencia_le_artefato(cliente, usuario_comum, monkeypatch, tmp_path):
    arquivo = tmp_path / "previsao_demanda.json"
    arquivo.write_text(
        json.dumps({"disponivel": True, "modelo": {"publicado": "baseline_dia_hora"}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(rotas_analise, "_ARTEFATO", arquivo)
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    resposta = cliente.get("/api/analise/inteligencia")
    assert resposta.status_code == 200
    assert resposta.json()["modelo"]["publicado"] == "baseline_dia_hora"


def test_treinar_exige_sessao(cliente):
    resposta = cliente.post(
        "/api/analise/inteligencia/treinar",
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 401


def test_treinar_recusa_origem(cliente, usuario_comum):
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    resposta = cliente.post("/api/analise/inteligencia/treinar")
    assert resposta.status_code == 403


def test_treinar_sem_atendimentos(cliente, usuario_comum):
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    resposta = cliente.post(
        "/api/analise/inteligencia/treinar",
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 400
    assert "atendimentos" in resposta.json()["detail"]


def test_treinar_devolve_artefato(cliente, usuario_comum, monkeypatch, tmp_path):
    destino = tmp_path / "previsao_demanda.json"
    monkeypatch.setattr(rotas_analise, "_ARTEFATO", destino)
    artefato = {"disponivel": True, "modelo": {"publicado": "baseline_dia_hora"}}

    def falso(sessao, caminho):
        caminho.write_text(json.dumps(artefato), encoding="utf-8")
        return artefato

    monkeypatch.setattr(rotas_analise, "gravar_previsao", falso)
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    resposta = cliente.post(
        "/api/analise/inteligencia/treinar",
        headers=cabecalho_origem(),
    )
    assert resposta.status_code == 200
    assert resposta.json()["disponivel"] is True
    assert destino.is_file()
