import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


def validate_telegram_init_data(init_data: str, bot_token: str, now: int | None = None) -> int:
    fields = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = fields.pop("hash", None)
    if not received_hash:
        raise ValueError("Telegram authentication data is missing")

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret_key = hmac.new(bot_token.encode(), b"WebAppData", hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        raise ValueError("Telegram authentication data is invalid")

    try:
        auth_date = int(fields["auth_date"])
        telegram_user_id = int(json.loads(fields["user"])["id"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("Telegram authentication data is incomplete") from error

    current_time = int(time.time()) if now is None else now
    if auth_date > current_time + 60 or current_time - auth_date > 86_400:
        raise ValueError("Telegram authentication data has expired")

    return telegram_user_id
