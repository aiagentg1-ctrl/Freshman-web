# Implementation Summary: HTML Exam Loading, Profile Customization, and Leaderboard

## ✅ Features Implemented

### 1. Fixed "Could Not Load the Exam" Error (HTML Iframe Runner)

**Problem**: Uploaded HTML exams (like `math euee 2018.html`) are standalone web apps with their own styles and scripts. The React ExamRunner tried to parse them as JSON, causing a SyntaxError.

**Solution**:
- **Backend (`models.py`)**: No changes needed - models already support HTML content
- **Frontend (`ExamRunner.tsx`)**:
  - Added `HtmlExamView` component to render standalone HTML exams in a full-screen iframe using `srcDoc`
  - Added message listener for `EXAM_COMPLETED` events from HTML exams
  - When HTML exam sends score via `window.parent.postMessage()`, it:
    * Saves attempt to Neon PostgreSQL
    * Updates user stats
    * Shows celebratory result popup
    * Redirects to Home tab
  - Added logic to detect standalone HTML exams (content_type === "html" without interactive question payload)
  - Falls back to iframe view for non-interactive HTML exams

**Score Communication Bridge**:
HTML exams should send:
```javascript
window.parent.postMessage({
  type: 'EXAM_COMPLETED',
  score: score,
  total: questions.length,
  percentage: Math.round((score / questions.length) * 100)
}, '*');
```

### 2. User Profile Customization (Name, School, City)

**Backend Changes**:
- **`models.py`**: Added `custom_name` field to User model (optional, defaults to Telegram `first_name`)
- **`app.py`**:
  - Updated `UserUpdate` schema to include `custom_name`, `school`, `city`
  - Updated `GET /api/user/{user_id}` to return new fields
  - Updated `PUT /api/user/{user_id}` to handle new profile fields

**Frontend Changes**:
- **`ProfileScreen.tsx`**:
  - Added "Edit Profile" card with three inputs:
    * Full Name (pre-filled with Telegram name)
    * School / Preparatory Name
    * City / Region
  - Saves profile changes to Neon DB via `PATCH /api/user/profile`
  - Displays active Grade and Stream with option to change them
- **`api.ts`**: Updated `UserProfile` interface and `updateUser` function

### 3. Attractive Top 7 Leaderboard (Home Tab)

**Backend Changes**:
- **`app.py`**: Added `GET /api/leaderboard?period=weekly|all_time` endpoint
  - Aggregates top 7 users based on highest average exam score
  - Returns user display name, school, city, rank, and score
  - Supports weekly and all-time periods

**Frontend Changes**:
- **New Component (`Leaderboard.tsx`)**:
  - Segmented toggle: [ 🏆 Weekly Top 7 ] [ 🌍 All-Time Global ]
  - Leaderboard item card design:
    * Rank 1: Gold 🥇 badge with glowing yellow accent
    * Rank 2: Silver 🥈 badge
    * Rank 3: Bronze 🥉 badge
    * Ranks 4-7: Clean rounded slate badges
    * Student Info: Display Name, School & City subtext pill, High Score badge
- **`HomeScreen.tsx`**: Integrated Leaderboard component below the Continue card
- **`api.ts`**: Added `LeaderboardEntry` interface and `getLeaderboard` function

## 📝 Files Modified

### Backend
1. `models.py` - Added `custom_name` field to User model
2. `app.py` - Updated user endpoints, added leaderboard endpoint

### Frontend
1. `src/lib/api.ts` - Updated types and API functions
2. `src/components/tma/ExamRunner.tsx` - Added HTML iframe support and message listener
3. `src/components/tma/ProfileScreen.tsx` - Added profile customization UI
4. `src/components/tma/HomeScreen.tsx` - Integrated Leaderboard
5. `src/components/tma/Leaderboard.tsx` - New component for leaderboard display
6. `src/components/tma/PracticeScreen.tsx` - Added HTML exam routing

## 🚀 Testing Instructions

1. **Test HTML Exam Loading**:
   - Upload a standalone HTML exam (like `math euee 2018.html`)
   - Open the exam in the Mini App
   - Should display in full-screen iframe with all formatting intact
   - Complete the exam and verify score is saved to database

2. **Test Profile Customization**:
   - Go to Profile tab
   - Edit Full Name, School, and City
   - Save changes
   - Verify data persists in Neon database

3. **Test Leaderboard**:
   - Take a few exams to generate scores
   - Check Home tab for Leaderboard
   - Toggle between Weekly and All-Time
   - Verify rankings display correctly with badges

## 🔧 Build Verification

Run `npm run build` to verify TypeScript compilation passes. All changes are compatible with existing code.

## 📌 Important Notes

- HTML exams must send `EXAM_COMPLETED` message for score tracking
- Profile fields are optional - fall back to Telegram data if not set
- Leaderboard requires at least one exam attempt to appear
- All data persists in Neon PostgreSQL database
