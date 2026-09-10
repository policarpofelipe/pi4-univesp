import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = quote_plus(os.getenv("DB_PASSWORD"))

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


def testar_conexao():
    with engine.connect() as conexao:
        resultado = conexao.execute(
            text("SELECT DATABASE(), VERSION()")
        ).fetchone()

        return {
            "banco": resultado[0],
            "versao": resultado[1]
        }


if __name__ == "__main__":
    print(testar_conexao())
