import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Convert postgresql:// to postgresql+asyncpg:// for async SQLAlchemy
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Remove SSL query parameters from URL as asyncpg handles SSL differently
DATABASE_URL = DATABASE_URL.split("?")[0]

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"ssl": True}
)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.dialect.name == "postgresql":
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_name VARCHAR"))
            # Add all XP and leveling columns
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_streaks INTEGER NOT NULL DEFAULT 0"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMP"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS natural_matrik_score INTEGER NOT NULL DEFAULT 0"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_matrik_score INTEGER NOT NULL DEFAULT 0"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS natural_matrik_breakdown TEXT"))
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_matrik_breakdown TEXT"))
            await conn.execute(text("ALTER TABLE chapter_exams ALTER COLUMN note_id DROP NOT NULL"))

            # Update existing users to have default values
            await conn.execute(text("""
                UPDATE users
                SET xp = COALESCE(xp, 0),
                    level = COALESCE(level, 1),
                    daily_streak = COALESCE(daily_streak, 0),
                    frozen_streaks = COALESCE(frozen_streaks, 0),
                    natural_matrik_score = COALESCE(natural_matrik_score, 0),
                    social_matrik_score = COALESCE(social_matrik_score, 0)
                WHERE xp IS NULL OR level IS NULL OR daily_streak IS NULL
            """))
