import os


PREMIUM_CHANNEL_IDS = {
    "NATURAL": "-1004479037964",
    "SOCIAL": "-1004342138729",
}


def premium_access_is_free(value: str | None = None) -> bool:
    setting = os.getenv("PREMIUM_ACCESS_FREE", "false") if value is None else value
    return setting.strip().casefold() in {"1", "true", "yes", "on"}


PREMIUM_ACCESS_FREE = premium_access_is_free()


def is_telegram_member(status: str, is_member: bool = False) -> bool:
    return status in {"member", "administrator", "creator"} or (
        status == "restricted" and is_member
    )
