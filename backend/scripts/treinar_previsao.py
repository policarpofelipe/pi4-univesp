"""Treina a previsão de demanda e grava models/previsao_demanda.json.

Não roda a cada request. Na VPS, a partir de backend/:

    python scripts/treinar_previsao.py

Sem banco local, os agregados já exportados entram por arquivo:

    python scripts/treinar_previsao.py --serie serie.json --operadores ops.json --clientes clientes.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from previsao_demanda import montar_artefato

RAIZ = Path(__file__).resolve().parents[2]
DESTINO = RAIZ / "models" / "previsao_demanda.json"


def _momento(texto):
    return datetime.strptime(str(texto)[:19], "%Y-%m-%d %H:%M:%S")


def _ler_json(caminho):
    texto = Path(caminho).read_text(encoding="utf-8")
    return json.JSONDecoder().raw_decode(texto)[0]


def _do_banco():
    from banco import SessaoLocal

    sessao = SessaoLocal()
    try:
        serie = sessao.execute(
            text(
                "SELECT DATE_FORMAT(criado, '%Y-%m-%d %H:00:00') AS slot, COUNT(*) AS n "
                "FROM atendimentos GROUP BY DATE_FORMAT(criado, '%Y-%m-%d %H:00:00')"
            )
        ).all()
        operadores = sessao.execute(
            text(
                "SELECT DATE_FORMAT(criado, '%Y-%m-%d %H:00:00') AS slot, "
                "COUNT(*) AS n, COUNT(DISTINCT user_id) AS operadores "
                "FROM atendimentos WHERE HOUR(criado) BETWEEN 8 AND 19 "
                "GROUP BY DATE_FORMAT(criado, '%Y-%m-%d %H:00:00')"
            )
        ).all()
        clientes = sessao.execute(
            text(
                "SELECT contact_id, "
                "SUM(criado >= '2026-08-18 00:00:00') AS recentes, "
                "SUM(criado < '2026-08-18 00:00:00') AS anteriores "
                "FROM atendimentos "
                "WHERE contact_id IS NOT NULL AND contact_id <> '' "
                "GROUP BY contact_id"
            )
        ).all()
        espera = sessao.execute(
            text(
                "SELECT "
                "ROUND(AVG(CASE WHEN criado < '2026-08-18' AND tempo_espera_segundos < 7200 "
                "THEN tempo_espera_segundos END)) AS espera_antes, "
                "ROUND(AVG(CASE WHEN criado >= '2026-08-18' AND tempo_espera_segundos < 7200 "
                "THEN tempo_espera_segundos END)) AS espera_depois, "
                "ROUND(AVG(CASE WHEN criado < '2026-08-18' AND tempo_atendimento_segundos < 7200 "
                "THEN tempo_atendimento_segundos END)) AS atendimento_antes, "
                "ROUND(AVG(CASE WHEN criado >= '2026-08-18' AND tempo_atendimento_segundos < 7200 "
                "THEN tempo_atendimento_segundos END)) AS atendimento_depois "
                "FROM atendimentos WHERE HOUR(criado) BETWEEN 8 AND 19"
            )
        ).one()
    finally:
        sessao.close()
    return (
        {_momento(slot): int(n) for slot, n in serie},
        [(_momento(slot), int(n), int(ops)) for slot, n, ops in operadores],
        [
            {
                "contact_id": contato,
                "recentes": int(recentes),
                "anteriores": int(anteriores),
            }
            for contato, recentes, anteriores in clientes
        ],
        {
            "espera_antes": int(espera.espera_antes),
            "espera_depois": int(espera.espera_depois),
            "atendimento_antes": int(espera.atendimento_antes),
            "atendimento_depois": int(espera.atendimento_depois),
        },
    )


def _de_arquivos(args):
    serie = {
        _momento(item["slot"]): int(item["n"]) for item in _ler_json(args.serie)
    }
    operadores = [
        (_momento(item["slot"]), int(item["n"]), int(item["operadores"]))
        for item in _ler_json(args.operadores)
    ]
    clientes = _ler_json(args.clientes) if args.clientes else []
    espera = {
        "espera_antes": args.espera_antes,
        "espera_depois": args.espera_depois,
        "atendimento_antes": args.atendimento_antes,
        "atendimento_depois": args.atendimento_depois,
    }
    return serie, operadores, clientes, espera


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--serie")
    parser.add_argument("--operadores")
    parser.add_argument("--clientes")
    parser.add_argument("--espera-antes", type=int)
    parser.add_argument("--espera-depois", type=int)
    parser.add_argument("--atendimento-antes", type=int)
    parser.add_argument("--atendimento-depois", type=int)
    args = parser.parse_args()
    if args.serie:
        dados = _de_arquivos(args)
    else:
        dados = _do_banco()
    artefato = montar_artefato(*dados)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(
        json.dumps(artefato, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "arquivo": str(DESTINO),
                "publicado": artefato["modelo"]["publicado"],
                "metricas": artefato["modelo"]["metricas"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
