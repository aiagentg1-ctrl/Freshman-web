import asyncio
import os
from aiogram import Bot, Dispatcher
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import CommandStart, Command
from sqlalchemy.future import select
from sqlalchemy import func
from aiohttp import web

from database import AsyncSessionLocal, init_db
from models import User, EueeExam, Note

BOT_TOKEN = os.getenv("BOT_TOKEN", "8939756135:AAF0ELtBCbJmn-W1yrFATdnj3fXhQRmPS7k")
ADMIN_ID = int(os.getenv("ADMIN_ID", "1439864634"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://mirkuz-grade9-12bot.vercel.app/tma")
ADMIN_URL = os.getenv("ADMIN_URL", "https://mirkuz-grade9-12bot.vercel.app/admin")

# Users must be members of BOTH channels before the Mini App is unlocked.
# Override any of these via environment variables in production.
REQUIRED_CHANNELS = [
    {
        "id": os.getenv("CHANNEL_1_ID", "-1002656898914"),
        "url": os.getenv("CHANNEL_1_URL", "https://t.me/AAU101"),
        "name": os.getenv("CHANNEL_1_NAME", "AAU101"),
    },
    {
        "id": os.getenv("CHANNEL_2_ID", "-1002435524867"),
        "url": os.getenv("CHANNEL_2_URL", "https://t.me/NextGen_12"),
        "name": os.getenv("CHANNEL_2_NAME", "NextGen 12"),
    },
]

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


async def get_missing_channels(user_id: int) -> list:
    missing = []
    for channel in REQUIRED_CHANNELS:
        try:
            member = await bot.get_chat_member(chat_id=int(channel["id"]), user_id=user_id)
            if member.status not in ["member", "administrator", "creator"]:
                missing.append(channel)
        except Exception:
            missing.append(channel)
    return missing


def get_join_keyboard():
    buttons = [
        [InlineKeyboardButton(text=f"📢 Join {channel['name']}", url=channel["url"])]
        for channel in REQUIRED_CHANNELS
    ]
    buttons.append([InlineKeyboardButton(text="✅ Verify & Continue", callback_data="verify_membership")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_app_button():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📚 Study for Final/mid exam", web_app=WebAppInfo(url=MINI_APP_URL))],
    ])


def get_admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Admin Dashboard", web_app=WebAppInfo(url=ADMIN_URL))],
        [InlineKeyboardButton(text="📊 View Stats", callback_data="admin_stats")],
    ])


@dp.message(CommandStart())
async def cmd_start(message: Message):
    # No profile questions in chat — setup lives entirely inside the Mini App.
    missing = await get_missing_channels(message.from_user.id)
    if missing:
        await message.answer(
            "👋 Welcome to Mirkuz!\n\n"
            "Before you can open the app, please join BOTH of our channels:",
            reply_markup=get_join_keyboard(),
        )
        return

    await message.answer(
        "🎓 Welcome to Mirkuz — your final and mid exam study companion!\n\n"
        "Study with real past exams and read chapter notes for Grades 9–12, "
        "all inside the app. Tap below to begin:",
        reply_markup=get_app_button(),
    )


@dp.callback_query(lambda c: c.data == "verify_membership")
async def verify_membership(callback: CallbackQuery):
    missing = await get_missing_channels(callback.from_user.id)
    if missing:
        names = " and ".join(f"@{ch['url'].rstrip('/').split('/')[-1]}" for ch in missing)
        await callback.answer(f"You still need to join {names}!", show_alert=True)
        return

    await callback.answer("✅ Verified!")
    await callback.message.edit_text(
        "✅ Membership verified!\n\n"
        "🎓 Mirkuz — EUEE exam prep for Grades 9–12.\n"
        "Tap below to open the app and start practicing:",
        reply_markup=get_app_button(),
    )


@dp.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ You don't have permission to access admin features.")
        return
    await message.answer("🔧 Admin Panel", reply_markup=get_admin_menu())


@dp.callback_query(lambda c: c.data == "admin_stats")
async def admin_stats(callback: CallbackQuery):
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("⛔ Access denied", show_alert=True)
        return

    async with AsyncSessionLocal() as session:
        total_users = (await session.execute(select(func.count()).select_from(User))).scalar() or 0
        total_exams = (await session.execute(select(func.count()).select_from(EueeExam))).scalar() or 0
        total_notes = (await session.execute(select(func.count()).select_from(Note))).scalar() or 0

    stats_text = (
        "📊 **Admin Statistics**\n\n"
        f"👥 Students: {total_users}\n"
        f"📝 EUEE Exams: {total_exams}\n"
        f"📚 Notes Chapters: {total_notes}"
    )
    await callback.message.edit_text(stats_text, reply_markup=get_admin_menu(), parse_mode="Markdown")


# HTTP server for Render health checks
async def health_check(request):
    return web.json_response({"status": "ok", "bot": "running"})


async def root_handler(request):
    return web.json_response({"status": "ok", "service": "mirkuz-telegram-bot"})


async def start_http_server():
    # Internal-only port: the public $PORT is served by uvicorn (app.py)
    # when both processes share one Render web service.
    port = int(os.getenv("BOT_INTERNAL_PORT", 8765))
    app = web.Application()
    app.router.add_get("/", root_handler)
    app.router.add_get("/health", health_check)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(f"HTTP server started on port {port}")
    return runner


async def main():
    await init_db()
    runner = await start_http_server()
    await bot.delete_webhook(drop_pending_updates=False)
    print("Telegram webhook cleared; starting polling")
    polling_task = asyncio.create_task(dp.start_polling(bot))
    try:
        await polling_task
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
