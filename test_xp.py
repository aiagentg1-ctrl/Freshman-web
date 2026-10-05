"""
Simple test script to verify XP awarding is working
Run this after starting the backend with: python test_xp.py
"""

import requests
import json

BACKEND_URL = "http://localhost:8000"

def test_exam_submission():
    """Test if exam submission awards XP"""
    print("=== Testing Exam Submission ===")

    # First, get an exam
    exams_response = requests.get(f"{BACKEND_URL}/api/exams")
    if exams_response.status_code != 200:
        print(f"❌ Failed to get exams: {exams_response.status_code}")
        return

    exams = exams_response.json()
    if not exams:
        print("❌ No exams found in database")
        return

    exam_id = exams[0]["id"]
    print(f"✅ Found exam: {exams[0]['title']} (ID: {exam_id})")

    # Submit an exam attempt
    attempt_data = {
        "user_id": 999999,  # Test user ID
        "first_name": "Test User",
        "score": 85,  # 85% score
        "time_spent": 300,  # 5 minutes
        "total_questions": 10,
        "answers_json": json.dumps({"test": "data"}),
        "completed_at": "2024-01-15T10:00:00"
    }

    print(f"📤 Submitting exam attempt...")
    submit_response = requests.post(
        f"{BACKEND_URL}/api/exams/{exam_id}/attempts",
        json=attempt_data
    )

    if submit_response.status_code != 201:
        print(f"❌ Failed to submit exam: {submit_response.status_code}")
        print(f"Error: {submit_response.text}")
        return

    result = submit_response.json()
    print(f"✅ Exam submitted successfully!")
    print(f"   XP awarded: {result.get('xp_awarded')}")
    print(f"   Total XP: {result.get('total_xp')}")
    print(f"   Level: {result.get('level')}")
    print(f"   Level up: {result.get('level_up')}")
    print(f"   Streak: {result.get('streak')}")

    # Check user profile
    print("\n=== Checking User Profile ===")
    profile_response = requests.get(f"{BACKEND_URL}/api/user/999999/profile")
    if profile_response.status_code == 200:
        profile = profile_response.json()
        print(f"✅ User profile loaded:")
        print(f"   XP: {profile.get('xp')}")
        print(f"   Level: {profile.get('level')}")
        print(f"   Streak: {profile.get('daily_streak')}")
    else:
        print(f"❌ Failed to get profile: {profile_response.status_code}")

    # Check leaderboard
    print("\n=== Checking Leaderboard ===")
    leaderboard_response = requests.get(f"{BACKEND_URL}/api/leaderboard?type=xp")
    if leaderboard_response.status_code == 200:
        leaderboard = leaderboard_response.json()
        print(f"✅ Leaderboard loaded ({len(leaderboard)} entries)")
        if leaderboard:
            print(f"   Top user: {leaderboard[0].get('display_name')} (XP: {leaderboard[0].get('xp')})")
    else:
        print(f"❌ Failed to get leaderboard: {leaderboard_response.status_code}")

if __name__ == "__main__":
    try:
        test_exam_submission()
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure it's running on http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")
