from datetime import datetime, timezone


def agora_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)
