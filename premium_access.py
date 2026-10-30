import os

PREMIUM_CHANNEL_IDS = {
    "NATURAL": os.getenv("PREMIUM_CHANNEL_NATURAL_ID", "-1004479037964"),
    "SOCIAL": os.getenv("PREMIUM_CHANNEL_SOCIAL_ID", "-1004342138729"),
}

# Temporary rollout switch. Set to False in the backend and frontend to restore
# Telegram channel membership enforcement.
PREMIUM_ACCESS_FREE = os.getenv("PREMIUM_ACCESS_FREE", "false").lower() == "true"


def requires_premium_device_session(is_premium: bool) -> bool:
    return is_premium and not PREMIUM_ACCESS_FREE


def is_telegram_member(status: str, is_member: bool = False) -> bool:
    return status in {"member", "administrator", "creator"} or (
        status == "restricted" and is_member
    )
