import unittest

from premium_access import PREMIUM_CHANNEL_IDS, is_telegram_member, premium_access_is_free


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

    def test_temporary_free_access_flag_accepts_explicit_true_values(self):
        for value in ("true", "TRUE", "1", "yes", "on"):
            with self.subTest(value=value):
                self.assertTrue(premium_access_is_free(value))

    def test_temporary_free_access_flag_can_be_disabled(self):
        for value in ("false", "0", "no", "off", ""):
            with self.subTest(value=value):
                self.assertFalse(premium_access_is_free(value))


if __name__ == "__main__":
    unittest.main()
