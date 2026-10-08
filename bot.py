import asyncio
import os
from aiogram import Bot, Dispatcher
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)
from aiogram.filters import CommandStart, Command
from sqlalchemy.future import select
from sqlalchemy import func
from aiohttp import web

from database import AsyncSessionLocal, init_db
from models import User, EueeExam, Note

BOT_TOKEN = os.getenv("BOT_TOKEN", "8939756135:AAF0ELtBCbJmn-W1yrFATdnj3fXhQRmPS7k")
ADMIN_ID = int(os.getenv("ADMIN_ID", "1439864634"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://freshman-web.onrender.com/tma")
ADMIN_URL = os.getenv("ADMIN_URL", "https://freshman-web.onrender.com/admin")
SUPPORT_URL = "https://t.me/Mirkuz_support"

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


def get_app_button(is_admin: bool = False):
    buttons = [
        [InlineKeyboardButton(text="📚 Study for Final/mid exam", web_app=WebAppInfo(url=MINI_APP_URL))],
    ]
    if is_admin:
        buttons.append([InlineKeyboardButton(text="📝 Admin Dashboard", web_app=WebAppInfo(url=ADMIN_URL))])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Admin Dashboard", web_app=WebAppInfo(url=ADMIN_URL))],
        [InlineKeyboardButton(text="📊 View Stats", callback_data="admin_stats")],
    ])


@dp.message(CommandStart())
async def cmd_start(message: Message):
    await message.answer(
        "👋 Welcome to Mirkuz!\n\n"
        "Register or get support by contacting our Telegram support account:\n"
        f"{SUPPORT_URL}\n\n"
        "Then open the Freshman study app below.",
        reply_markup=get_app_button(message.from_user.id == ADMIN_ID),
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


async def configure_menu_buttons():
    await bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="Study for Final/mid exam",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )
    )
    await bot.set_chat_menu_button(
        chat_id=ADMIN_ID,
        menu_button=MenuButtonWebApp(
            text="Admin Dashboard",
            web_app=WebAppInfo(url=ADMIN_URL),
        ),
    )


async def main():
    await init_db()
    runner = await start_http_server()
    await bot.delete_webhook(drop_pending_updates=False)
    await configure_menu_buttons()
    print("Telegram webhook cleared; starting polling")
    polling_task = asyncio.create_task(dp.start_polling(bot))
    try:
        await polling_task
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
