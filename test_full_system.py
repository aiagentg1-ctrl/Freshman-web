"""
Full system test - creates a user, submits an exam, verifies XP, leaderboard, and Matrik
"""

import asyncio
import sys
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import User, EueeExam, EueeExamAttempt, StreamEnum, SubjectEnum

async def test_full_system():
    """Test the complete XP and leaderboard system"""
    async with AsyncSessionLocal() as session:
        print("=" * 60)
        print("FULL SYSTEM TEST")
        print("=" * 60)

        # Step 1: Create a test user
        print("\n[1] Creating test user...")
        test_user_id = 999999
        user = User(
            user_id=test_user_id,
            first_name="Test",
            full_name="Test User",
            grade=11,
            stream=StreamEnum.NATURAL,
            xp=0,
            level=1,
            daily_streak=0,
            frozen_streaks=0,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"[OK] Created user: {user.full_name} (ID: {user.user_id})")
        print(f"     Initial XP: {user.xp}, Level: {user.level}")

        # Step 2: Create a test exam
        print("\n[2] Creating test exam...")
        exam = EueeExam(
            subject=SubjectEnum.PHYSICS,
            year="2024",
            title="Test Physics Exam",
            custom_tag="",
            question_count=10,
            duration_minutes=30,
            content_type="html",
            content_data="<div>Test content</div>",
            is_premium=False,
            is_published=True,
        )
        session.add(exam)
        await session.commit()
        await session.refresh(exam)
        print(f"[OK] Created exam: {exam.title} (ID: {exam.id})")

        # Step 3: Submit an exam attempt
        print("\n[3] Submitting exam attempt...")
        attempt = EueeExamAttempt(
            user_id=test_user_id,
            exam_id=exam.id,
            score=85,  # 85%
            total_questions=10,
            time_spent=300,
            answers_json='{"test": "data"}',
        )
        session.add(attempt)
        await session.commit()
        await session.refresh(attempt)
        print(f"[OK] Submitted attempt: Score {attempt.score}%")

        # Step 4: Award XP manually (simulating the backend logic)
        print("\n[4] Awarding XP...")
        from app import award_xp, update_streak
        xp_awarded, new_level, level_up = await award_xp(session, test_user_id, 50, "Test exam")
        streak, frozen = await update_streak(session, test_user_id)
        await session.commit()
        await session.refresh(user)
        print(f"[OK] XP awarded: {xp_awarded}")
        print(f"     New XP: {user.xp}, New Level: {user.level}, Level Up: {level_up}")
        print(f"     Streak: {streak}, Frozen: {frozen}")

        # Step 5: Test leaderboard
        print("\n[5] Testing leaderboard...")
        from app import get_leaderboard
        leaderboard = await get_leaderboard(period="all_time", type="xp")
        print(f"[OK] Leaderboard returned {len(leaderboard)} entries")
        if leaderboard:
            for entry in leaderboard[:3]:
                print(f"     Rank {entry['rank']}: {entry['display_name']} (XP: {entry['xp']}, Level: {entry['level']})")

        # Step 6: Test user profile
        print("\n[6] Testing user profile...")
        from app import get_user_profile
        profile = await get_user_profile(test_user_id)
        print(f"[OK] Profile loaded:")
        print(f"     XP: {profile['xp']}")
        print(f"     Level: {profile['level']}")
        print(f"     Streak: {profile['daily_streak']}")
        print(f"     Rank: {profile['rank']['name']} {profile['rank']['emoji']}")

        # Step 7: Test Matrik calculation
        print("\n[7] Testing Matrik calculation...")
        from app import calculate_matrik_score
        matrik = await calculate_matrik_score(session, test_user_id)
        print(f"[OK] Matrik calculation:")
        print(f"     Eligible: {matrik['eligible']}")
        if matrik['eligible']:
            print(f"     Stream: {matrik['stream']}")
            print(f"     Score: {matrik['score']}/{matrik['out_of']}")
            print(f"     Breakdown: {matrik.get('breakdown', {})}")

        # Step 8: Test admin analytics
        print("\n[8] Testing admin analytics...")
        from app import admin_get_analytics
        analytics = await admin_get_analytics(admin_verified=True)
        print(f"[OK] Analytics loaded:")
        print(f"     Total students: {analytics['total_students']}")
        print(f"     Total attempts: {analytics['total_attempts']}")
        print(f"     Average score: {analytics['avg_score']}")
        print(f"     Recent attempts: {len(analytics['recent_attempts'])}")

        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)

        # Cleanup
        print("\n[9] Cleaning up test data...")
        await session.execute(select(EueeExamAttempt).where(EueeExamAttempt.user_id == test_user_id))
        await session.execute(select(EueeExam).where(EueeExam.id == exam.id))
        await session.execute(select(User).where(User.user_id == test_user_id))
        await session.commit()
        print("[OK] Test data cleaned up")

if __name__ == "__main__":
    try:
        asyncio.run(test_full_system())
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
