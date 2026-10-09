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
  const tg = getTelegramWebApp();
  const initData = tg?.initData || "";
  console.log("Telegram WebApp initData:", initData ? `Present (${initData.length} chars)` : "Missing");
  console.log("Telegram WebApp object:", tg ? "Available" : "Not available");
  if (tg) {
    console.log("Telegram WebApp.initDataUnsafe:", tg.initDataUnsafe);
  }
  return initData;
}

export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  const user = tg?.initDataUnsafe?.user;
  if (user) {
    return user;
  }

  // Some Telegram clients omit initDataUnsafe.user while keeping the signed payload.
  const rawUser = new URLSearchParams(tg?.initData || "").get("user");
  if (rawUser) {
    try {
      const parsedUser = JSON.parse(rawUser) as TelegramUser;
      if (typeof parsedUser.id === "number" && parsedUser.id > 0) {
        return parsedUser;
      }
    } catch {
      // Let the caller show the normal Telegram-only error state.
    }
  }

  // Development fallback for explicitly supplied test parameters.
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user_id");
    const firstName = urlParams.get("first_name") || "Test User";
    if (userId) {
      return {
        id: Number(userId),
        first_name: firstName,
      };
    }
  }

  return null;
}

export function expandTelegramApp() {
  const tg = getTelegramWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
}
