PREMIUM_CHANNEL_IDS = {
    "NATURAL": "-1004479037964",
    "SOCIAL": "-1004342138729",
}


def is_telegram_member(status: str, is_member: bool = False) -> bool:
    return status in {"member", "administrator", "creator"} or (
        status == "restricted" and is_member
    )
