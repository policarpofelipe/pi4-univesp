from datetime import datetime

from modelos import Atendimento
from tests.helpers import cabecalho_origem

CABECALHO = (
    "protocolo,id_ticket,origem,contact_id,conexao,user_id,criado,iniciado,fim,"
    "tempo_espera_segundos,tempo_atendimento_segundos,setores,setores_transfers,"
    "rating,tags"
)


def _entrar(cliente, email, senha):
    return cliente.post(
        "/api/autenticacao/entrar",
        json={"email": email, "senha": senha},
        headers=cabecalho_origem(),
    )


def _linha(**kwargs):
    dados = {
        "protocolo": "10",
        "id_ticket": "1",
        "origem": "Receptivo",
        "contact_id": "Contato 9",
        "conexao": "PDVx",
        "user_id": "Operador 1",
        "criado": "2026-09-01 10:00:00",
        "iniciado": "2026-09-01 10:05:00",
        "fim": "2026-09-01 10:20:00",
        "tempo_espera_segundos": "300",
        "tempo_atendimento_segundos": "900",
        "setores": "Suporte",
        "setores_transfers": "",
        "rating": "5",
        "tags": "",
    }
    dados.update(kwargs)
    return ",".join(dados[coluna] for coluna in dados)


def _enviar(cliente, texto, nome="carga.csv"):
    return cliente.post(
        "/api/fonte/importar",
        files={"arquivo": (nome, texto.encode("utf-8"), "text/csv")},
        headers={"Origin": "http://localhost:5173"},
    )


def test_fonte_exige_sessao(cliente):
    assert cliente.get("/api/fonte").status_code == 401
    resposta = _enviar(cliente, CABECALHO + "\n")
    assert resposta.status_code == 401


def test_usuario_comum_ve_e_importa(cliente, usuario_comum, sessao):
    _entrar(cliente, usuario_comum.email, "senha-usuario-ok")
    vazio = cliente.get("/api/fonte")
    assert vazio.status_code == 200
    assert vazio.json()["total"] == 0
    assert "protocolo" in vazio.json()["colunas"]

    resposta = _enviar(cliente, CABECALHO + "\n" + _linha() + "\n")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["inseridos"] == 1
    assert corpo["duplicados"] == 0
    assert corpo["invalidos"] == 0
    sessao.expire_all()
    assert sessao.query(Atendimento).count() == 1
    retrato = cliente.get("/api/fonte").json()
    assert retrato["total"] == 1
    assert retrato["de"] == "2026-09-01"
    assert retrato["operadores"][0]["nome"] == "Operador 1"


def test_protocolo_existente_nao_substitui(cliente, mestre, sessao):
    sessao.add(
        Atendimento(
            protocolo=10,
            conexao="PDVx",
            user_id="Operador 1",
            criado=datetime(2026, 6, 1, 8, 0),
            iniciado=datetime(2026, 6, 1, 8, 1),
            fim=datetime(2026, 6, 1, 8, 5),
            tempo_espera_segundos=60,
            tempo_atendimento_segundos=240,
            setores="Suporte",
        )
    )
    sessao.commit()
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    texto = CABECALHO + "\n" + _linha() + "\n" + _linha(protocolo="11") + "\n"
    corpo = _enviar(cliente, texto).json()
    assert corpo["inseridos"] == 1
    assert corpo["duplicados"] == 1
    assert 10 in corpo["protocolos_duplicados"]
    sessao.expire_all()
    antigo = sessao.query(Atendimento).filter(Atendimento.protocolo == 10).one()
    assert antigo.criado == datetime(2026, 6, 1, 8, 0)
    assert sessao.query(Atendimento).count() == 2


def test_linha_invalida_nao_grava_e_a_valida_grava(cliente, mestre, sessao):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    invalida = _linha(protocolo="12", rating="9")
    valida = _linha(protocolo="13", rating="")
    corpo = _enviar(cliente, CABECALHO + "\n" + invalida + "\n" + valida + "\n").json()
    assert corpo["inseridos"] == 1
    assert corpo["invalidos"] == 1
    assert corpo["erros"][0]["linha"] == 2
    sessao.expire_all()
    gravado = sessao.query(Atendimento).one()
    assert gravado.protocolo == 13
    assert gravado.rating is None


def test_csv_com_ponto_e_virgula(cliente, mestre, sessao):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    cabecalho = CABECALHO.replace(",", ";")
    linha = _linha().replace(",", ";")
    corpo = _enviar(cliente, cabecalho + "\n" + linha + "\n").json()
    assert corpo["inseridos"] == 1
    sessao.expire_all()
    assert sessao.query(Atendimento).count() == 1


def test_coluna_fora_do_formato(cliente, mestre):
    _entrar(cliente, mestre.email, "senha-mestre-ok")
    resposta = _enviar(cliente, "protocolo,nome\n1,Ana\n")
    assert resposta.status_code == 400
