from urllib.parse import quote_plus

import pytest
from alembic.config import Config


def _url_ficticia():
    senha = "Aa1/Bb2+Cc3!"
    return (
        "mysql+pymysql://flivocom_pi4app:"
        f"{quote_plus(senha)}@127.0.0.1:3306/flivocom_pi4"
    )


def test_url_percent_encoded_quebra_configparser_sem_escape():
    url = _url_ficticia()
    assert "%" in url
    cfg = Config()
    with pytest.raises(ValueError, match="interpolation"):
        cfg.set_main_option("sqlalchemy.url", url)


def test_url_percent_encoded_aceita_apos_dobrar_porcento():
    url = _url_ficticia()
    cfg = Config()
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    assert cfg.get_main_option("sqlalchemy.url") == url
