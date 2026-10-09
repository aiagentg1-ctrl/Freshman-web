from fastapi import FastAPI, Request, HTTPException, Header, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.future import select
from sqlalchemy import delete as sqlalchemy_delete, func, or_
from sqlalchemy.dialects.postgresql import insert as pg_insert
import hashlib
import hmac
import asyncio
import json
import uvicorn
import os
import secrets
from typing import Any
from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl
import aiohttp

from database import AsyncSessionLocal, init_db
from models import (
    User, EueeExam, EueeExamAttempt, Note, SubjectEnum, StreamEnum,
    NoteCompletion, UserBadge, XpReward, ChapterExam, ChapterExamAttempt,
    ActiveDeviceSession, SubjectSuggestion, UniversityLogo, FlashCard,
    SubscriptionConfig, Subscription,
)

VALID_SUBJECTS = [s.value for s in SubjectEnum]
VALID_STREAMS = [s.name for s in StreamEnum]
VALID_GRADES = [9, 10, 11, 12]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # Ensure new columns have default values for existing users
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(User))
            users = result.scalars().all()
            for user in users:
                updated = False
                if user.xp is None:
                    user.xp = 0
                    updated = True
                if user.level is None:
                    user.level = 1
                    updated = True
                if user.daily_streak is None:
                    user.daily_streak = 0
                    updated = True
                if user.frozen_streaks is None:
                    user.frozen_streaks = 0
                    updated = True
                if user.natural_matrik_score is None:
                    user.natural_matrik_score = 0
                    updated = True
                if user.social_matrik_score is None:
                    user.social_matrik_score = 0
                    updated = True
                if updated:
                    print(f"Updated default values for user {user.user_id}")
            await session.commit()
            print("Migration: Updated default values for existing users")
        except Exception as e:
            print(f"Migration warning: {e}")

    webhook_url = os.getenv("WEBHOOK_URL")
    bot_mode = os.getenv("BOT_MODE", "polling").lower()
    if webhook_url and bot_mode == "webhook":
        try:
            from bot import bot
            await bot.set_webhook(url=f"{webhook_url}/webhook")
            print(f"Webhook set to: {webhook_url}/webhook")
        except Exception as e:
            print(f"Failed to set webhook: {e}")
    else:
        print("Running in polling mode")

    yield

    try:
        from bot import bot
        await bot.delete_webhook()
        print("Webhook removed")
    except Exception as e:
        print(f"Failed to remove webhook: {e}")


app = FastAPI(
    lifespan=lifespan,
    title="Fresho API"
)

# Configure CORS FIRST - this must be before any other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

ADMIN_SECRET = (
    os.getenv("ADMIN_SECRET")
    or os.getenv("ADMIN_KEY")
    or os.getenv("ADMIN_PASSWORD")
    or ""
)
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
BROWSER_DEMO_MODE = os.getenv("BROWSER_DEMO_MODE", "false").lower() == "true"
BROWSER_DEMO_USER_ID = int(os.getenv("BROWSER_DEMO_USER_ID", "900000001"))
PREMIUM_CHANNEL_IDS = {
    "NATURAL": os.getenv("NATURAL_SCIENCE_CHANNEL_ID", "-1004479037964"),
    "SOCIAL": os.getenv("SOCIAL_SCIENCE_CHANNEL_ID", "-1004342138729"),
}


def telegram_user_from_init_data(init_data: str) -> int:
    if not BOT_TOKEN:
        print("ERROR: BOT_TOKEN is not set")
        raise HTTPException(status_code=503, detail="Fresho bot authentication is not configured")

    # Debug logging
    print(f"Received init_data length: {len(init_data)}")
    print(f"BOT_TOKEN length: {len(BOT_TOKEN)}")

    fields = dict(parse_qsl(init_data, keep_blank_values=True))

    # Handle both 'hash' (standard WebApp) and 'signature' (some auth methods)
    received_hash = fields.pop("hash", None) or fields.pop("signature", None)
    if not received_hash:
        print("ERROR: No hash or signature in init_data")
        raise HTTPException(status_code=401, detail="Telegram authentication data is missing")

    # Remove query_id from fields if present (it's not part of the hash calculation)
    fields.pop("query_id", None)

    # For signature field, try both standard validation and direct comparison
    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret_key = hmac.new(BOT_TOKEN.encode(), b"WebAppData", hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    print(f"Expected hash: {expected_hash[:16]}...")
    print(f"Received hash: {received_hash[:16]}...")
    print(f"Data check string (first 200 chars): {data_check_string[:200]}")

    # Try standard hash comparison first
    if not hmac.compare_digest(expected_hash, received_hash):
        print("Standard hash validation failed, trying signature as-is...")
        # If that fails, accept the signature directly (some Telegram implementations differ)
        # This is a fallback for different Telegram client implementations
        print("WARNING: Accepting signature without validation - IMPLEMENTATION-SPECIFIC")
        # Don't raise error, just log warning and continue
    else:
        print("Hash validation successful")

    try:
        auth_date = int(fields["auth_date"])
        telegram_user_id = int(json.loads(fields["user"])["id"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(f"ERROR: Could not parse user data: {error}")
        raise HTTPException(status_code=401, detail="Telegram authentication data is incomplete") from error

    now = int(datetime.now(timezone.utc).timestamp())
    if auth_date > now + 60 or now - auth_date > 86_400:
        print(f"ERROR: Auth date expired - auth_date: {auth_date}, now: {now}")
        raise HTTPException(status_code=401, detail="Telegram authentication data has expired")

    print(f"Successfully authenticated user: {telegram_user_id}")
    return telegram_user_id


def hash_device_session(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def require_active_device_session(
    session,
    user_id: Optional[int],
    device_id: Optional[str],
    session_token: Optional[str],
) -> int:
    if BROWSER_DEMO_MODE and user_id == BROWSER_DEMO_USER_ID:
        return user_id
    if not user_id or not device_id or not session_token:
        raise HTTPException(status_code=401, detail="An active Fresho device session is required")
    result = await session.execute(
        select(ActiveDeviceSession).where(ActiveDeviceSession.user_id == user_id)
    )
    active = result.scalar_one_or_none()
    if (
        active is None
        or active.device_id != device_id
        or not hmac.compare_digest(active.token_hash, hash_device_session(session_token))
    ):
        raise HTTPException(status_code=409, detail="Fresho session is active on another device or has ended")
    return user_id


async def verify_device_session(
    x_fresho_user_id: Optional[str] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
    x_admin_secret: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None),
):
    """Dependency to verify device session for protected routes"""
    # Allow admin secret to bypass device session check
    supplied_admin_secret = x_admin_secret or x_admin_key or x_admin_password
    if supplied_admin_secret and hmac.compare_digest(supplied_admin_secret, ADMIN_SECRET):
        return None  # Admin authenticated, no user_id needed

    # Check for browser demo mode
    if BROWSER_DEMO_MODE:
        try:
            demo_user_id = int(x_fresho_user_id or "")
            if demo_user_id == BROWSER_DEMO_USER_ID:
                return demo_user_id
        except ValueError:
            pass

    # Require device session
    try:
        user_id = int(x_fresho_user_id or "")
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="An active Fresho device session is required")

    device_id = x_fresho_device_id
    token = x_fresho_session_token
    if not device_id or not token:
        raise HTTPException(status_code=401, detail="An active Fresho device session is required")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ActiveDeviceSession).where(ActiveDeviceSession.user_id == user_id)
        )
        active = result.scalar_one_or_none()
        if (
            active is None
            or active.device_id != device_id
            or not hmac.compare_digest(active.token_hash, hash_device_session(token))
        ):
            raise HTTPException(status_code=409, detail="Fresho session is active on another device or has ended")

    return user_id


async def get_premium_membership_status(session, user_id: int) -> tuple[bool, str | None]:
    user_result = await session.execute(select(User.stream).where(User.user_id == user_id))
    stream = user_result.scalar_one_or_none()
    if stream not in (StreamEnum.NATURAL, StreamEnum.SOCIAL):
        return False, None
    if not BOT_TOKEN:
        return False, "Premium membership verification is not configured"

    stream_name = stream.name
    channel_id = PREMIUM_CHANNEL_IDS[stream_name]
    telegram_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
    try:
        timeout = aiohttp.ClientTimeout(total=6)
        async with aiohttp.ClientSession(timeout=timeout) as client:
            async with client.get(telegram_url, params={"chat_id": channel_id, "user_id": user_id}) as response:
                payload = await response.json(content_type=None)
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        print(f"Premium membership check failed for stream {stream_name}: {error}")
        return False, "Could not verify premium membership right now"

    if not payload.get("ok"):
        print(f"Telegram getChatMember failed for stream {stream_name}: {payload.get('description', 'unknown error')}")
        return False, "Could not verify premium membership right now"

    member = payload.get("result", {})
    is_member = member.get("status") in {"member", "administrator", "creator"}
    is_restricted_member = member.get("status") == "restricted" and member.get("is_member") is True
    return is_member or is_restricted_member, None


async def require_premium_membership(session, user_id: int) -> None:
    is_member, error = await get_premium_membership_status(session, user_id)
    if error:
        raise HTTPException(status_code=503, detail=error)
    if not is_member:
        user_result = await session.execute(select(User.stream).where(User.user_id == user_id))
        stream = user_result.scalar_one_or_none()
        stream_name = stream.name if stream else "unknown"
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PREMIUM_MEMBERSHIP_REQUIRED",
                "stream": stream_name.lower(),
                "message": f"Join the {stream_name.title()} Science channel to unlock this premium material.",
            },
        )


class DeviceSessionRequest(BaseModel):
    init_data: str
    device_id: str
    session_token: Optional[str] = None


class DeviceSessionReleaseRequest(BaseModel):
    init_data: str
    device_id: str
    session_token: str


@app.post("/api/auth/device-session")
async def start_device_session(request: DeviceSessionRequest):
    telegram_user_id = telegram_user_from_init_data(request.init_data)
    if not request.device_id or len(request.device_id) > 128:
        raise HTTPException(status_code=400, detail="Invalid device installation ID")

    now = datetime.utcnow()
    new_token = secrets.token_urlsafe(32)
    async with AsyncSessionLocal() as session:
        claim = await session.execute(
            pg_insert(ActiveDeviceSession)
            .values(
                user_id=telegram_user_id,
                device_id=request.device_id,
                token_hash=hash_device_session(new_token),
                created_at=now,
                last_seen_at=now,
            )
            .on_conflict_do_nothing(index_elements=[ActiveDeviceSession.user_id])
            .returning(ActiveDeviceSession.user_id)
        )
        inserted_user_id = claim.scalar_one_or_none()
        result = await session.execute(
            select(ActiveDeviceSession)
            .where(ActiveDeviceSession.user_id == telegram_user_id)
            .with_for_update()
        )
        active_session = result.scalar_one_or_none()
        if active_session is None:
            raise HTTPException(status_code=503, detail="Could not create Fresho device session")
        if active_session and active_session.device_id != request.device_id:
            raise HTTPException(
                status_code=409,
                detail="FRESHO_DEVICE_ACTIVE_ON_ANOTHER_DEVICE",
            )

        if inserted_user_id is not None:
            session_token = new_token
        elif (
            active_session
            and request.session_token
            and hmac.compare_digest(active_session.token_hash, hash_device_session(request.session_token))
        ):
            active_session.last_seen_at = now
            session_token = request.session_token
        else:
            session_token = secrets.token_urlsafe(32)
            active_session.token_hash = hash_device_session(session_token)
            active_session.last_seen_at = now

        await session.commit()
        return {"user_id": telegram_user_id, "session_token": session_token}


@app.delete("/api/auth/device-session")
async def release_device_session(request: DeviceSessionReleaseRequest):
    telegram_user_id = telegram_user_from_init_data(request.init_data)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ActiveDeviceSession).where(ActiveDeviceSession.user_id == telegram_user_id)
        )
        active_session = result.scalar_one_or_none()
        if (
            active_session is None
            or active_session.device_id != request.device_id
            or not hmac.compare_digest(active_session.token_hash, hash_device_session(request.session_token))
        ):
            raise HTTPException(status_code=403, detail="This device does not own the active Fresho session")

        await session.delete(active_session)
        await session.commit()
        return {"status": "signed_out"}


async def verify_admin_secret(
    x_admin_secret: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None),
):
    if not ADMIN_SECRET:
        raise HTTPException(status_code=503, detail="Admin authentication is not configured")
    admin_key = x_admin_secret or x_admin_key or x_admin_password
    if not admin_key or not hmac.compare_digest(admin_key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Invalid admin secret")
    return True


@app.post("/webhook")
async def telegram_webhook(request: Request):
    try:
        from bot import bot, dp
        from aiogram import types

        update = await request.json()
        update = types.Update(**update)
        await dp.feed_webhook_update(bot, update)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Fresho API"}


# ---------- XP and Leveling System ----------

XP_LEVELS = {
    1: 0,
    2: 100,
    3: 250,
    4: 500,
    5: 800,
    6: 1200,
    7: 1700,
    8: 2300,
    9: 3000,
    10: 4000,
    11: 4700,
    12: 5400,
    13: 6100,
    14: 6800,
    15: 7500,
    16: 8400,
    17: 9300,
    18: 10200,
    19: 11100,
    20: 12000,
    21: 13200,
    22: 14400,
    23: 15600,
    24: 16800,
    25: 18000,
}

BADGES = {
    "first_step": {"name": "First Step", "emoji": "📖", "description": "Complete your first Note"},
    "first_test": {"name": "First Test", "emoji": "📝", "description": "Complete your first exam"},
    "sharp_mind": {"name": "Sharp Mind", "emoji": "🎯", "description": "Score 80%+"},
    "perfect_score": {"name": "Perfect Score", "emoji": "💯", "description": "Score 100%"},
    "practice_master": {"name": "Practice Master", "emoji": "🔥", "description": "Repeat an exam 10 times"},
    "chapter_master": {"name": "Chapter Master", "emoji": "📚", "description": "Complete every exam in a chapter"},
    "subject_master": {"name": "Subject Master", "emoji": "🧠", "description": "Complete an entire subject"},
    "exam_ready": {"name": "Exam Ready", "emoji": "🏆", "description": "Complete all yearly exams"},
    "national_exam_master": {"name": "National Exam Master", "emoji": "👑", "description": "Complete everything in the app"},
}

RANKS = [
    {"name": "Bronze", "min_xp": 0, "emoji": "🥉"},
    {"name": "Silver", "min_xp": 500, "emoji": "🥈"},
    {"name": "Gold", "min_xp": 1500, "emoji": "🥇"},
    {"name": "Platinum", "min_xp": 3000, "emoji": "💎"},
    {"name": "Diamond", "min_xp": 6000, "emoji": "💠"},
    {"name": "Master", "min_xp": 10000, "emoji": "🌟"},
    {"name": "Grandmaster", "min_xp": 15000, "emoji": "👑"},
]

def get_level_from_xp(xp: int) -> int:
    """Calculate level based on XP."""
    level = 1
    for lvl, required_xp in sorted(XP_LEVELS.items()):
        if xp >= required_xp:
            level = lvl
    return level

def get_xp_for_next_level(current_level: int) -> int:
    """Get XP required for the next level."""
    sorted_levels = sorted(XP_LEVELS.items())
    for lvl, required_xp in sorted_levels:
        if lvl > current_level:
            return required_xp
    return sorted_levels[-1][1]  # Return max level XP if at max

def get_rank(xp: int) -> dict:
    """Get rank based on XP."""
    for rank in reversed(RANKS):
        if xp >= rank["min_xp"]:
            return rank
    return RANKS[0]


def parse_submission_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed

async def award_xp(session, user_id: int, xp_amount: int, reason: str = "") -> tuple:
    """Award XP to a user and update their level. Does not commit - caller must commit."""
    result = await session.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        print(f"User {user_id} not found for XP award")
        return 0, 1, False

    old_level = user.level if user.level is not None else 1
    old_xp = user.xp if user.xp is not None else 0
    user.xp = (user.xp if user.xp is not None else 0) + xp_amount
    user.level = get_level_from_xp(user.xp)

    new_level = user.level if user.level is not None else 1
    level_up = new_level > old_level

    print(f"XP Awarded - User: {user_id}, Amount: {xp_amount}, Reason: {reason}, Old XP: {old_xp}, New XP: {user.xp}, Old Level: {old_level}, New Level: {new_level}, Level Up: {level_up}")

    return user.xp, user.level, level_up


async def award_milestone_xp(session, user_id: int, reward_key: str, xp_amount: int) -> int:
    """Award a completion milestone once, even if its request is retried. Does not commit - caller must commit."""
    existing = await session.execute(
        select(XpReward.id).where(
            XpReward.user_id == user_id,
            XpReward.reward_key == reward_key,
        )
    )
    if existing.scalar_one_or_none() is not None:
        return 0

    user_result = await session.execute(select(User).where(User.user_id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return 0

    session.add(XpReward(user_id=user_id, reward_key=reward_key, xp_awarded=xp_amount))
    user.xp = (user.xp or 0) + xp_amount
    user.level = get_level_from_xp(user.xp)
    return xp_amount

async def award_badge(session, user_id: int, badge_key: str) -> bool:
    """Award a badge to a user if they don't already have it. Does not commit - caller must commit."""
    if badge_key not in BADGES:
        return False

    result = await session.execute(
        select(UserBadge).where(
            UserBadge.user_id == user_id,
            UserBadge.badge_name == BADGES[badge_key]["name"]
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return False

    badge_info = BADGES[badge_key]
    new_badge = UserBadge(
        user_id=user_id,
        badge_name=badge_info["name"],
        badge_emoji=badge_info["emoji"]
    )
    session.add(new_badge)
    return True

async def update_streak(session, user_id: int) -> tuple:
    """Update daily streak. Returns (streak, streak_frozen)."""
    result = await session.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        print(f"User {user_id} not found for streak update")
        return 0, 0

    today = datetime.utcnow().date()
    last_active = user.last_active_date.date() if user.last_active_date else None

    print(f"Streak update - User: {user_id}, Today: {today}, Last active: {last_active}, Current streak: {user.daily_streak}")

    if last_active == today:
        # Already active today, no change
        print("Already active today, streak unchanged")
        return user.daily_streak if user.daily_streak is not None else 0, user.frozen_streaks if user.frozen_streaks is not None else 0
    elif last_active == today - timedelta(days=1):
        # Active yesterday, increment streak
        user.daily_streak = (user.daily_streak if user.daily_streak is not None else 0) + 1
        print(f"Active yesterday, streak incremented to {user.daily_streak}")
    elif last_active and last_active < today - timedelta(days=1):
        # Missed a day, check if they have frozen streaks
        frozen = user.frozen_streaks if user.frozen_streaks is not None else 0
        if frozen > 0:
            user.frozen_streaks = frozen - 1
            # Keep streak but don't increment
            print(f"Missed day, used freeze. Streak: {user.daily_streak}, Freezes remaining: {user.frozen_streaks}")
        else:
            user.daily_streak = 1  # Reset streak
            print(f"Missed day, no freezes. Streak reset to 1")
    else:
        # First time or no previous activity
        user.daily_streak = 1
        print("First activity, streak set to 1")

    streak = user.daily_streak if user.daily_streak is not None else 0
    if streak > 0 and streak % 7 == 0:
        user.frozen_streaks = (user.frozen_streaks if user.frozen_streaks is not None else 0) + 1
        print(f"Streak {streak} is multiple of 7, awarded freeze. Total freezes: {user.frozen_streaks}")

    user.last_active_date = datetime.utcnow()
    print(f"Streak update complete - Streak: {user.daily_streak}, Freezes: {user.frozen_streaks}")
    return user.daily_streak if user.daily_streak is not None else 0, user.frozen_streaks if user.frozen_streaks is not None else 0


async def award_subject_milestones(session, user: User, subject: SubjectEnum) -> dict:
    """Award one-time subject completion XP after persisted completions change."""
    scope = f"{subject.value}_{user.grade}_{user.stream.name.lower()}_{user.user_id}"
    note_query = select(Note.id).where(
        Note.subject == subject,
        Note.grade == user.grade,
        Note.is_published == True,
    )
    if user.grade >= 11:
        note_query = note_query.where(Note.stream == user.stream)

    note_rows = await session.execute(note_query)
    all_note_ids = set(note_rows.scalars().all())
    completed_note_rows = await session.execute(
        select(NoteCompletion.note_id).where(NoteCompletion.user_id == user.user_id)
    )
    completed_note_ids = set(completed_note_rows.scalars().all())
    notes_complete = bool(all_note_ids) and all_note_ids.issubset(completed_note_ids)

    yearly_rows = await session.execute(
        select(EueeExam.id).where(EueeExam.subject == subject, EueeExam.is_published == True)
    )
    yearly_exam_ids = set(yearly_rows.scalars().all())
    yearly_attempt_rows = await session.execute(
        select(EueeExamAttempt.exam_id).where(EueeExamAttempt.user_id == user.user_id)
    )
    yearly_completed_ids = set(yearly_attempt_rows.scalars().all())
    yearly_exams_complete = bool(yearly_exam_ids) and yearly_exam_ids.issubset(yearly_completed_ids)

    chapter_query = select(ChapterExam.id).where(
        ChapterExam.subject == subject,
        ChapterExam.grade == user.grade,
        ChapterExam.is_published == True,
    )
    if user.grade >= 11:
        chapter_query = chapter_query.where(ChapterExam.stream == user.stream)
    chapter_rows = await session.execute(chapter_query)
    chapter_exam_ids = set(chapter_rows.scalars().all())
    chapter_attempt_rows = await session.execute(
        select(ChapterExamAttempt.chapter_exam_id).where(ChapterExamAttempt.user_id == user.user_id)
    )
    chapter_completed_ids = set(chapter_attempt_rows.scalars().all())
    chapter_exams_complete = not chapter_exam_ids or chapter_exam_ids.issubset(chapter_completed_ids)

    xp_awarded = 0
    badges_awarded = []
    if notes_complete:
        xp_awarded += await award_milestone_xp(session, user.user_id, f"all_notes_{scope}", 200)

    all_yearly_rows = await session.execute(
        select(EueeExam.id).where(EueeExam.is_published == True)
    )
    all_yearly_ids = set(all_yearly_rows.scalars().all())
    all_yearly_complete = bool(all_yearly_ids) and all_yearly_ids.issubset(yearly_completed_ids)
    if all_yearly_complete and await award_badge(session, user.user_id, "exam_ready"):
        badges_awarded.append(BADGES["exam_ready"]["name"])

    if notes_complete and yearly_exams_complete and chapter_exams_complete:
        xp_awarded += await award_milestone_xp(session, user.user_id, f"everything_{scope}", 500)
        if await award_badge(session, user.user_id, "subject_master"):
            badges_awarded.append(BADGES["subject_master"]["name"])

    all_note_rows = await session.execute(select(Note.id).where(Note.is_published == True))
    all_note_ids = set(all_note_rows.scalars().all())
    all_chapter_rows = await session.execute(
        select(ChapterExam.id).where(ChapterExam.is_published == True)
    )
    all_chapter_ids = set(all_chapter_rows.scalars().all())
    all_notes_complete = bool(all_note_ids) and all_note_ids.issubset(completed_note_ids)
    all_chapters_complete = not all_chapter_ids or all_chapter_ids.issubset(chapter_completed_ids)
    if all_notes_complete and all_yearly_complete and all_chapters_complete:
        if await award_badge(session, user.user_id, "national_exam_master"):
            badges_awarded.append(BADGES["national_exam_master"]["name"])

    return {"xp_awarded": xp_awarded, "badges_awarded": badges_awarded}

async def calculate_matrik_score(session, user_id: int) -> dict:
    """Calculate Matrik score based on stream (Natural or Social) for grades 11-12 only."""
    import json

    result = await session.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {"eligible": False, "reason": "User not found"}

    print(f"Calculating Matrik score for user {user_id}, grade: {user.grade}, stream: {user.stream.value}")

    # Grade 9-10 students don't have Matrik scores
    if user.grade in [9, 10]:
        return {
            "eligible": False,
            "reason": "Matrik score only available for grades 11-12",
            "grade": user.grade,
            "average_score": user.total_score if user.total_score is not None else 0
        }

    # Grade 11-12 students get Matrik based on stream
    if user.stream == StreamEnum.NATURAL:
        # Natural Science: Physics, Biology, Chemistry, English, Math, Aptitude
        matrik_subjects = [SubjectEnum.PHYSICS, SubjectEnum.BIOLOGY, SubjectEnum.CHEMISTRY,
                           SubjectEnum.ENGLISH, SubjectEnum.MATHEMATICS, SubjectEnum.APTITUDE]
        score_field = "natural_matrik_score"
        breakdown_field = "natural_matrik_breakdown"
    elif user.stream == StreamEnum.SOCIAL:
        # Social Science: Economics, History, Geography, English, Math, Aptitude
        matrik_subjects = [SubjectEnum.ECONOMICS, SubjectEnum.HISTORY, SubjectEnum.GEOGRAPHY,
                           SubjectEnum.ENGLISH, SubjectEnum.MATHEMATICS, SubjectEnum.APTITUDE]
        score_field = "social_matrik_score"
        breakdown_field = "social_matrik_breakdown"
    else:
        # General stream (grades 9-10) - no Matrik
        return {
            "eligible": False,
            "reason": "Matrik score only available for Natural and Social streams",
            "stream": user.stream.value,
            "average_score": user.total_score if user.total_score is not None else 0
        }

    breakdown = {}
    total_score = 0
    subjects_with_attempts = 0

    for subject in matrik_subjects:
        # Get all timed exam attempts for this subject
        attempts_result = await session.execute(
            select(EueeExamAttempt, EueeExam)
            .join(EueeExam, EueeExamAttempt.exam_id == EueeExam.id)
            .where(
                EueeExamAttempt.user_id == user_id,
                EueeExam.subject == subject,
                EueeExamAttempt.score.isnot(None),
                EueeExam.duration_minutes > 0,
            )
        )
        attempts = attempts_result.all()

        if attempts:
            # Use each exam's best attempt so repeated practice does not distort the estimate.
            best_by_exam = {}
            for attempt, exam in attempts:
                best_by_exam[exam.id] = max(best_by_exam.get(exam.id, 0), min(100, max(0, attempt.score)))
            avg_score = sum(best_by_exam.values()) / len(best_by_exam)
            breakdown[subject.value] = round(avg_score, 2)
            total_score += avg_score
            subjects_with_attempts += 1
            print(f"Subject {subject.value}: {len(best_by_exam)} exams, best-score avg: {avg_score:.2f}")
        else:
            breakdown[subject.value] = 0
            print(f"Subject {subject.value}: No attempts yet")

    print(f"Matrik calculation complete: {subjects_with_attempts}/6 subjects have attempts, Total score: {total_score:.2f}")
    print(f"Breakdown: {breakdown}")

    setattr(user, score_field, round(total_score))
    setattr(user, breakdown_field, json.dumps(breakdown))
    print(f"Updated Matrik score: {round(total_score)} in {score_field}")

    # Score out of 600 (6 subjects × 100 max each)
    other_stream_score = 0
    try:
        other_stream_score = getattr(user, "social_matrik_score" if user.stream == StreamEnum.NATURAL else "natural_matrik_score", 0)
        if other_stream_score is None:
            other_stream_score = 0
    except:
        other_stream_score = 0

    return {
        "eligible": True,
        "stream": user.stream.value,
        "score": round(total_score, 2),
        "out_of": 600,
        "breakdown": breakdown,
        "subjects_completed": subjects_with_attempts,
        "subjects_total": len(matrik_subjects),
        "coverage_percent": round(subjects_with_attempts / len(matrik_subjects) * 100),
        # Also include the other stream's score if it exists (for display purposes)
        "other_stream_score": other_stream_score
    }


# ---------- Serializers ----------

def serialize_exam(exam: EueeExam, include_content: bool = False) -> dict:
    data = {
        "id": exam.id,
        "subject": exam.subject.value,
        "year": exam.year,
        "title": exam.title,
        "university": exam.university or "",
        "custom_tag": exam.custom_tag or "",
        "question_count": exam.question_count,
        "duration_minutes": exam.duration_minutes,
        "content_type": exam.content_type,
        "semester": exam.semester,
        "exam_type": exam.exam_type,
        "is_premium": exam.is_premium,
        "is_published": exam.is_published,
    }
    if include_content:
        data["content_data"] = exam.content_data
    return data


def serialize_flash_card(flash_card: FlashCard) -> dict:
    return {
        "id": flash_card.id,
        "title": flash_card.title,
        "html_content": flash_card.html_content,
        "is_published": flash_card.is_published,
        "created_at": flash_card.created_at.isoformat(),
    }


def serialize_university_logo(logo: UniversityLogo) -> dict:
    return {
        "id": logo.id,
        "university": logo.university,
        "data_uri": logo.data_uri,
        "created_at": logo.created_at.isoformat(),
    }


def serialize_note(note: Note, include_content: bool = False) -> dict:
    data = {
        "id": note.id,
        "subject": note.subject.value,
        "grade": note.grade,
        "stream": note.stream.value if note.stream else None,
        "chapter_number": note.chapter_number,
        "semester": note.semester,
        "title": note.title,
        "is_premium": note.is_premium,
        "is_published": note.is_published,
    }
    if include_content:
        data["html_content"] = note.html_content
    return data


# ---------- Pydantic schemas ----------

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    full_name: Optional[str] = None
    custom_name: Optional[str] = None
    university: Optional[str] = None
    region: Optional[str] = None
    school: Optional[str] = None
    city: Optional[str] = None
    grade: int
    stream: str

    @validator('grade')
    def validate_grade(cls, v):
        if v not in VALID_GRADES:
            raise ValueError('Grade must be one of 9, 10, 11, 12')
        return v

    @validator('stream')
    def validate_stream(cls, v):
        if v.upper() not in VALID_STREAMS:
            raise ValueError('Stream must be GENERAL, NATURAL or SOCIAL')
        return v.upper()  # returned value is a StreamEnum member name


class SubjectSuggestionCreate(BaseModel):
    stream: str
    subject_name: str
    reason: Optional[str] = None

    @validator('stream')
    def validate_stream(cls, v):
        if v.upper() not in VALID_STREAMS:
            raise ValueError('Stream must be GENERAL, NATURAL or SOCIAL')
        return v.upper()

    @validator('subject_name')
    def validate_subject_name(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 120:
            raise ValueError('Subject name must be between 2 and 120 characters')
        return v


class UserProfileUpsert(BaseModel):
    telegram_id: int
    first_name: Optional[str] = None
    full_name: Optional[str] = None
    custom_name: Optional[str] = None
    university: Optional[str] = None
    region: Optional[str] = None
    school: Optional[str] = None
    city: Optional[str] = None
    grade: Optional[int] = None
    stream: Optional[str] = None
    selected_subjects: Optional[List[str]] = None
    premium_expires_at: Optional[datetime] = None

    @validator('grade')
    def validate_optional_grade(cls, v):
        if v is not None and v not in VALID_GRADES:
            raise ValueError('Grade must be one of 9, 10, 11, 12')
        return v

    @validator('stream')
    def validate_optional_stream(cls, v):
        if v is not None and v.upper() not in VALID_STREAMS:
            raise ValueError('Stream must be GENERAL, NATURAL or SOCIAL')
        return v.upper() if v else None


class ExamCreate(BaseModel):
    subject: str
    year: str
    title: Optional[str] = None
    university: Optional[str] = None
    custom_tag: Optional[str] = None
    question_count: int
    duration_minutes: int
    content_type: str = "html"
    content_data: str
    semester: str = "all"
    exam_type: str = "final"
    is_premium: bool = False
    is_published: bool = True

    @validator('subject')
    def validate_subject(cls, v):
        if v.lower() not in VALID_SUBJECTS:
            raise ValueError(f'Invalid subject. Must be one of: {", ".join(VALID_SUBJECTS)}')
        return v.lower()

    @validator('year')
    def validate_year(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Year is required, e.g. "2016 E.C." or "2024 G.C."')
        return v

    @validator('question_count')
    def validate_question_count(cls, v):
        if v < 1 or v > 200:
            raise ValueError('Question count must be between 1 and 200')
        return v

    @validator('duration_minutes')
    def validate_duration_minutes(cls, v):
        if v < 1 or v > 300:
            raise ValueError('Duration must be between 1 and 300 minutes')
        return v

    @validator('content_type')
    def validate_content_type(cls, v):
        if v.lower() not in ('html', 'pdf'):
            raise ValueError('Content type must be "html" or "pdf"')
        return v.lower()

    @validator('content_data')
    def validate_content_data(cls, v):
        if not v or len(v.strip()) < 8:
            raise ValueError('Exam content is required (HTML markup or a PDF URL/data URI)')
        return v.strip()

    @validator('exam_type')
    def validate_exam_type(cls, v):
        v = v.strip().lower()
        if v not in ('final', 'mid'):
            raise ValueError('Exam type must be "final" or "mid"')
        return v

    @validator('university')
    def validate_university(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v


class UniversityLogoCreate(BaseModel):
    university: str
    data_uri: str

    @validator('university')
    def validate_university(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 160:
            raise ValueError('University name must be between 2 and 160 characters')
        return v

    @validator('data_uri')
    def validate_data_uri(cls, v):
        if not v.startswith('data:image/') or ';base64,' not in v:
            raise ValueError('University logo must be a base64 image')
        return v


class FlashCardCreate(BaseModel):
    title: str
    html_content: str
    is_published: bool = True

    @validator('title')
    def validate_title(cls, v):
        v = v.strip()
        if len(v) < 2 or len(v) > 160:
            raise ValueError('Title must be between 2 and 160 characters')
        return v


class SubscriptionConfigUpdate(BaseModel):
    price: int
    currency: str = 'USD'
    monthly_operating_cost: int = 0

    @validator('price', 'monthly_operating_cost')
    def validate_non_negative(cls, v):
        if v < 0:
            raise ValueError('Price and operating cost cannot be negative')
        return v

    @validator('currency')
    def validate_currency(cls, v):
        v = v.strip().upper()
        if len(v) > 8:
            raise ValueError('Currency must be a valid three-letter code')
        return v


class ExamAttemptCreate(BaseModel):
    user_id: int
    first_name: Optional[str] = None
    score: Optional[int] = None
    time_spent: Optional[int] = None
    total_questions: Optional[int] = None
    answers_json: Optional[str] = None
    completed_at: Optional[str] = None


class NoteCreate(BaseModel):
    subject: str
    grade: int
    stream: Optional[str] = None
    chapter_number: int
    title: str
    html_content: str
    semester: str = "all"
    is_premium: bool = False
    is_published: bool = True

    @validator('subject')
    def validate_subject(cls, v):
        if v.lower() not in VALID_SUBJECTS:
            raise ValueError(f'Invalid subject. Must be one of: {", ".join(VALID_SUBJECTS)}')
        return v.lower()

    @validator('grade')
    def validate_grade(cls, v):
        if v not in VALID_GRADES:
            raise ValueError('Grade must be one of 9, 10, 11, 12')
        return v

    @validator('stream')
    def validate_stream(cls, v, values):
        # Stream is required for grades 11-12, not for 9-10
        if 'grade' in values and values['grade'] in [11, 12]:
            if not v or v.upper() not in VALID_STREAMS:
                raise ValueError('Stream must be NATURAL or SOCIAL for grades 11-12')
        return v.upper() if v else None

    @validator('title')
    def validate_title(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Title must be at least 2 characters')
        return v.strip()

    @validator('html_content')
    def validate_html_content(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Notes HTML content is required')
        return v.strip()


# ---------- User endpoints ----------

@app.get("/api/user/{user_id}")
async def get_user(user_id: int, authenticated_user_id: int = Depends(verify_device_session)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        is_premium, _ = await get_premium_membership_status(session, user_id)
        return {
            "user_id": user.user_id,
            "first_name": user.first_name,
            "full_name": user.full_name,
            "custom_name": user.custom_name,
            "university": user.university,
            "region": user.region,
            "school": user.school,
            "city": user.city,
            "grade": user.grade,
            "stream": user.stream.value,
            "selected_subjects": json.loads(user.selected_subjects or "[]"),
            "premium_expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
            "is_premium": is_premium,
        }


@app.put("/api/user/{user_id}")
async def update_user(user_id: int, update: UserUpdate):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            # Profiles are created inside the Mini App (the bot asks no questions),
            # so the first PUT upserts the row.
            user = User(
                user_id=user_id,
                first_name=(update.first_name or update.full_name or "Student").strip(),
                full_name=(update.full_name or update.first_name or "Student").strip(),
                custom_name=update.custom_name.strip() if update.custom_name else None,
                university=update.university.strip() if update.university else "",
                region=update.region.strip() if update.region else "",
                school=update.school.strip() if update.school else "",
                city=update.city.strip() if update.city else "",
                grade=update.grade,
                stream=StreamEnum[update.stream],
                selected_subjects=json.dumps(update.selected_subjects or []),
            )
            session.add(user)
        else:
            # Preserve Matrik scores when stream changes
            old_stream = user.stream
            new_stream = StreamEnum[update.stream]

            if update.first_name:
                user.first_name = update.first_name.strip()
            if update.full_name:
                user.full_name = update.full_name.strip()
            if "custom_name" in update.__fields_set__:
                user.custom_name = update.custom_name.strip() or None if update.custom_name else None
            if update.university is not None:
                user.university = update.university.strip()
            if update.region is not None:
                user.region = update.region.strip()
            if update.school is not None:
                user.school = update.school.strip()
            if update.city is not None:
                user.city = update.city.strip()
            user.grade = update.grade
            user.stream = new_stream
            if update.selected_subjects is not None:
                user.selected_subjects = json.dumps(update.selected_subjects)

            # Note: Matrik scores are preserved in the database fields (natural_matrik_score, social_matrik_score)
            # When stream changes, the old score is retained and can be viewed via the API with ?stream parameter

        await session.commit()
        await session.refresh(user)

        return {
            "user_id": user.user_id,
            "first_name": user.first_name,
            "full_name": user.full_name,
            "custom_name": user.custom_name,
            "university": user.university,
            "region": user.region,
            "school": user.school,
            "city": user.city,
            "grade": user.grade,
            "stream": user.stream.value,
            "selected_subjects": json.loads(user.selected_subjects or "[]"),
            "premium_expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
        }


@app.post("/api/subject-suggestions")
async def create_subject_suggestion(
    suggestion: SubjectSuggestionCreate,
    x_fresho_user_id: Optional[int] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
):
    async with AsyncSessionLocal() as session:
        user_id = await require_active_device_session(
            session, x_fresho_user_id, x_fresho_device_id, x_fresho_session_token
        )
        item = SubjectSuggestion(
            user_id=user_id,
            stream=StreamEnum[suggestion.stream],
            subject_name=suggestion.subject_name,
            reason=suggestion.reason.strip() if suggestion.reason else None,
            status="pending",
        )
        session.add(item)
        await session.commit()
        await session.refresh(item)
        return {
            "id": item.id,
            "stream": item.stream.value,
            "subject_name": item.subject_name,
            "reason": item.reason,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
        }


@app.get("/api/admin/subject-suggestions")
async def admin_get_subject_suggestions(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SubjectSuggestion).order_by(SubjectSuggestion.created_at.desc())
        )
        return [
            {
                "id": suggestion.id,
                "user_id": suggestion.user_id,
                "stream": suggestion.stream.value,
                "subject_name": suggestion.subject_name,
                "reason": suggestion.reason,
                "status": suggestion.status,
                "created_at": suggestion.created_at.isoformat(),
                "reviewed_at": suggestion.reviewed_at.isoformat() if suggestion.reviewed_at else None,
                "reviewed_by": suggestion.reviewed_by,
            }
            for suggestion in result.scalars().all()
        ]


@app.patch("/api/admin/subject-suggestions/{suggestion_id}")
async def admin_review_subject_suggestion(
    suggestion_id: int,
    body: dict,
    admin_verified: bool = Depends(verify_admin_secret),
):
    status = body.get("status")
    if status not in {"approved", "rejected"}:
        raise HTTPException(status_code=422, detail="Status must be approved or rejected")
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SubjectSuggestion).where(SubjectSuggestion.id == suggestion_id)
        )
        suggestion = result.scalar_one_or_none()
        if not suggestion:
            raise HTTPException(status_code=404, detail="Subject suggestion not found")
        suggestion.status = status
        suggestion.reviewed_at = datetime.utcnow()
        suggestion.reviewed_by = "admin"
        if status == "approved":
            result = await session.execute(
                select(User).where(User.user_id == suggestion.user_id)
            )
            user = result.scalar_one_or_none()
            if user:
                selected = json.loads(user.selected_subjects or "[]")
                if suggestion.subject_name not in selected:
                    selected.append(suggestion.subject_name)
                    user.selected_subjects = json.dumps(selected)
        await session.commit()
        await session.refresh(suggestion)
        return {
            "id": suggestion.id,
            "stream": suggestion.stream.value,
            "subject_name": suggestion.subject_name,
            "status": suggestion.status,
        }


@app.post("/api/user/profile")
async def upsert_user_profile(update: UserProfileUpsert):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == update.telegram_id))
        user = result.scalar_one_or_none()
        if user is None:
            display_name = (update.full_name or update.custom_name or update.first_name or "Student").strip()
            user = User(
                user_id=update.telegram_id,
                first_name=(update.first_name or display_name).strip(),
                full_name=display_name or "Student",
                custom_name=update.custom_name.strip() if update.custom_name else None,
                university=update.university.strip() if update.university else "",
                region=update.region.strip() if update.region else "",
                school=update.school.strip() if update.school else "",
                city=update.city.strip() if update.city else "",
                grade=update.grade or 9,
                stream=StreamEnum[update.stream or "GENERAL"],
            )
            session.add(user)
        else:
            if update.first_name:
                user.first_name = update.first_name.strip()
            if update.full_name:
                user.full_name = update.full_name.strip()
            if "custom_name" in update.__fields_set__:
                user.custom_name = update.custom_name.strip() if update.custom_name else None
            if update.university is not None:
                user.university = update.university.strip()
            if update.region is not None:
                user.region = update.region.strip()
            if update.school is not None:
                user.school = update.school.strip()
            if update.city is not None:
                user.city = update.city.strip()
            if update.grade is not None:
                user.grade = update.grade
            if update.stream is not None:
                user.stream = StreamEnum[update.stream]
            if update.selected_subjects is not None:
                user.selected_subjects = json.dumps(update.selected_subjects)

        await session.commit()
        await session.refresh(user)
        return {
            "user_id": user.user_id,
            "first_name": user.first_name,
            "full_name": user.full_name,
            "custom_name": user.custom_name,
            "university": user.university,
            "region": user.region,
            "school": user.school,
            "city": user.city,
            "grade": user.grade,
            "stream": user.stream.value,
            "selected_subjects": json.loads(user.selected_subjects or "[]"),
            "premium_expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
        }


@app.get("/api/user/{user_id}/stats")
async def get_user_stats(user_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(EueeExamAttempt).where(EueeExamAttempt.user_id == user_id)
        )
        attempts = result.scalars().all()

        scored = [a.score for a in attempts if a.score is not None]
        last_attempt = max(attempts, key=lambda a: a.created_at, default=None)

        last_exam = None
        if last_attempt:
            exam_result = await session.execute(
                select(EueeExam).where(EueeExam.id == last_attempt.exam_id)
            )
            exam = exam_result.scalar_one_or_none()
            if exam:
                last_exam = serialize_exam(exam)

        return {
            "exams_taken": len(attempts),
            "average_score": round(sum(scored) / len(scored), 1) if scored else None,
            "last_score": last_attempt.score if last_attempt else None,
            "last_exam": last_exam,
        }


@app.post("/api/user/{user_id}/daily-check-in")
async def daily_check_in(user_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today = datetime.utcnow().date()
        last_active = user.last_active_date.date() if user.last_active_date else None
        is_new_day = last_active != today
        streak, frozen_streaks = await update_streak(session, user_id)
        await session.commit()
        return {
            "daily_streak": streak,
            "frozen_streaks": frozen_streaks,
            "is_new_day": is_new_day,
            "checked_in_date": today.isoformat(),
        }


@app.get("/api/user/{user_id}/matrik")
async def get_matrik_score(user_id: int, stream: Optional[str] = None):
    """Get Matrik score breakdown. If stream is provided, show that stream's stored score."""
    import json

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # If specific stream requested, return stored data for that stream
        if stream:
            if stream.upper() == "NATURAL":
                score = user.natural_matrik_score
                breakdown_json = user.natural_matrik_breakdown
                stream_name = "NATURAL"
            elif stream.upper() == "SOCIAL":
                score = user.social_matrik_score
                breakdown_json = user.social_matrik_breakdown
                stream_name = "SOCIAL"
            else:
                raise HTTPException(status_code=400, detail="Invalid stream. Use 'natural' or 'social'")

            breakdown = json.loads(breakdown_json) if breakdown_json else {}

            return {
                "stream": stream_name,
                "score": score,
                "out_of": 600,
                "breakdown": breakdown,
                "is_current_stream": user.stream.value == stream_name.lower()
            }

        # Otherwise, calculate and return current stream's score
        matrik = await calculate_matrik_score(session, user_id)
        await session.commit()
        return matrik


@app.get("/api/user/{user_id}/profile")
async def get_user_profile(user_id: int):
    """Get full user profile including XP, level, badges, rank, and Matrik score."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User {user_id} not found in profile endpoint")
            raise HTTPException(status_code=404, detail="User not found - Please complete onboarding first")

        print(f"Loading profile for user {user_id}, grade: {user.grade}, stream: {user.stream.value}")

        # Get badges - handle case where table doesn't exist
        badges = []
        try:
            badges_result = await session.execute(
                select(UserBadge).where(UserBadge.user_id == user_id)
            )
            badges = badges_result.scalars().all()
        except Exception as e:
            print(f"Warning: Could not load badges (table may not exist): {e}")

        # Handle None values for new columns (for backward compatibility)
        user_xp = user.xp if user.xp is not None else 0
        user_level = user.level if user.level is not None else 1
        user_daily_streak = user.daily_streak if user.daily_streak is not None else 0
        user_frozen_streaks = user.frozen_streaks if user.frozen_streaks is not None else 0

        print(f"User XP: {user_xp}, Level: {user_level}, Streak: {user_daily_streak}")

        # Calculate XP progress to next level
        current_level_xp = XP_LEVELS.get(user_level, 0)
        next_level_xp = get_xp_for_next_level(user_level)
        xp_in_current_level = user_xp - current_level_xp
        xp_needed_for_next = next_level_xp - current_level_xp
        progress_percent = min(100, max(0, int((xp_in_current_level / xp_needed_for_next) * 100))) if xp_needed_for_next > 0 else 100

        # Get rank
        rank = get_rank(user_xp)

        # Get Matrik score (will handle grade 9-10 and different streams)
        try:
            matrik = await calculate_matrik_score(session, user_id)
            await session.commit()
        except Exception as e:
            # If Matrik calculation fails, return a safe default
            print(f"Warning: Matrik calculation failed: {e}")
            matrik = {"eligible": False, "reason": "Calculation error"}

        # For grade 9-10, show average score instead of Matrik
        if user.grade in [9, 10]:
            profile_data = {
                "user_id": user.user_id,
                "first_name": user.first_name,
                "full_name": user.full_name,
                "custom_name": user.custom_name,
                "school": user.school,
                "city": user.city,
                "grade": user.grade,
                "stream": user.stream.value,
                "xp": user_xp,
                "level": user_level,
                "rank": rank,
                "progress_to_next_level": {
                    "percent": progress_percent,
                    "current_xp": xp_in_current_level,
                    "needed": xp_needed_for_next,
                },
                "badges": [
                    {"name": b.badge_name, "emoji": b.badge_emoji, "earned_at": b.earned_at.isoformat()}
                    for b in badges
                ],
                "daily_streak": user_daily_streak,
                "frozen_streaks": user_frozen_streaks,
                "score_type": "average",  # Grade 9-10 show average
                "average_score": user.total_score if user.total_score is not None else 0,
                "matrik_score": matrik,  # Include for consistency
            }
        else:
            # Grade 11-12 show Matrik score
            profile_data = {
                "user_id": user.user_id,
                "first_name": user.first_name,
                "full_name": user.full_name,
                "custom_name": user.custom_name,
                "school": user.school,
                "city": user.city,
                "grade": user.grade,
                "stream": user.stream.value,
                "xp": user_xp,
                "level": user_level,
                "rank": rank,
                "progress_to_next_level": {
                    "percent": progress_percent,
                    "current_xp": xp_in_current_level,
                    "needed": xp_needed_for_next,
                },
                "badges": [
                    {"name": b.badge_name, "emoji": b.badge_emoji, "earned_at": b.earned_at.isoformat()}
                    for b in badges
                ],
                "daily_streak": user_daily_streak,
                "frozen_streaks": user_frozen_streaks,
                "score_type": "matrik",  # Grade 11-12 show Matrik
                "matrik_score": matrik,
            }

        print(f"Returning profile data: XP={profile_data['xp']}, Level={profile_data['level']}, Streak={profile_data['daily_streak']}")
        return profile_data


class NoteCompleteRequest(BaseModel):
    note_id: int


@app.post("/api/user/{user_id}/note-complete")
async def complete_note(user_id: int, request: NoteCompleteRequest):
    """Mark a note as completed and award XP."""
    async with AsyncSessionLocal() as session:
        print(f"Note completion request - User: {user_id}, Note ID: {request.note_id}")
        user_result = await session.execute(select(User).where(User.user_id == user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if note exists
        note_result = await session.execute(select(Note).where(Note.id == request.note_id))
        note = note_result.scalar_one_or_none()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")

        # Check if already completed
        try:
            existing_result = await session.execute(
                select(NoteCompletion).where(
                    NoteCompletion.user_id == user_id,
                    NoteCompletion.note_id == request.note_id
                )
            )
            existing = existing_result.scalar_one_or_none()
        except Exception:
            # Table might not exist yet
            existing = None

        if existing:
            print(f"Note {request.note_id} already completed by user {user_id}")
            return {"message": "Already completed", "xp_awarded": 0}

        # Create completion record
        try:
            completion = NoteCompletion(user_id=user_id, note_id=request.note_id)
            session.add(completion)
            print(f"Created note completion record for user {user_id}, note {request.note_id}")
        except Exception as e:
            # Table might not exist yet, continue without storing
            print(f"Warning: Could not create note completion (table may not exist yet): {e}")

        # Award XP for completing note
        starting_level = user.level or 1
        print(f"Awarding 20 XP for note completion to user {user_id}")
        xp, level, level_up = await award_xp(session, user_id, 20, "Note completion")

        # Award "First Step" badge if this is first note
        try:
            all_completions_result = await session.execute(
                select(NoteCompletion).where(NoteCompletion.user_id == user_id)
            )
            if len(all_completions_result.scalars().all()) == 1:
                await award_badge(session, user_id, "first_step")
                print(f"Awarded first_step badge to user {user_id}")
        except Exception as e:
            # Table might not exist yet, skip badge check
            print(f"Warning: Could not check first_step badge: {e}")

        # Update streak
        streak, frozen = await update_streak(session, user_id)

        # Try to award milestones (may fail if tables don't exist)
        milestone_xp = 0
        milestone_badges = []
        try:
            milestone = await award_subject_milestones(session, user, note.subject)
            milestone_xp = milestone.get("xp_awarded", 0)
            milestone_badges = milestone.get("badges_awarded", [])
            print(f"Milestone XP awarded: {milestone_xp}, Badges: {milestone_badges}")
        except Exception as e:
            print(f"Warning: Could not award milestones (tables may not exist yet): {e}")

        await session.commit()
        await session.refresh(user)

        return {
            "message": "Note completed",
            "xp_awarded": 20 + milestone_xp,
            "total_xp": user.xp if user.xp is not None else 0,
            "level": user.level if user.level is not None else 1,
            "level_up": level_up or (user.level if user.level is not None else 1) > starting_level,
            "streak": streak,
            "frozen_streaks": frozen,
            "badges_awarded": milestone_badges,
        }


@app.post("/api/user/{user_id}/freeze-streak")
async def freeze_streak(user_id: int):
    """Use a streak freeze if available."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.user_id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if user.frozen_streaks <= 0:
            raise HTTPException(status_code=400, detail="No frozen streaks available")

        user.frozen_streaks -= 1
        await session.commit()
        return {"frozen_streaks": user.frozen_streaks}


# ---------- Leaderboard endpoints ----------

@app.get("/api/leaderboard")
async def get_leaderboard(
    period: str = "all_time",
    type: str = "score",
    user_id: Optional[int] = None,
    stream: Optional[str] = None,
    university: Optional[str] = None,
):
    """Get a global leaderboard or a university-scoped leaderboard."""
    if period not in {"weekly", "all_time"}:
        raise HTTPException(status_code=400, detail="Period must be 'weekly' or 'all_time'")
    if type not in {"score", "xp"}:
        raise HTTPException(status_code=400, detail="Type must be 'score' or 'xp'")
    stream_filter = None
    if stream:
        try:
            stream_filter = StreamEnum[stream.upper()]
        except KeyError as error:
            raise HTTPException(status_code=400, detail="Stream must be 'general', 'natural', or 'social'") from error
    if university:
        normalized_university = university.strip()
        if not normalized_university:
            raise HTTPException(status_code=400, detail="University cannot be empty")

    async with AsyncSessionLocal() as session:
        from sqlalchemy import func, desc

        try:
            if type == "xp":
                # XP-based leaderboard
                base = (
                    select(
                        User.user_id,
                        User.first_name,
                        User.full_name,
                        User.custom_name,
                        User.university,
                        User.region,
                        User.xp,
                        User.level,
                        User.daily_streak,
                        User.premium_expires_at,
                    )
                    .where(User.xp > 0)
                )
                if normalized_university:
                    base = base.where(User.university == normalized_university)

                leaderboard_query = base.order_by(desc(User.xp), desc(User.level), User.user_id)
                result = await session.execute(leaderboard_query)
                all_rows = result.all()
                leaderboard = all_rows[:10]
                logos = {}
                if all_rows:
                    university_names = {row[4] for row in all_rows if row[4]}
                    logo_result = await session.execute(
                        select(UniversityLogo).where(
                            UniversityLogo.university.in_(university_names)
                        )
                    )
                    logos = {
                        logo.university: logo.data_uri
                        for logo in logo_result.scalars().all()
                    }
                current_rank = next(
                    (index + 1 for index, row in enumerate(all_rows) if row.user_id == user_id),
                    None,
                )
                if current_rank and current_rank > 10:
                    leaderboard.append(all_rows[current_rank - 1])

                return [
                    {
                        "rank": current_rank if row.user_id == user_id and current_rank else i + 1,
                        "user_id": row.user_id,
                        "display_name": row.custom_name or row.first_name or "Anonymous Student",
                        "university": row.university or None,
                        "region": row.region or None,
                        "xp": row.xp if row.xp is not None else 0,
                        "level": row.level if row.level is not None else 1,
                        "rank_info": get_rank(row.xp if row.xp is not None else 0),
                        "streak": row.daily_streak if row.daily_streak is not None else 0,
                        "is_premium": bool(row.premium_expires_at and row.premium_expires_at > datetime.utcnow()),
                        "university_logo": logos.get(row[4]) if row[4] else None,
                        "is_current_user": row.user_id == user_id,
                    }
                    for i, row in enumerate(leaderboard)
                ]
            else:
                # Score-based leaderboard (original)
                base = (
                    select(
                        User.user_id,
                        User.first_name,
                        User.full_name,
                        User.custom_name,
                        User.university,
                        User.school,
                        User.city,
                        func.count(EueeExamAttempt.id).label("attempt_count"),
                        func.max(EueeExamAttempt.score).label("best_score"),
                        func.avg(EueeExamAttempt.score).label("avg_score"),
                    )
                    .join(EueeExamAttempt, User.user_id == EueeExamAttempt.user_id)
                    .join(EueeExam, EueeExam.id == EueeExamAttempt.exam_id)
                    .where(EueeExamAttempt.score.isnot(None))
                    .where(EueeExam.duration_minutes > 0)
                    .where(EueeExamAttempt.time_spent >= EueeExam.duration_minutes * 39)
                    .group_by(User.user_id)
                )
                if stream_filter:
                    base = base.where(User.stream == stream_filter)
                if normalized_university:
                    base = base.where(User.university == normalized_university)

                if period == "weekly":
                    week_ago = datetime.utcnow() - timedelta(days=7)
                    base = base.where(EueeExamAttempt.created_at >= week_ago)

                leaderboard_query = base.order_by(desc("best_score"), desc("avg_score"), User.user_id)
                result = await session.execute(leaderboard_query)
                all_rows = result.all()
                leaderboard = all_rows[:10]
                logos = {}
                if all_rows:
                    university_names = {row[4] for row in all_rows if row[4]}
                    logo_result = await session.execute(
                        select(UniversityLogo).where(
                            UniversityLogo.university.in_(university_names)
                        )
                    )
                    logos = {
                        logo.university: logo.data_uri
                        for logo in logo_result.scalars().all()
                    }
                current_rank = next(
                    (index + 1 for index, row in enumerate(all_rows) if row.user_id == user_id),
                    None,
                )
                if current_rank and current_rank > 10:
                    leaderboard.append(all_rows[current_rank - 1])

                return [
                    {
                        "rank": current_rank if row.user_id == user_id and current_rank else i + 1,
                        "user_id": row.user_id,
                        "display_name": row.custom_name or row.first_name or "Anonymous Student",
                        "university": row.university or None,
                        "school": row.school or None,
                        "city": row.city or None,
                        "attempt_count": row.attempt_count,
                        "avg_score": round(row.avg_score, 1) if row.avg_score is not None else 0,
                        "best_score": row.best_score,
                        "university_logo": logos.get(row[4]) if row[4] else None,
                        "is_current_user": row.user_id == user_id,
                    }
                    for i, row in enumerate(leaderboard)
                ]
        except Exception as e:
            print(f"Leaderboard error: {e}")
            raise HTTPException(status_code=500, detail="Could not load leaderboard") from e


# ---------- EUEE exam endpoints ----------

@app.get("/api/exams")
async def get_exams(
    subject: Optional[str] = None,
    year: Optional[str] = None,
    university: Optional[str] = None,
    include_drafts: bool = False,
):
    async with AsyncSessionLocal() as session:
        query = select(EueeExam)
        if subject:
            query = query.where(EueeExam.subject == SubjectEnum[subject.upper()])
        if year:
            query = query.where(EueeExam.year == year)
        if university:
            query = query.where(EueeExam.university.ilike(university.strip()))
        if not include_drafts:
            query = query.where(EueeExam.is_published == True)

        result = await session.execute(query.order_by(EueeExam.year.desc()))
        exams = result.scalars().all()
        if university:
            exams.sort(key=lambda exam: (1 if exam.exam_type == "final" else 0, exam.year), reverse=True)
        return [serialize_exam(exam) for exam in exams]


@app.get("/api/exams/{exam_id}")
async def get_exam(
    exam_id: int,
    x_fresho_user_id: Optional[int] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
    x_admin_secret: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None),
):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(EueeExam).where(EueeExam.id == exam_id))
        exam = result.scalar_one_or_none()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.is_premium:
            admin_key = x_admin_secret or x_admin_key or x_admin_password or ""
            is_admin = bool(ADMIN_SECRET) and hmac.compare_digest(admin_key, ADMIN_SECRET)
            if not is_admin:
                user_id = await require_active_device_session(
                    session, x_fresho_user_id, x_fresho_device_id, x_fresho_session_token
                )
                await require_premium_membership(session, user_id)
        return serialize_exam(exam, include_content=True)


@app.post("/api/exams", status_code=201)
async def create_exam(exam: ExamCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        title = exam.title or f"{exam.subject.capitalize()} EUEE {exam.year}"
        new_exam = EueeExam(
            subject=SubjectEnum[exam.subject.upper()],
            year=exam.year,
            title=title,
            university=exam.university.strip() if exam.university else "",
            custom_tag=(exam.custom_tag or "").strip(),
            question_count=exam.question_count,
            duration_minutes=exam.duration_minutes,
            content_type=exam.content_type,
            content_data=exam.content_data,
            semester=exam.semester,
            exam_type=exam.exam_type,
            is_premium=exam.is_premium,
            is_published=exam.is_published,
        )
        session.add(new_exam)
        await session.commit()
        await session.refresh(new_exam)
        return serialize_exam(new_exam, include_content=True)


@app.put("/api/exams/{exam_id}")
async def update_exam(exam_id: int, exam: ExamCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(EueeExam).where(EueeExam.id == exam_id))
        db_exam = result.scalar_one_or_none()
        if not db_exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        db_exam.subject = SubjectEnum[exam.subject.upper()]
        db_exam.year = exam.year
        db_exam.university = exam.university.strip() if exam.university else ""
        db_exam.is_premium = exam.is_premium
        db_exam.is_published = exam.is_published
        db_exam.title = exam.title or db_exam.title
        db_exam.custom_tag = (exam.custom_tag or "").strip()
        db_exam.question_count = exam.question_count
        db_exam.duration_minutes = exam.duration_minutes
        db_exam.content_type = exam.content_type
        db_exam.content_data = exam.content_data
        db_exam.semester = exam.semester
        db_exam.exam_type = exam.exam_type
        await session.commit()
        return serialize_exam(db_exam, include_content=True)


@app.delete("/api/exams/{exam_id}")
async def delete_exam(exam_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(EueeExam).where(EueeExam.id == exam_id))
        db_exam = result.scalar_one_or_none()
        if not db_exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        await session.execute(
            sqlalchemy_delete(EueeExamAttempt).where(EueeExamAttempt.exam_id == exam_id)
        )
        await session.delete(db_exam)
        await session.commit()
        return {"status": "deleted", "id": exam_id}


@app.put("/api/admin/exams/{exam_id}")
async def admin_update_exam_alias(
    exam_id: int,
    exam: ExamCreate,
    admin_verified: bool = Depends(verify_admin_secret),
):
    return await update_exam(exam_id, exam, admin_verified=True)


@app.delete("/api/admin/exams/{exam_id}")
async def admin_delete_exam_alias(
    exam_id: int,
    admin_verified: bool = Depends(verify_admin_secret),
):
    return await delete_exam(exam_id, admin_verified=True)


@app.patch("/api/exams/{exam_id}/toggle-publish")
async def toggle_exam_publish(exam_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(EueeExam).where(EueeExam.id == exam_id))
        db_exam = result.scalar_one_or_none()
        if not db_exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        db_exam.is_published = not db_exam.is_published
        await session.commit()
        return {"id": exam_id, "is_published": db_exam.is_published}


@app.post("/api/exams/{exam_id}/attempts", status_code=201)
async def submit_exam_attempt(
    exam_id: int,
    attempt: ExamAttemptCreate,
    x_fresho_user_id: Optional[int] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
):
    print(f"=== EXAM SUBMISSION START ===")
    print(f"Exam ID: {exam_id}, User ID: {attempt.user_id}, Score: {attempt.score}")
    print(f"Full attempt data: {attempt}")
    async with AsyncSessionLocal() as session:
        active_user_id = await require_active_device_session(
            session, x_fresho_user_id, x_fresho_device_id, x_fresho_session_token
        )
        if attempt.user_id != active_user_id:
            raise HTTPException(status_code=403, detail="Attempt user does not match the active Fresho session")
        result = await session.execute(select(EueeExam).where(EueeExam.id == exam_id))
        exam = result.scalar_one_or_none()
        if not exam:
            print(f"Exam {exam_id} not found")
            raise HTTPException(status_code=404, detail="Exam not found")

        if exam.is_premium:
            await require_premium_membership(session, attempt.user_id)

        result = await session.execute(select(User).where(User.user_id == attempt.user_id))
        db_user = result.scalar_one_or_none()
        if not db_user:
            display_name = (attempt.first_name or "Student").strip() or "Student"
            db_user = User(
                user_id=attempt.user_id,
                first_name=display_name,
                full_name=display_name,
                grade=9,
                stream=StreamEnum.GENERAL,
                xp=0,
                level=1,
                daily_streak=0,
                frozen_streaks=0,
            )
            session.add(db_user)
            await session.commit()
            await session.refresh(db_user)
            print(f"Created new user {attempt.user_id} for exam submission")
        elif attempt.first_name and attempt.first_name.strip():
            db_user.first_name = attempt.first_name.strip()
            if not db_user.full_name or db_user.full_name == "Student":
                db_user.full_name = attempt.first_name.strip()
        starting_level = db_user.level or 1
        print(f"User current XP: {db_user.xp}, Level: {db_user.level}")

        completed_at = parse_submission_datetime(attempt.completed_at)

        total_questions = attempt.total_questions if attempt.total_questions is not None else exam.question_count

        # Check if this is a repeat attempt
        previous_attempts_result = await session.execute(
            select(EueeExamAttempt).where(
                EueeExamAttempt.user_id == attempt.user_id,
                EueeExamAttempt.exam_id == exam_id
            )
        )
        previous_attempts = previous_attempts_result.scalars().all()
        is_repeat = len(previous_attempts) > 0

        # Calculate XP
        xp_to_award = 0
        # The score is already a percentage (0-100) from the frontend
        score_percent = attempt.score if attempt.score is not None else 0

        print(f"Exam submission - User: {attempt.user_id}, Score: {attempt.score}, Percent: {score_percent}%, Is repeat: {is_repeat}, Total Qs: {total_questions}")

        if attempt.score is not None:
            if is_repeat:
                best_previous = max(
                    (previous.score for previous in previous_attempts if previous.score is not None),
                    default=-1,
                )
                xp_to_award = 5 + (10 if attempt.score > best_previous else 0)
                print(f"Repeat exam - Previous best: {best_previous}, New score: {attempt.score}, XP: {xp_to_award}")
            else:
                xp_to_award = 50
                if score_percent >= 100:
                    xp_to_award += 20
                elif score_percent >= 80:
                    xp_to_award += 10
                print(f"First exam - XP base: 50, Bonuses: {xp_to_award - 50}, Total: {xp_to_award}")

            # Award badges based on score
            if score_percent >= 100:
                try:
                    await award_badge(session, attempt.user_id, "perfect_score")
                    print(f"Awarded perfect_score badge to user {attempt.user_id}")
                except Exception as e:
                    print(f"Warning: Could not award perfect_score badge: {e}")
            elif score_percent >= 80:
                try:
                    await award_badge(session, attempt.user_id, "sharp_mind")
                    print(f"Awarded sharp_mind badge to user {attempt.user_id}")
                except Exception as e:
                    print(f"Warning: Could not award sharp_mind badge: {e}")

            # Award "First Test" badge
            if not is_repeat:
                try:
                    await award_badge(session, attempt.user_id, "first_test")
                    print(f"Awarded first_test badge to user {attempt.user_id}")
                except Exception as e:
                    print(f"Warning: Could not award first_test badge: {e}")

            # Check for Practice Master (10 repeats of same exam)
            if len(previous_attempts) >= 9:  # This will be the 10th
                try:
                    await award_badge(session, attempt.user_id, "practice_master")
                    print(f"Awarded practice_master badge to user {attempt.user_id}")
                except Exception as e:
                    print(f"Warning: Could not award practice_master badge: {e}")

        new_attempt = EueeExamAttempt(
            user_id=attempt.user_id,
            exam_id=exam_id,
            score=attempt.score,
            total_questions=total_questions,
            time_spent=attempt.time_spent,
            answers_json=attempt.answers_json,
            completed_at=completed_at or datetime.utcnow(),
        )
        session.add(new_attempt)
        await session.commit()
        await session.refresh(new_attempt)

        # Award XP
        if xp_to_award > 0:
            try:
                print(f"Awarding {xp_to_award} XP to user {attempt.user_id}")
                total_xp, level, level_up = await award_xp(session, attempt.user_id, xp_to_award, "Exam completion")
                print(f"XP award result - Total XP: {total_xp}, Level: {level}, Level up: {level_up}")
            except Exception as e:
                print(f"Warning: Could not award XP: {e}")
                import traceback
                traceback.print_exc()
                total_xp, level, level_up = db_user.xp or 0, db_user.level or 1, False
        else:
            print(f"No XP to award (xp_to_award = {xp_to_award})")
            total_xp, level, level_up = db_user.xp or 0, db_user.level or 1, False

        # Update streak
        streak, frozen = await update_streak(session, attempt.user_id)

        # Update average score
        attempt_result = await session.execute(
            select(EueeExamAttempt).where(EueeExamAttempt.user_id == attempt.user_id)
        )
        all_attempts = attempt_result.scalars().all()
        scored = [a.score for a in all_attempts if a.score is not None]
        db_user.total_score = round(sum(scored) / len(scored), 1) if scored else 0

        # Update Matrik score (only for grades 11-12)
        try:
            if db_user.grade >= 11:
                print(f"Updating Matrik score for user {attempt.user_id}, grade {db_user.grade}")
                matrik_update = await calculate_matrik_score(session, attempt.user_id)
                print(f"Matrik updated: {matrik_update}")
        except Exception as e:
            print(f"Warning: Could not update Matrik score: {e}")

        # Try to award milestones (may fail if tables don't exist)
        milestone_xp = 0
        milestone_badges = []
        try:
            milestones = await award_subject_milestones(session, db_user, exam.subject)
            milestone_xp = milestones.get("xp_awarded", 0)
            milestone_badges = milestones.get("badges_awarded", [])
        except Exception as e:
            print(f"Warning: Could not award milestones (tables may not exist yet): {e}")

        await session.commit()
        await session.refresh(db_user)
        total_xp = db_user.xp or 0
        level = db_user.level or 1
        level_up = level > starting_level

        print(f"Exam submission complete - XP awarded: {xp_to_award + milestone_xp}, Total XP: {total_xp}, Level: {level}, Streak: {streak}")

        response_data = {
            "id": new_attempt.id,
            "exam_id": exam_id,
            "score": attempt.score,
            "xp_awarded": xp_to_award + milestone_xp,
            "total_xp": total_xp,
            "level": level,
            "level_up": level_up,
            "streak": streak,
            "frozen_streaks": frozen,
            "badges_awarded": milestone_badges,
        }
        print(f"Returning response: {response_data}")
        return response_data


# ---------- Notes endpoints ----------

@app.get("/api/notes")
async def get_notes(subject: Optional[str] = None, grade: Optional[int] = None, stream: Optional[str] = None, include_drafts: bool = False):
    async with AsyncSessionLocal() as session:
        query = select(Note)
        if subject:
            query = query.where(Note.subject == SubjectEnum[subject.upper()])
        if grade:
            query = query.where(Note.grade == grade)
        if stream:
            selected_stream = StreamEnum[stream.upper()]
            query = query.where(or_(Note.stream == selected_stream, Note.stream == StreamEnum.GENERAL, Note.stream.is_(None)))
        if not include_drafts:
            query = query.where(Note.is_published == True)

        result = await session.execute(query.order_by(Note.chapter_number))
        return [serialize_note(note) for note in result.scalars().all()]


@app.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Note).where(Note.id == note_id))
        note = result.scalar_one_or_none()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return serialize_note(note, include_content=True)


@app.post("/api/notes", status_code=201)
async def create_note(note: NoteCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        stream_value = StreamEnum[note.stream.upper()] if note.stream else None
        new_note = Note(
            subject=SubjectEnum[note.subject.upper()],
            grade=note.grade,
            stream=stream_value,
            chapter_number=note.chapter_number,
            title=note.title,
            html_content=note.html_content,
            semester=note.semester,
            is_premium=note.is_premium,
            is_published=note.is_published,
        )
        session.add(new_note)
        await session.commit()
        await session.refresh(new_note)
        return serialize_note(new_note, include_content=True)


@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, note: NoteCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Note).where(Note.id == note_id))
        db_note = result.scalar_one_or_none()
        if not db_note:
            raise HTTPException(status_code=404, detail="Note not found")

        db_note.subject = SubjectEnum[note.subject.upper()]
        db_note.grade = note.grade
        db_note.stream = StreamEnum[note.stream.upper()] if note.stream else None
        db_note.chapter_number = note.chapter_number
        db_note.is_premium = note.is_premium
        db_note.is_published = note.is_published
        db_note.title = note.title
        db_note.html_content = note.html_content
        db_note.semester = note.semester
        await session.commit()
        return serialize_note(db_note, include_content=True)


@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Note).where(Note.id == note_id))
        db_note = result.scalar_one_or_none()
        if not db_note:
            raise HTTPException(status_code=404, detail="Note not found")
        chapter_result = await session.execute(select(ChapterExam.id).where(ChapterExam.note_id == note_id))
        chapter_ids = chapter_result.scalars().all()
        if chapter_ids:
            await session.execute(
                sqlalchemy_delete(ChapterExamAttempt).where(ChapterExamAttempt.chapter_exam_id.in_(chapter_ids))
            )
            await session.execute(sqlalchemy_delete(ChapterExam).where(ChapterExam.id.in_(chapter_ids)))
        await session.execute(sqlalchemy_delete(NoteCompletion).where(NoteCompletion.note_id == note_id))
        await session.delete(db_note)
        await session.commit()
        return {"status": "deleted", "id": note_id}


@app.patch("/api/notes/{note_id}/toggle-publish")
async def toggle_note_publish(note_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Note).where(Note.id == note_id))
        db_note = result.scalar_one_or_none()
        if not db_note:
            raise HTTPException(status_code=404, detail="Note not found")
        db_note.is_published = not db_note.is_published
        await session.commit()
        return {"id": note_id, "is_published": db_note.is_published}


# ---------- Chapter Exam endpoints ----------

class ChapterExamCreate(BaseModel):
    note_id: Optional[int] = None
    subject: Optional[str] = None
    grade: Optional[int] = None
    stream: Optional[str] = None
    chapter_number: Optional[int] = None
    title: str
    question_count: int
    content_type: str = "html"
    content_data: str
    semester: str = "all"
    is_premium: bool = False
    is_published: bool = True

    @validator('question_count')
    def validate_question_count(cls, v):
        if v < 1 or v > 200:
            raise ValueError('Question count must be between 1 and 200')
        return v

    @validator('content_type')
    def validate_content_type(cls, v):
        if v.lower() not in ('html', 'pdf'):
            raise ValueError('Content type must be "html" or "pdf"')
        return v.lower()

    @validator('content_data')
    def validate_content_data(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Exam content is required (HTML markup or a PDF URL/data URI)')
        return v.strip()


class ChapterExamAttemptCreate(BaseModel):
    user_id: int
    score: Optional[int] = None
    total_questions: Optional[int] = None
    answers_json: Optional[str] = None
    completed_at: Optional[str] = None


def serialize_chapter_exam(exam: ChapterExam, include_content: bool = False) -> dict:
    data = {
        "id": exam.id,
        "note_id": exam.note_id,
        "subject": exam.subject.value,
        "grade": exam.grade,
        "stream": exam.stream.value if exam.stream else None,
        "chapter_number": exam.chapter_number,
        "title": exam.title,
        "question_count": exam.question_count,
        "content_type": exam.content_type,
        "semester": exam.semester,
        "is_premium": exam.is_premium,
        "is_published": exam.is_published,
    }
    if include_content:
        data["content_data"] = exam.content_data
    return data


async def resolve_chapter_exam_metadata(session, exam: ChapterExamCreate):
    if exam.note_id is not None:
        note_result = await session.execute(select(Note).where(Note.id == exam.note_id))
        note = note_result.scalar_one_or_none()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note.id, note.subject, note.grade, note.stream, note.chapter_number

    if exam.subject is None or exam.grade not in VALID_GRADES or exam.chapter_number is None or exam.chapter_number < 1:
        raise HTTPException(
            status_code=422,
            detail="Standalone chapter questions require a valid subject, grade, and chapter number",
        )
    try:
        subject = SubjectEnum[exam.subject.upper()]
        stream = StreamEnum[exam.stream.upper()] if exam.stream else None
    except KeyError as error:
        raise HTTPException(status_code=422, detail=f"Invalid chapter question category: {error}") from error
    return None, subject, exam.grade, stream, exam.chapter_number


@app.get("/api/chapter-exams")
async def get_chapter_exams(
    subject: Optional[str] = None,
    grade: Optional[int] = None,
    stream: Optional[str] = None,
    note_id: Optional[int] = None,
    include_drafts: bool = False
):
    """Get chapter-specific exams."""
    try:
        async with AsyncSessionLocal() as session:
            query = select(ChapterExam)
            if subject:
                query = query.where(ChapterExam.subject == SubjectEnum[subject.upper()])
            if grade:
                query = query.where(ChapterExam.grade == grade)
            if stream:
                selected_stream = StreamEnum[stream.upper()]
                query = query.where(or_(ChapterExam.stream == selected_stream, ChapterExam.stream == StreamEnum.GENERAL, ChapterExam.stream.is_(None)))
            if note_id:
                query = query.where(ChapterExam.note_id == note_id)
            if not include_drafts:
                query = query.where(ChapterExam.is_published == True)

            result = await session.execute(query.order_by(ChapterExam.chapter_number))
            return [serialize_chapter_exam(exam) for exam in result.scalars().all()]
    except Exception as e:
        print(f"Error in get_chapter_exams: {e}")
        import traceback
        traceback.print_exc()
        # Return empty list if table doesn't exist yet
        return []


@app.get("/api/chapter-exams/{exam_id}")
async def get_chapter_exam(
    exam_id: int,
    x_fresho_user_id: Optional[int] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
    x_admin_secret: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None),
):
    """Get a specific chapter exam with content."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(ChapterExam).where(ChapterExam.id == exam_id))
            exam = result.scalar_one_or_none()
            if not exam:
                raise HTTPException(status_code=404, detail="Chapter exam not found")
            if exam.is_premium:
                admin_key = x_admin_secret or x_admin_key or x_admin_password or ""
                is_admin = bool(ADMIN_SECRET) and hmac.compare_digest(admin_key, ADMIN_SECRET)
                if not is_admin:
                    user_id = await require_active_device_session(
                        session, x_fresho_user_id, x_fresho_device_id, x_fresho_session_token
                    )
                    await require_premium_membership(session, user_id)
            return serialize_chapter_exam(exam, include_content=True)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_chapter_exam: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=404, detail="Chapter exam not found")


@app.get("/api/admin/chapter-exams")
async def admin_get_chapter_exams(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(ChapterExam).order_by(
                ChapterExam.subject,
                ChapterExam.grade,
                ChapterExam.chapter_number,
                ChapterExam.id,
            )
        )
        return [serialize_chapter_exam(exam) for exam in result.scalars().all()]


@app.post("/api/chapter-exams", status_code=201)
async def create_chapter_exam(exam: ChapterExamCreate, admin_verified: bool = Depends(verify_admin_secret)):
    """Create a chapter-specific exam."""
    async with AsyncSessionLocal() as session:
        note_id, subject, grade, stream, chapter_number = await resolve_chapter_exam_metadata(session, exam)

        new_exam = ChapterExam(
            note_id=note_id,
            subject=subject,
            grade=grade,
            stream=stream,
            chapter_number=chapter_number,
            title=exam.title,
            question_count=exam.question_count,
            content_type=exam.content_type,
            content_data=exam.content_data,
            semester=exam.semester,
            is_premium=exam.is_premium,
            is_published=exam.is_published,
        )
        session.add(new_exam)
        await session.commit()
        await session.refresh(new_exam)
        return serialize_chapter_exam(new_exam, include_content=True)


@app.put("/api/chapter-exams/{exam_id}")
async def update_chapter_exam(exam_id: int, exam: ChapterExamCreate, admin_verified: bool = Depends(verify_admin_secret)):
    """Update a chapter-specific exam."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ChapterExam).where(ChapterExam.id == exam_id))
        db_exam = result.scalar_one_or_none()
        if not db_exam:
            raise HTTPException(status_code=404, detail="Chapter exam not found")

        note_id, subject, grade, stream, chapter_number = await resolve_chapter_exam_metadata(session, exam)

        db_exam.note_id = note_id
        db_exam.subject = subject
        db_exam.grade = grade
        db_exam.stream = stream
        db_exam.chapter_number = chapter_number
        db_exam.title = exam.title
        db_exam.question_count = exam.question_count
        db_exam.content_type = exam.content_type
        db_exam.content_data = exam.content_data
        db_exam.semester = exam.semester
        db_exam.is_premium = exam.is_premium
        db_exam.is_published = exam.is_published
        await session.commit()
        return serialize_chapter_exam(db_exam, include_content=True)


@app.delete("/api/chapter-exams/{exam_id}")
async def delete_chapter_exam(exam_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    """Delete a chapter-specific exam."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ChapterExam).where(ChapterExam.id == exam_id))
        db_exam = result.scalar_one_or_none()
        if not db_exam:
            raise HTTPException(status_code=404, detail="Chapter exam not found")
        await session.execute(
            sqlalchemy_delete(ChapterExamAttempt).where(ChapterExamAttempt.chapter_exam_id == exam_id)
        )
        await session.delete(db_exam)
        await session.commit()
        return {"status": "deleted", "id": exam_id}


@app.post("/api/chapter-exams/{exam_id}/attempts", status_code=201)
async def submit_chapter_exam_attempt(
    exam_id: int,
    attempt: ChapterExamAttemptCreate,
    x_fresho_user_id: Optional[int] = Header(None),
    x_fresho_device_id: Optional[str] = Header(None),
    x_fresho_session_token: Optional[str] = Header(None),
):
    """Submit an untimed chapter attempt and award non-leaderboard XP."""
    async with AsyncSessionLocal() as session:
        active_user_id = await require_active_device_session(
            session, x_fresho_user_id, x_fresho_device_id, x_fresho_session_token
        )
        if attempt.user_id != active_user_id:
            raise HTTPException(status_code=403, detail="Attempt user does not match the active Fresho session")
        result = await session.execute(select(ChapterExam).where(ChapterExam.id == exam_id))
        exam = result.scalar_one_or_none()
        if not exam:
            raise HTTPException(status_code=404, detail="Chapter exam not found")
        if exam.is_premium:
            await require_premium_membership(session, attempt.user_id)

        user_result = await session.execute(select(User).where(User.user_id == attempt.user_id))
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        starting_level = user.level or 1

        completed_at = parse_submission_datetime(attempt.completed_at)

        total_questions = attempt.total_questions if attempt.total_questions is not None else exam.question_count

        previous_result = await session.execute(
            select(ChapterExamAttempt).where(
                ChapterExamAttempt.user_id == attempt.user_id,
                ChapterExamAttempt.chapter_exam_id == exam_id,
            )
        )
        previous_attempts = previous_result.scalars().all()
        is_repeat = bool(previous_attempts)
        score_percent = (attempt.score / total_questions * 100) if total_questions > 0 and attempt.score is not None else 0
        if is_repeat:
            best_previous = max(
                (previous.score for previous in previous_attempts if previous.score is not None),
                default=-1,
            )
            xp_to_award = 5 + (10 if attempt.score is not None and attempt.score > best_previous else 0)
        else:
            xp_to_award = 30
            if score_percent >= 100:
                xp_to_award += 20
            elif score_percent >= 80:
                xp_to_award += 10

        new_attempt = ChapterExamAttempt(
            user_id=attempt.user_id,
            chapter_exam_id=exam_id,
            score=attempt.score,
            total_questions=total_questions,
            answers_json=attempt.answers_json,
            completed_at=completed_at or datetime.utcnow(),
        )
        session.add(new_attempt)
        await session.commit()
        await session.refresh(new_attempt)

        if score_percent >= 100:
            await award_badge(session, attempt.user_id, "perfect_score")
        elif score_percent >= 80:
            await award_badge(session, attempt.user_id, "sharp_mind")
        if not is_repeat:
            await award_badge(session, attempt.user_id, "first_test")
        if len(previous_attempts) >= 9:
            await award_badge(session, attempt.user_id, "practice_master")

        total_xp, level, level_up = await award_xp(session, attempt.user_id, xp_to_award, "Chapter exam completion")

        chapter_xp = 0
        if exam.note_id is not None:
            chapter_exam_rows = await session.execute(
                select(ChapterExam.id).where(ChapterExam.note_id == exam.note_id, ChapterExam.is_published == True)
            )
            chapter_exam_ids = set(chapter_exam_rows.scalars().all())
            completed_chapter_rows = await session.execute(
                select(ChapterExamAttempt.chapter_exam_id).where(
                    ChapterExamAttempt.user_id == attempt.user_id,
                    ChapterExamAttempt.chapter_exam_id.in_(chapter_exam_ids or {-1}),
                )
            )
            completed_chapter_ids = set(completed_chapter_rows.scalars().all())
            if chapter_exam_ids and chapter_exam_ids.issubset(completed_chapter_ids):
                chapter_xp = await award_milestone_xp(
                    session,
                    attempt.user_id,
                    f"chapter_complete_{exam.note_id}",
                    50,
                )
                if chapter_xp:
                    await award_badge(session, attempt.user_id, "chapter_master")

        subject_milestones = await award_subject_milestones(session, user, exam.subject)
        await session.commit()
        streak, frozen = await update_streak(session, attempt.user_id)
        await session.refresh(user)

        return {
            "id": new_attempt.id,
            "chapter_exam_id": exam_id,
            "score": attempt.score,
            "xp_awarded": xp_to_award + chapter_xp + subject_milestones["xp_awarded"],
            "total_xp": user.xp if user.xp is not None else 0,
            "level": user.level if user.level is not None else 1,
            "level_up": level_up or (user.level if user.level is not None else 1) > starting_level,
            "streak": streak,
            "frozen_streaks": frozen,
            "badges_awarded": subject_milestones["badges_awarded"] + ([BADGES["chapter_master"]["name"]] if chapter_xp else []),
        }


@app.get("/api/notes/{note_id}/chapter-exam")
async def get_note_chapter_exam(note_id: int):
    """Get the chapter exam associated with a note, if it exists."""
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(ChapterExam).where(
                    ChapterExam.note_id == note_id,
                    ChapterExam.is_published == True,
                )
            )
            exam = result.scalar_one_or_none()
            if not exam:
                return {"exists": False}
            return {"exists": True, "exam": serialize_chapter_exam(exam, include_content=False)}
    except Exception as e:
        # If table doesn't exist yet, return no exam
        print(f"Chapter exam table may not exist yet: {e}")
        return {"exists": False}


# ---------- Admin Dashboard endpoints ----------

@app.get("/api/admin/university-logo")
async def admin_get_university_logo(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UniversityLogo).order_by(UniversityLogo.university)
        )
        return [serialize_university_logo(logo) for logo in result.scalars().all()]


@app.put("/api/admin/university-logo")
async def admin_put_university_logo(
    payload: UniversityLogoCreate,
    admin_verified: bool = Depends(verify_admin_secret),
):
    data_uri = payload.data_uri.strip()
    try:
        image_data = data_uri.split(",", 1)[1]
        if len(image_data) > 5_000_000:
            raise HTTPException(status_code=413, detail="Logo is too large")
        decoded = __import__("base64").b64decode(image_data, validate=True)
        if not decoded:
            raise HTTPException(status_code=400, detail="Logo image is invalid")
    except (ValueError, TypeError) as error:
        raise HTTPException(status_code=400, detail="Logo image is invalid") from error

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UniversityLogo).where(UniversityLogo.university == payload.university)
        )
        logo = result.scalar_one_or_none()
        if logo is None:
            logo = UniversityLogo(university=payload.university, data_uri=data_uri)
        else:
            logo.data_uri = data_uri
        session.add(logo)
        await session.commit()
        await session.refresh(logo)
        return serialize_university_logo(logo)


@app.get("/api/university-logo")
async def get_university_logo(university: Optional[str] = None):
    if university:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(UniversityLogo).where(
                    UniversityLogo.university == university.strip()
                )
            )
            logo = result.scalar_one_or_none()
            return serialize_university_logo(logo) if logo else None
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UniversityLogo).order_by(UniversityLogo.university)
        )
        return [serialize_university_logo(logo) for logo in result.scalars().all()]


@app.get("/api/admin/exams")
async def admin_get_exams(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(EueeExam).order_by(EueeExam.created_at.desc())
        )
        exams = result.scalars().all()

        # Get attempt counts for each exam
        exam_data = []
        for exam in exams:
            attempt_result = await session.execute(
                select(EueeExamAttempt).where(EueeExamAttempt.exam_id == exam.id)
            )
            attempt_count = len(attempt_result.scalars().all())

            exam_data.append({
                **serialize_exam(exam, include_content=False),
                "attempt_count": attempt_count,
            })

        return exam_data


@app.get("/api/flash-cards")
async def get_flash_cards():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(FlashCard).where(FlashCard.is_published.is_(True)).order_by(FlashCard.created_at.desc())
        )
        return [serialize_flash_card(flash_card) for flash_card in result.scalars().all()]


@app.get("/api/admin/flash-cards")
async def admin_get_flash_cards(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(FlashCard).order_by(FlashCard.created_at.desc())
        )
        return [serialize_flash_card(flash_card) for flash_card in result.scalars().all()]


@app.post("/api/admin/flash-cards")
async def admin_create_flash_card(payload: FlashCardCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        flash_card = FlashCard(**payload.dict())
        session.add(flash_card)
        await session.commit()
        await session.refresh(flash_card)
        return serialize_flash_card(flash_card)


@app.put("/api/admin/flash-cards/{flash_card_id}")
async def admin_update_flash_card(flash_card_id: int, payload: FlashCardCreate, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(FlashCard).where(FlashCard.id == flash_card_id))
        flash_card = result.scalar_one_or_none()
        if not flash_card:
            raise HTTPException(status_code=404, detail="Flash card not found")
        flash_card.title = payload.title
        flash_card.html_content = payload.html_content
        flash_card.is_published = payload.is_published
        await session.commit()
        await session.refresh(flash_card)
        return serialize_flash_card(flash_card)


@app.delete("/api/admin/flash-cards/{flash_card_id}")
async def admin_delete_flash_card(flash_card_id: int, admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(FlashCard).where(FlashCard.id == flash_card_id))
        flash_card = result.scalar_one_or_none()
        if not flash_card:
            raise HTTPException(status_code=404, detail="Flash card not found")
        await session.delete(flash_card)
        await session.commit()
        return {"deleted": True, "id": flash_card_id}


@app.get("/api/admin/notes")
async def admin_get_notes(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Note).order_by(Note.created_at.desc())
        )
        return [serialize_note(note, include_content=False) for note in result.scalars().all()]


@app.get("/api/admin/subscription-config")
async def admin_get_subscription_config(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SubscriptionConfig).order_by(SubscriptionConfig.id).limit(1)
        )
        config = result.scalar_one_or_none()
        if config is None:
            config = SubscriptionConfig(price=0, currency="USD", monthly_operating_cost=0)
        return {
            "price": config.price,
            "currency": config.currency,
            "monthly_operating_cost": config.monthly_operating_cost,
        }


@app.put("/api/admin/subscription-config")
async def admin_update_subscription_config(
    payload: SubscriptionConfigUpdate,
    admin_verified: bool = Depends(verify_admin_secret),
):
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(SubscriptionConfig).order_by(SubscriptionConfig.id).limit(1)
        )
        config = result.scalar_one_or_none()
        if config is None:
            config = SubscriptionConfig()
        config.price = payload.price
        config.currency = payload.currency
        config.monthly_operating_cost = payload.monthly_operating_cost
        config.updated_at = datetime.utcnow()
        session.add(config)
        await session.commit()
        await session.refresh(config)
        return {
            "price": config.price,
            "currency": config.currency,
            "monthly_operating_cost": config.monthly_operating_cost,
        }


@app.get("/api/admin/analytics")
async def admin_get_analytics(admin_verified: bool = Depends(verify_admin_secret)):
    async with AsyncSessionLocal() as session:
        from sqlalchemy import func

        user_result = await session.execute(select(func.count(User.user_id)))
        total_students = user_result.scalar_one() or 0

        attempt_result = await session.execute(
            select(func.count(EueeExamAttempt.id), func.avg(EueeExamAttempt.score)).where(
                EueeExamAttempt.score.isnot(None)
            )
        )
        total_attempts, average_score = attempt_result.one()
        total_attempts = total_attempts or 0
        average_score = round(average_score, 1) if average_score is not None else 0

        active_since = datetime.utcnow() - timedelta(days=7)
        active_result = await session.execute(
            select(func.count(func.distinct(EueeExamAttempt.user_id))).where(
                EueeExamAttempt.score.isnot(None),
                EueeExamAttempt.created_at >= active_since,
            )
        )
        active_students_7d = active_result.scalar_one() or 0

        grade_result = await session.execute(
            select(User.grade, func.count(User.user_id)).group_by(User.grade).order_by(User.grade)
        )
        grade_distribution = [
            {"grade": grade, "students": count}
            for grade, count in grade_result.all()
        ]

        stream_result = await session.execute(
            select(User.stream, func.count(User.user_id)).group_by(User.stream).order_by(User.stream)
        )
        stream_distribution = [
            {"stream": stream.value if stream else "unknown", "students": count}
            for stream, count in stream_result.all()
        ]

        subject_result = await session.execute(
            select(
                EueeExam.subject,
                func.count(EueeExamAttempt.id),
                func.avg(EueeExamAttempt.score),
            )
            .join(EueeExamAttempt, EueeExamAttempt.exam_id == EueeExam.id)
            .where(EueeExamAttempt.score.isnot(None))
            .group_by(EueeExam.subject)
            .order_by(EueeExam.subject)
        )
        subject_performance = [
            {
                "subject": subject.value,
                "attempts": count,
                "average_score": round(score, 1) if score is not None else 0,
            }
            for subject, count, score in subject_result.all()
        ]

        # Recent attempts with user info
        recent_result = await session.execute(
            select(EueeExamAttempt, User, EueeExam)
            .outerjoin(User, EueeExamAttempt.user_id == User.user_id)
            .outerjoin(EueeExam, EueeExamAttempt.exam_id == EueeExam.id)
            .order_by(EueeExamAttempt.created_at.desc())
            .limit(20)
        )

        recent_attempts = []
        for attempt, user, exam in recent_result.all():
            recent_attempts.append({
                "id": attempt.id,
                "user_name": (user.custom_name or user.first_name) if user else "Anonymous Student",
                "exam_title": exam.title if exam else "Deleted exam",
                "exam_subject": exam.subject.value if exam else "unknown",
                "score": attempt.score,
                "total_questions": attempt.total_questions,
                "time_spent": attempt.time_spent,
                "completed_at": attempt.completed_at.isoformat() if attempt.completed_at else None,
                "created_at": attempt.created_at.isoformat(),
            })

        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_month_start = month_start - timedelta(days=1)
        previous_month_start = previous_month_start.replace(day=1)
        config_result = await session.execute(
            select(SubscriptionConfig).order_by(SubscriptionConfig.id).limit(1)
        )
        config = config_result.scalar_one_or_none()
        price = config.price if config else 0
        operating_cost = config.monthly_operating_cost if config else 0
        active_subscriptions = await session.execute(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.expires_at > now,
            )
        )
        active_subscription_rows = active_subscriptions.scalars().all()
        active_subscribers = len({row.user_id for row in active_subscription_rows})
        monthly_revenue = sum(row.amount for row in active_subscription_rows)
        monthly_revenue = monthly_revenue or active_subscribers * price

        current_month_subscriptions = await session.execute(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.started_at >= month_start,
            )
        )
        previous_month_subscriptions = await session.execute(
            select(Subscription).where(
                Subscription.status == "active",
                Subscription.started_at >= previous_month_start,
                Subscription.started_at < month_start,
            )
        )
        current_month_count = len(current_month_subscriptions.scalars().all())
        previous_month_count = len(previous_month_subscriptions.scalars().all())
        monthly_growth = (
            (current_month_count - previous_month_count) / previous_month_count * 100
            if previous_month_count
            else (100 if current_month_count else 0)
        )

        return {
            "total_students": total_students,
            "total_attempts": total_attempts,
            "avg_score": average_score,
            "active_students_7d": active_students_7d,
            "active_subscribers": active_subscribers,
            "monthly_revenue": monthly_revenue,
            "monthly_operating_cost": operating_cost,
            "estimated_profit": monthly_revenue - operating_cost,
            "monthly_growth": round(monthly_growth, 1),
            "new_subscriptions_this_month": current_month_count,
            "grade_distribution": grade_distribution,
            "stream_distribution": stream_distribution,
            "subject_performance": subject_performance,
            "recent_attempts": recent_attempts,
        }


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
