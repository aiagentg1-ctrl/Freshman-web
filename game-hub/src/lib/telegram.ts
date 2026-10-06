export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function getTelegramWebApp(): any {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData || "";
}

export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  console.log("getTelegramUser - tg:", tg);
  console.log("getTelegramUser - initDataUnsafe:", tg?.initDataUnsafe);
  console.log("getTelegramUser - user:", tg?.initDataUnsafe?.user);

  // Try to get user from Telegram WebApp
  const user = tg?.initDataUnsafe?.user;
  if (user) {
    console.log("getTelegramUser - returning user from Telegram:", user);
    return user;
  }

  // Fallback: try to get user from URL parameters (for testing/debugging)
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user_id");
    const firstName = urlParams.get("first_name") || "Test User";
    if (userId) {
      console.log("getTelegramUser - returning user from URL params:", { id: Number(userId), first_name: firstName });
      return {
        id: Number(userId),
        first_name: firstName,
      };
    }
  }

  console.log("getTelegramUser - no user found");
  return null;
}

export function expandTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
}
