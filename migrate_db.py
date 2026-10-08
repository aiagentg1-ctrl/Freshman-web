"""
Database migration script to ensure all XP and Matrik columns exist
Run this to fix any missing columns in the database
"""

import asyncio
from sqlalchemy import text
from database import engine, AsyncSessionLocal

async def migrate_database():
    """Ensure all required columns exist in the database"""
    async with engine.begin() as conn:
        print("Starting database migration...")

        # Check if it's PostgreSQL
        dialect = engine.dialect.name
        print(f"Database dialect: {dialect}")

        if dialect == "postgresql":
            # Add XP and leveling columns
            migrations = [
                ("ALTER TABLE euee_exams ADD COLUMN IF NOT EXISTS exam_type VARCHAR NOT NULL DEFAULT 'final'", "exam_type"),
                ("ALTER TABLE euee_exams ADD COLUMN IF NOT EXISTS university VARCHAR", "university"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0", "xp"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1", "level"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0", "daily_streak"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS frozen_streaks INTEGER NOT NULL DEFAULT 0", "frozen_streaks"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMP", "last_active_date"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS natural_matrik_score INTEGER NOT NULL DEFAULT 0", "natural_matrik_score"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_matrik_score INTEGER NOT NULL DEFAULT 0", "social_matrik_score"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS natural_matrik_breakdown TEXT", "natural_matrik_breakdown"),
                ("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_matrik_breakdown TEXT", "social_matrik_breakdown"),
            ]

            for sql, column_name in migrations:
                try:
                    await conn.execute(text(sql))
                    print(f"[OK] Added/verified column: {column_name}")
                except Exception as e:
                    print(f"[WARN] Error adding column {column_name}: {e}")

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS university_logos (
                    id SERIAL PRIMARY KEY,
                    university VARCHAR NOT NULL UNIQUE,
                    data_uri TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            print("[OK] Added/verified table: university_logos")

            # Update existing users to have default values
            print("\nUpdating existing users with default values...")
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
            print("[OK] Updated existing users with default values")

            # Verify the migration
            result = await conn.execute(text("""
                SELECT COUNT(*) as total_users,
                       COUNT(CASE WHEN xp > 0 THEN 1 END) as users_with_xp,
                       AVG(xp) as avg_xp,
                       MAX(xp) as max_xp
                FROM users
            """))
            stats = result.fetchone()
            print(f"\nDatabase Statistics:")
            print(f"   Total users: {stats[0]}")
            print(f"   Users with XP > 0: {stats[1]}")
            print(f"   Average XP: {stats[2] or 0}")
            print(f"   Max XP: {stats[3] or 0}")

        print("\n[OK] Migration complete!")

if __name__ == "__main__":
    try:
        asyncio.run(migrate_database())
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
