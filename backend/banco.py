from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

import config

engine = create_engine(
    config.DATABASE_URL,
    pool_pre_ping=True,
)

SessaoLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def obter_sessao():
    sessao = SessaoLocal()
    try:
        yield sessao
    finally:
        sessao.close()


def testar_conexao():
    with engine.connect() as conexao:
        resultado = conexao.execute(
            text("SELECT DATABASE(), VERSION()")
        ).fetchone()

        return {
            "banco": resultado[0],
            "versao": resultado[1],
        }


if __name__ == "__main__":
    print(testar_conexao())
