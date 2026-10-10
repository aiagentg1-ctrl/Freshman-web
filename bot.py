import asyncio
import html
import json
import os
import re
from aiogram import Bot, Dispatcher
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)
from aiogram.filters import CommandStart, Command
from sqlalchemy.future import select
from sqlalchemy import and_, func, or_
from aiohttp import web

from database import AsyncSessionLocal, init_db
from models import ChapterExam, EueeExam, Note, StreamEnum, SubjectEnum, User

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is required")
ADMIN_ID = int(os.getenv("ADMIN_ID", "1439864634"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://freshman-web.onrender.com/tma")
ADMIN_URL = os.getenv("ADMIN_URL", "https://freshman-web.onrender.com/admin")
SUPPORT_URL = "https://t.me/Mirkuz_support"
PREMIUM_CHANNEL_IDS = {
    "NATURAL": os.getenv("NATURAL_SCIENCE_CHANNEL_ID", "-1004479037964"),
    "SOCIAL": os.getenv("SOCIAL_SCIENCE_CHANNEL_ID", "-1004342138729"),
}

NATURAL_SUBJECTS = {
    "logic", "psychology", "geography", "communicative_english", "mathematics",
    "physics", "emerging_technology", "anthropology", "history", "e_she",
}
SOCIAL_SUBJECTS = {
    "civics", "global_trends", "entrepreneurship", "economics", "anthropology",
    "geography", "communicative_english", "emerging_technology", "mathematics", "e_she",
}
SUBJECT_LABELS = {
    "logic": "Logic & Critical Thinking",
    "psychology": "Psychology",
    "geography": "Geography",
    "communicative_english": "Communicative English",
    "mathematics": "Freshman Mathematics",
    "physics": "Physics",
    "emerging_technology": "Emerging Technology",
    "anthropology": "Anthropology",
    "history": "History",
    "e_she": "e-SHE",
    "civics": "Civics",
    "global_trends": "Global Trends",
    "entrepreneurship": "Entrepreneurship",
    "economics": "Economics",
}

active_quizzes = {}

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


def get_app_button(is_admin: bool = False, include_exams: bool = False):
    buttons = [
        [InlineKeyboardButton(text="📚 Study for Final/mid exam", web_app=WebAppInfo(url=MINI_APP_URL))],
    ]
    if include_exams:
        buttons.append([InlineKeyboardButton(text="📝 Exams", callback_data="exams:home")])
    if is_admin:
        buttons.append([InlineKeyboardButton(text="📝 Admin Dashboard", web_app=WebAppInfo(url=ADMIN_URL))])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_student_menu(is_admin: bool = False):
    return get_app_button(is_admin, include_exams=True)


def get_admin_menu():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📝 Admin Dashboard", web_app=WebAppInfo(url=ADMIN_URL))],
        [InlineKeyboardButton(text="📊 View Stats", callback_data="admin_stats")],
    ])


def subject_options(stream):
    if stream == StreamEnum.NATURAL:
        return NATURAL_SUBJECTS
    if stream == StreamEnum.SOCIAL:
        return SOCIAL_SUBJECTS
    return set()


async def get_student_access(user_id: int):
    try:
        async with AsyncSessionLocal() as session:
            user = await session.get(User, user_id)
    except Exception as error:
        print(f"Could not load Telegram student profile: {error}")
        raise RuntimeError("Could not load your Fresho profile right now. Please try again.") from error
    if not user:
        return None, False, None
    if user.stream not in (StreamEnum.NATURAL, StreamEnum.SOCIAL):
        return user, False, None

    channel_id = PREMIUM_CHANNEL_IDS[user.stream.name]
    try:
        member = await bot.get_chat_member(channel_id, user_id)
    except Exception as error:
        print(f"Could not verify Telegram Premium membership: {error}")
        return user, False, "Could not verify Premium access right now. Please try again."
    is_premium = member.status in {"member", "administrator", "creator"} or (
        member.status == "restricted" and getattr(member, "is_member", False)
    )
    return user, is_premium, None


def exams_home_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📚 Exams", callback_data="exams:subjects")],
        [InlineKeyboardButton(text="⬅️ Main menu", callback_data="exams:menu")],
    ])


def subjects_keyboard(stream):
    subjects = sorted(subject_options(stream), key=lambda key: SUBJECT_LABELS.get(key, key).casefold())
    rows = [
        [InlineKeyboardButton(
            text=SUBJECT_LABELS.get(subject, subject.title()),
            callback_data=f"exams:subject:{subject}",
        )]
        for subject in subjects
    ]
    rows.append([InlineKeyboardButton(text="⬅️ Back", callback_data="exams:home")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def quiz_question_data(content: str):
    candidates = []
    script = re.search(
        r"<script[^>]*(?:id=[\"']exam-questions[\"']|data-exam-questions)[^>]*>(.*?)</script>",
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if script:
        candidates.append(script.group(1).strip())

    assignment = re.search(r"(?:window\.)?(?:__)?EXAM_QUESTIONS(?:__)?\s*=\s*", content)
    if assignment:
        start = content.find("[", assignment.end())
        if start >= 0:
            try:
                _, end = json.JSONDecoder().raw_decode(content[start:])
                candidates.append(content[start:start + end])
            except json.JSONDecodeError:
                pass

    stripped = content.strip()
    if stripped.startswith(("[", "{")):
        candidates.append(stripped)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        raw_questions = parsed.get("questions") if isinstance(parsed, dict) else parsed
        if isinstance(raw_questions, list):
            return raw_questions
    return []


def clean_question_text(value):
    text = re.sub(r"<[^>]*>", " ", str(value))
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def supported_quiz_questions(raw_questions):
    questions = []
    skipped = 0
    for index, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            skipped += 1
            continue
        question_type = str(raw.get("type", raw.get("question_type", raw.get("questionType", "")))).casefold()
        if any(marker in question_type for marker in ("match", "blank", "fill", "short", "essay")):
            skipped += 1
            continue

        text = raw.get("questionText", raw.get("question_text", raw.get("question", raw.get("text"))))
        options = raw.get("options", raw.get("choices", raw.get("answers")))
        if (
            any(key in raw for key in ("pairs", "matches", "matching_pairs", "left_column", "right_column"))
            or (
                isinstance(text, str)
                and (
                    re.search(r"_{2,}|\.{3,}", text)
                    or re.search(r"\bfill[- ]in[- ]the[- ]blank\b", text, re.I)
                )
            )
        ):
            skipped += 1
            continue
        answer = next(
            (
                raw[key]
                for key in (
                    "correctAnswer", "correct_answer", "correctIndex", "correct_index",
                    "answerIndex", "answer_index", "correctOption", "correct_option", "answer", "correct",
                )
                if key in raw
            ),
            None,
        )
        if not isinstance(text, str) or not text.strip() or not isinstance(options, list) or len(options) < 2:
            skipped += 1
            continue

        if isinstance(answer, str):
            answer_text = answer.strip()
            letter = re.fullmatch(r"(?:OPTION\s*)?([A-F])(?:[.)])?", answer_text, re.IGNORECASE)
            if letter:
                answer = ord(letter.group(1).upper()) - ord("A")
            elif answer_text.isdigit():
                answer = int(answer_text)
            else:
                answer = next(
                    (i for i, option in enumerate(options) if str(option).strip().casefold() == answer_text.casefold()),
                    -1,
                )
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < len(options):
            skipped += 1
            continue

        question_text = clean_question_text(text)
        questions.append({
            "id": raw.get("id", index + 1),
            "text": question_text[:3500],
            "options": [clean_question_text(option) for option in options],
            "answer": answer,
        })
    return questions, skipped


def quiz_answer_keyboard(user_id: int, question_index: int, options, selected=None, correct=None):
    rows = []
    for index, option in enumerate(options):
        label = clean_question_text(option)
        if len(label) > 52:
            label = label[:49].rstrip() + "..."
        if selected is not None and index == correct:
            label = f"✅ {label}"
        elif selected == index:
            label = f"❌ {label}"
        rows.append([InlineKeyboardButton(
            text=label,
            callback_data=f"quiz:answer:{user_id}:{question_index}:{index}",
        )])
    if selected is not None:
        rows.append([InlineKeyboardButton(text="Next ➡️", callback_data=f"quiz:next:{user_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def show_quiz_question(message, user_id: int, quiz):
    question = quiz["questions"][quiz["index"]]
    text = (
        f"{quiz['title']}\n"
        f"Question {quiz['index'] + 1}/{len(quiz['questions'])}\n\n"
        f"{question['text']}"
    )
    if quiz["skipped"]:
        text += f"\n\n({quiz['skipped']} matching, fill-in, or unsupported question(s) skipped)"
    await message.edit_text(
        text,
        reply_markup=quiz_answer_keyboard(user_id, quiz["index"], question["options"]),
    )


@dp.message(CommandStart())
async def cmd_start(message: Message):
    try:
        async with AsyncSessionLocal() as session:
            registered = await session.get(User, message.from_user.id) is not None
    except Exception as error:
        print(f"Could not load Telegram student profile: {error}")
        await message.answer("Could not load your Fresho profile right now. Please try again.")
        return

    if registered:
        await message.answer(
            "👋 Welcome back to Fresho!\n\n"
            "Open the study app or choose Exams below to start a chat-based quiz.",
            reply_markup=get_student_menu(message.from_user.id == ADMIN_ID),
        )
        return

    await message.answer(
        "👋 Welcome to Fresho!\n\n"
        "Register or get support by contacting our Telegram support account:\n"
        f"{SUPPORT_URL}\n\n"
        "Then open the Freshman study app below. Chat quizzes become available after registration.",
        reply_markup=get_app_button(message.from_user.id == ADMIN_ID),
    )


@dp.message(Command("admin"))
async def cmd_admin(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ You don't have permission to access admin features.")
        return
    await message.answer("🔧 Admin Panel", reply_markup=get_admin_menu())


@dp.callback_query(lambda c: c.data and c.data.startswith("exams:"))
async def exams_navigation(callback: CallbackQuery):
    if not callback.message:
        await callback.answer()
        return
    if callback.message.chat.type != "private":
        await callback.answer("Chat quizzes are available in a private chat with Fresho.", show_alert=True)
        return

    try:
        student, is_premium, premium_error = await get_student_access(callback.from_user.id)
    except RuntimeError as error:
        await callback.answer(str(error), show_alert=True)
        return

    if not student:
        await callback.answer("Register in the Fresho study app before using chat quizzes.", show_alert=True)
        return

    data = callback.data or ""
    if data == "exams:menu":
        await callback.message.edit_text(
            "Choose how you want to study:",
            reply_markup=get_student_menu(callback.from_user.id == ADMIN_ID),
        )
        await callback.answer()
        return
    if data in {"exams:home", "exams:subjects"}:
        if data == "exams:subjects":
            await callback.message.edit_text(
                "Choose a subject for your stream:",
                reply_markup=subjects_keyboard(student.stream),
            )
        else:
            await callback.message.edit_text(
                "Choose Exams to browse yearly papers or chapter quizzes.",
                reply_markup=exams_home_keyboard(),
            )
        await callback.answer()
        return

    parts = data.split(":")
    if len(parts) == 3 and parts[1] == "subject":
        subject = parts[2]
        if subject not in subject_options(student.stream):
            await callback.answer("That subject is not available for your stream.", show_alert=True)
            return
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📅 Yearly exams", callback_data=f"exams:yearly:{subject}")],
            [InlineKeyboardButton(text="📖 By chapter", callback_data=f"exams:chapters:{subject}")],
            [InlineKeyboardButton(text="⬅️ Subjects", callback_data="exams:subjects")],
        ])
        await callback.message.edit_text(
            f"{SUBJECT_LABELS.get(subject, subject.title())}\nChoose yearly exams or chapter quizzes:",
            reply_markup=keyboard,
        )
        await callback.answer()
        return

    if len(parts) in {3, 4} and parts[1] in {"yearly", "chapters"}:
        kind, subject = parts[1], parts[2]
        page = int(parts[3]) if len(parts) == 4 and parts[3].isdigit() else 0
        if len(parts) == 4 and not parts[3].isdigit():
            await callback.answer("Invalid page.", show_alert=True)
            return
        if subject not in subject_options(student.stream):
            await callback.answer("That subject is not available for your stream.", show_alert=True)
            return
        if kind == "yearly" and premium_error:
            await callback.answer(premium_error, show_alert=True)
            return
        if kind == "yearly" and not is_premium:
            await callback.message.edit_text(
                "Yearly exam quizzes are for Premium students. Chapter 1 quizzes remain free.\n"
                "Open the study app to learn about Premium access.",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="📚 Open Fresho", web_app=WebAppInfo(url=MINI_APP_URL))],
                    [InlineKeyboardButton(text="⬅️ Back", callback_data=f"exams:subject:{subject}")],
                ]),
            )
            await callback.answer()
            return

        try:
            async with AsyncSessionLocal() as session:
                if kind == "yearly":
                    result = await session.execute(
                        select(EueeExam).where(
                            EueeExam.subject == SubjectEnum[subject.upper()],
                            EueeExam.is_published == True,
                        )
                    )
                    materials = result.scalars().all()
                    materials.sort(key=lambda exam: (exam.title.casefold(), exam.year.casefold()))
                else:
                    chapter_query = (
                        select(ChapterExam)
                        .outerjoin(Note, ChapterExam.note_id == Note.id)
                        .where(
                            ChapterExam.subject == SubjectEnum[subject.upper()],
                            ChapterExam.is_published == True,
                            or_(
                                ChapterExam.stream == student.stream,
                                and_(
                                    ChapterExam.stream.is_(None),
                                    or_(Note.stream == student.stream, Note.stream.is_(None)),
                                ),
                            ),
                        )
                    )
                    if not is_premium:
                        chapter_query = chapter_query.where(ChapterExam.chapter_number == 1)
                    result = await session.execute(
                        chapter_query.order_by(ChapterExam.chapter_number, ChapterExam.title)
                    )
                    materials = result.scalars().all()
        except Exception as error:
            print(f"Could not load Telegram exam list: {error}")
            await callback.answer("Could not load exams right now. Please try again.", show_alert=True)
            return

        if not materials:
            description = (
                "No yearly exams are available for this subject yet."
                if kind == "yearly"
                else "No Chapter 1 quizzes are available for this subject yet."
            )
            await callback.message.edit_text(description, reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="⬅️ Back", callback_data=f"exams:subject:{subject}")],
                [InlineKeyboardButton(text="📚 Open Fresho", web_app=WebAppInfo(url=MINI_APP_URL))],
            ]))
            await callback.answer()
            return

        page_size = 90
        page_count = (len(materials) + page_size - 1) // page_size
        page = min(page, page_count - 1)
        start = page * page_size
        rows = []
        for material in materials[start:start + page_size]:
            if kind == "yearly":
                title = f"{material.title} · {material.year}"
                callback_data = f"quiz:start:e:{material.id}"
            else:
                title = f"Chapter {material.chapter_number} · {material.title}"
                callback_data = f"quiz:start:c:{material.id}"
            if len(title) > 58:
                title = title[:55].rstrip() + "..."
            rows.append([InlineKeyboardButton(text=title, callback_data=callback_data)])
        if page_count > 1:
            page_buttons = []
            if page > 0:
                page_buttons.append(InlineKeyboardButton(
                    text="⬅️ Previous",
                    callback_data=f"exams:{kind}:{subject}:{page - 1}",
                ))
            if page + 1 < page_count:
                page_buttons.append(InlineKeyboardButton(
                    text="Next ➡️",
                    callback_data=f"exams:{kind}:{subject}:{page + 1}",
                ))
            rows.append(page_buttons)
        rows.append([InlineKeyboardButton(text="⬅️ Back", callback_data=f"exams:subject:{subject}")])
        note = "\nOnly interactive multiple-choice questions are included here. Matching, fill-in-the-blank, and PDF materials can be opened in the study app."
        await callback.message.edit_text(
            f"{SUBJECT_LABELS.get(subject, subject.title())} · "
            f"{'Yearly exams' if kind == 'yearly' else 'Chapter quizzes'}{note}",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
        )
        await callback.answer()
        return

    await callback.answer("This menu has expired. Please open Exams again.", show_alert=True)


@dp.callback_query(lambda c: c.data and c.data.startswith("quiz:start:"))
async def start_chat_quiz(callback: CallbackQuery):
    if not callback.message:
        await callback.answer()
        return
    if callback.message.chat.type != "private":
        await callback.answer("Chat quizzes are available in a private chat with Fresho.", show_alert=True)
        return
    try:
        student, is_premium, premium_error = await get_student_access(callback.from_user.id)
    except RuntimeError as error:
        await callback.answer(str(error), show_alert=True)
        return
    if not student:
        await callback.answer("Register in the Fresho study app before using quizzes.", show_alert=True)
        return

    parts = (callback.data or "").split(":")
    if len(parts) != 4 or parts[2] not in {"e", "c"} or not parts[3].isdigit():
        await callback.answer("Invalid quiz selection.", show_alert=True)
        return
    kind, material_id = parts[2], int(parts[3])
    async with AsyncSessionLocal() as session:
        if kind == "e":
            if premium_error:
                await callback.answer(premium_error, show_alert=True)
                return
            if not is_premium:
                await callback.answer("Yearly exam quizzes require Premium.", show_alert=True)
                return
            material = await session.get(EueeExam, material_id)
            if not material or not material.is_published:
                await callback.answer("This exam is not available.", show_alert=True)
                return
            if material.subject.value not in subject_options(student.stream):
                await callback.answer("This subject is not available for your stream.", show_alert=True)
                return
            title = f"{material.title} · {material.year}"
            content = material.content_data if material.content_type == "html" else ""
        else:
            material = await session.get(ChapterExam, material_id)
            if not material or not material.is_published:
                await callback.answer("This chapter quiz is not available.", show_alert=True)
                return
            if material.chapter_number != 1 and not is_premium:
                if premium_error:
                    await callback.answer(premium_error, show_alert=True)
                    return
                await callback.answer("Only Chapter 1 is free. Other chapters require Premium.", show_alert=True)
                return
            if material.subject.value not in subject_options(student.stream):
                await callback.answer("This subject is not available for your stream.", show_alert=True)
                return
            material_stream = material.stream
            if material_stream and material_stream != student.stream:
                await callback.answer("This quiz is for another science stream.", show_alert=True)
                return
            if material_stream is None and material.note_id is not None:
                linked_note = await session.get(Note, material.note_id)
                if linked_note and linked_note.stream and linked_note.stream != student.stream:
                    await callback.answer("This quiz is for another science stream.", show_alert=True)
                    return
            title = f"Chapter {material.chapter_number} · {material.title}"
            content = material.content_data

    raw_questions = quiz_question_data(content)
    questions, skipped = supported_quiz_questions(raw_questions)
    if not questions:
        explanation = (
            "This is a PDF/material that cannot run as an inline chat quiz."
            if not content
            else "This material has no multiple-choice questions that the chat quiz can run. "
            "Matching and fill-in-the-blank questions are not converted into multiple choice."
        )
        await callback.message.edit_text(
            f"{explanation} Open it in the study app to view the full material.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📚 Open Fresho", web_app=WebAppInfo(url=MINI_APP_URL))],
                [InlineKeyboardButton(text="⬅️ Back to exams", callback_data="exams:home")],
            ]),
        )
        await callback.answer()
        return

    key = (callback.message.chat.id, callback.from_user.id)
    active_quizzes[key] = {
        "title": title,
        "questions": questions,
        "index": 0,
        "score": 0,
        "answered": False,
        "skipped": skipped,
    }
    if skipped:
        await callback.answer(f"{skipped} unsupported question(s) will be skipped.")
    else:
        await callback.answer()
    await show_quiz_question(callback.message, callback.from_user.id, active_quizzes[key])


@dp.callback_query(lambda c: c.data and c.data.startswith("quiz:answer:"))
async def answer_chat_quiz(callback: CallbackQuery):
    if not callback.message:
        await callback.answer()
        return
    parts = (callback.data or "").split(":")
    if len(parts) != 5 or not all(part.isdigit() for part in parts[2:]):
        await callback.answer("Invalid quiz answer.", show_alert=True)
        return
    owner_id, question_index, selected = map(int, parts[2:])
    if owner_id != callback.from_user.id:
        await callback.answer("This quiz belongs to another student.", show_alert=True)
        return
    quiz = active_quizzes.get((callback.message.chat.id, owner_id))
    if not quiz or quiz["index"] != question_index or quiz["answered"]:
        await callback.answer("This question has expired.", show_alert=True)
        return
    question = quiz["questions"][question_index]
    if selected >= len(question["options"]):
        await callback.answer("Invalid answer.", show_alert=True)
        return
    quiz["answered"] = True
    if selected == question["answer"]:
        quiz["score"] += 1
        feedback = "Correct! ✅"
    else:
        feedback = "Not quite. The correct answer is highlighted below."
    await callback.message.edit_text(
        f"{quiz['title']}\nQuestion {question_index + 1}/{len(quiz['questions'])}\n\n"
        f"{question['text']}\n\n{feedback}",
        reply_markup=quiz_answer_keyboard(
            owner_id, question_index, question["options"],
            selected=selected, correct=question["answer"],
        ),
    )
    await callback.answer()


@dp.callback_query(lambda c: c.data and c.data.startswith("quiz:next:"))
async def next_chat_quiz_question(callback: CallbackQuery):
    if not callback.message:
        await callback.answer()
        return
    parts = (callback.data or "").split(":")
    if len(parts) != 3 or not parts[2].isdigit() or int(parts[2]) != callback.from_user.id:
        await callback.answer("This quiz belongs to another student.", show_alert=True)
        return
    owner_id = int(parts[2])
    key = (callback.message.chat.id, owner_id)
    quiz = active_quizzes.get(key)
    if not quiz or not quiz["answered"]:
        await callback.answer("Answer the current question first.", show_alert=True)
        return
    quiz["index"] += 1
    quiz["answered"] = False
    if quiz["index"] >= len(quiz["questions"]):
        score = quiz["score"]
        total = len(quiz["questions"])
        skipped = quiz["skipped"]
        del active_quizzes[key]
        await callback.message.edit_text(
            f"Quiz complete! 🎉\n{quiz['title']}\n\n"
            f"Your practice score: {score}/{total} ({round(score / total * 100)}%).\n"
            "This chat quiz is practice-only; it does not save an attempt or award XP."
            + (f"\n{skipped} unsupported question(s) were skipped." if skipped else ""),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📝 More exams", callback_data="exams:home")],
                [InlineKeyboardButton(text="📚 Open Fresho", web_app=WebAppInfo(url=MINI_APP_URL))],
            ]),
        )
    else:
        await show_quiz_question(callback.message, owner_id, quiz)
    await callback.answer()


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
    return web.json_response({"status": "ok", "service": "fresho"})


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
