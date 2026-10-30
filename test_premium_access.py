import unittest
from unittest.mock import patch

from premium_access import (
    PREMIUM_ACCESS_FREE,
    PREMIUM_CHANNEL_IDS,
    is_telegram_member,
    requires_premium_device_session,
)


class PremiumAccessTests(unittest.TestCase):
    def test_premium_channel_ids_are_fixed_to_configured_channels(self):
        self.assertEqual(
            PREMIUM_CHANNEL_IDS,
            {
                "NATURAL": "-1004479037964",
                "SOCIAL": "-1004342138729",
            },
        )

    def test_member_statuses_grant_premium(self):
        for status in ("member", "administrator", "creator"):
            with self.subTest(status=status):
                self.assertTrue(is_telegram_member(status))

    def test_restricted_status_requires_is_member(self):
        self.assertTrue(is_telegram_member("restricted", is_member=True))
        self.assertFalse(is_telegram_member("restricted", is_member=False))

    def test_non_member_statuses_do_not_grant_premium(self):
        for status in ("left", "kicked", "unknown"):
            with self.subTest(status=status):
                self.assertFalse(is_telegram_member(status))

    def test_temporary_free_access_is_enabled_for_everyone(self):
        self.assertTrue(PREMIUM_ACCESS_FREE)

    def test_temporary_free_access_does_not_require_a_premium_device_session(self):
        self.assertFalse(requires_premium_device_session(is_premium=True))
        self.assertFalse(requires_premium_device_session(is_premium=False))

    def test_premium_device_session_is_required_when_free_access_is_disabled(self):
        with patch("premium_access.PREMIUM_ACCESS_FREE", False):
            self.assertTrue(requires_premium_device_session(is_premium=True))
            self.assertFalse(requires_premium_device_session(is_premium=False))


if __name__ == "__main__":
    unittest.main()
