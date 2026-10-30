import json
import time
from urllib.parse import parse_qsl

from aiogram.utils.web_app import check_webapp_signature


def validate_telegram_init_data(init_data: str, bot_token: str, now: int | None = None) -> tuple[int, dict]:
    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError as error:
        raise ValueError("Telegram authentication data is incomplete") from error
    if not fields.get("hash"):
        raise ValueError("Telegram authentication data is missing")
    if not check_webapp_signature(bot_token, init_data):
        raise ValueError("Telegram authentication data is invalid")

    try:
        auth_date = int(fields["auth_date"])
        user_data = json.loads(fields["user"])
        telegram_user_id = int(user_data["id"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("Telegram authentication data is incomplete") from error

    current_time = int(time.time()) if now is None else now
    if auth_date > current_time + 60 or current_time - auth_date > 86_400:
        raise ValueError("Telegram authentication data has expired")

    return telegram_user_id, user_data
