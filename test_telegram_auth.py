import hashlib
import hmac
import json
import unittest
from urllib.parse import urlencode

from telegram_auth import validate_telegram_init_data


class TelegramInitDataTests(unittest.TestCase):
    def make_init_data(self, *, now=1_800_000_000):
        fields = {
            "auth_date": str(now),
            "query_id": "test-query",
            "user": json.dumps({"id": 12345, "first_name": "Student"}, separators=(",", ":")),
            "signature": "telegram-ed25519-signature",
        }
        data_check_string = "\n".join(
            f"{key}={value}"
            for key, value in sorted(fields.items())
        )
        secret_key = hmac.new(b"WebAppData", b"test-token", hashlib.sha256).digest()
        fields["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        return urlencode(fields), now

    def test_valid_init_data_includes_query_id_and_signature(self):
        init_data, now = self.make_init_data()

        user_id, user_data = validate_telegram_init_data(init_data, "test-token", now)
        self.assertEqual(user_id, 12345)
        self.assertEqual(user_data["first_name"], "Student")

    def test_signature_field_is_included_in_hmac_validation(self):
        init_data, now = self.make_init_data()
        init_data = init_data.replace(
            "telegram-ed25519-signature",
            "different-telegram-signature",
        )

        with self.assertRaisesRegex(ValueError, "invalid"):
            validate_telegram_init_data(init_data, "test-token", now)[0]

    def test_tampered_init_data_is_rejected(self):
        init_data, now = self.make_init_data()
        init_data = init_data.replace("test-query", "other-query")

        with self.assertRaisesRegex(ValueError, "invalid"):
            validate_telegram_init_data(init_data, "test-token", now)[0]

    def test_hash_from_wrong_bot_token_is_rejected(self):
        init_data, now = self.make_init_data()

        with self.assertRaisesRegex(ValueError, "invalid"):
            validate_telegram_init_data(init_data, "another-token", now)[0]

    def test_signature_without_valid_hash_is_rejected(self):
        init_data, now = self.make_init_data()
        init_data = "&".join(part for part in init_data.split("&") if not part.startswith("hash="))

        with self.assertRaisesRegex(ValueError, "missing"):
            validate_telegram_init_data(init_data, "test-token", now)[0]

    def test_expired_init_data_is_rejected(self):
        init_data, now = self.make_init_data(now=1_700_000_000)

        with self.assertRaisesRegex(ValueError, "expired"):
            validate_telegram_init_data(init_data, "test-token", now=now + 86_401)[0]


if __name__ == "__main__":
    unittest.main()
