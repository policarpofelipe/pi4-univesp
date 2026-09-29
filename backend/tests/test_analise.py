from datetime import datetime

from modelos import Atendimento
from tests.helpers import cabecalho_origem


def _entrar(cliente, email, senha):
    return cliente.post(
        "/api/autenticacao/entrar",
        json={"email": email, "senha": senha},
        headers=cabecalho_origem(),
    )


def _atendimento(sessao, **kwargs):
    criado = kwargs.pop("criado", datetime(2026, 6, 1, 12, 30))
    dados = {
        "protocolo": 1,
        "origem": "Receptivo",
        "contact_id": "Contato 1",
        "conexao": "PDVx",
        "user_id": "Operador 1",
        "criado": criado,
        "iniciado": criado,
        "fim": criado,
        "tempo_espera_segundos": 600,
        "tempo_atendimento_segundos": 1200,
        "setores": "Suporte",
        "rating": 5,
    }
    dados.update(kwargs)
    item = Atendimento(**dados)
    sessao.add(item)
    sessao.commit()
    return item


def test_resumo_exige_sessao(cliente):
    resposta = cliente.get("/api/analise/resumo")
    assert resposta.status_code == 401


def test_usuario_comum_consulta_analise(cliente, usuario_comum, sessao):
    _atendimento(sessao)
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    meta = cliente.get("/api/analise/meta")
    resumo = cliente.get("/api/analise/resumo")
    assert meta.status_code == 200
    assert resumo.status_code == 200
    assert meta.json()["de"] == "2026-06-01"
    assert resumo.json()["kpis"]["volume"] == 1


def test_filtro_reduz_volume(cliente, mestre, sessao):
    _atendimento(sessao, protocolo=1, origem="Receptivo")
    _atendimento(
        sessao,
        protocolo=2,
        origem="Ativo",
        criado=datetime(2026, 6, 2, 9, 0),
        contact_id="Contato 2",
        user_id="Operador 2",
    )
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    todos = cliente.get("/api/analise/resumo")
    ativo = cliente.get("/api/analise/resumo", params={"origem": "Ativo"})
    assert todos.json()["kpis"]["volume"] == 2
    assert ativo.json()["kpis"]["volume"] == 1
    assert "protocolo" not in ativo.text
    assert "id_ticket" not in ativo.text


def test_agregacao_hora_dia_e_ranking(cliente, mestre, sessao):
    _atendimento(
        sessao,
        protocolo=1,
        criado=datetime(2026, 6, 1, 12, 15),
        contact_id="Contato 1",
        rating=4,
    )
    _atendimento(
        sessao,
        protocolo=2,
        criado=datetime(2026, 6, 6, 21, 5),
        contact_id="Contato 2",
        user_id="Operador 2",
        rating=None,
        tempo_espera_segundos=60,
        tempo_atendimento_segundos=90,
    )
    for indice in range(3, 18):
        _atendimento(
            sessao,
            protocolo=indice,
            criado=datetime(2026, 6, 3, 8, 0),
            contact_id=f"Contato {indice}",
            rating=None,
        )
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    corpo = cliente.get("/api/analise/resumo").json()
    assert corpo["volume_por_hora"][12]["volume"] == 1
    assert corpo["volume_por_hora"][21]["volume"] == 1
    assert corpo["volume_por_dia"][1]["rotulo"] == "segunda-feira"
    assert corpo["volume_por_dia"][1]["volume"] == 1
    assert corpo["volume_por_dia"][6]["rotulo"] == "sábado"
    assert corpo["volume_por_dia"][6]["volume"] == 1
    assert corpo["comparacoes"]["almoco"]["volume"] == 1
    assert corpo["comparacoes"]["apos_20h"]["volume"] == 1
    assert corpo["comparacoes"]["sabado"]["volume"] == 1
    assert corpo["kpis"]["com_rating"] == 1
    assert corpo["kpis"]["sem_rating"] == 16
    assert len(corpo["contatos"]) == 15
    assert corpo["operadores"][0]["volume"] >= corpo["operadores"][-1]["volume"]
    assert len(corpo["heatmap"]) == 7 * 24


def test_data_invalida(cliente, mestre):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    resposta = cliente.get("/api/analise/resumo", params={"de": "2026-13-01"})
    assert resposta.status_code == 400
