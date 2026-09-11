from fastapi import FastAPI, HTTPException

from banco import testar_conexao
from rotas_autenticacao import router as rotas_autenticacao
from rotas_convites import router as rotas_convites

app = FastAPI(
    title="PI4 UNIVESP API",
    version="0.2.0",
)

app.include_router(rotas_autenticacao)
app.include_router(rotas_convites)


@app.get("/")
def raiz():
    return {
        "projeto": "PI4 UNIVESP",
        "status": "ativo",
    }


@app.get("/api/status")
def status():
    return {
        "status": "ok",
        "backend": "FastAPI",
        "python": "3.12",
    }


@app.get("/api/status/banco")
def status_banco():
    try:
        banco = testar_conexao()
        return {
            "status": "ok",
            "banco": banco["banco"],
            "servidor": "MariaDB",
            "versao": banco["versao"],
        }
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Falha na conexão com o banco de dados",
        )
