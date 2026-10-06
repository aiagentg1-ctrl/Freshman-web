# 🎯 HOW TO TEST XP AND LEADERBOARD

## 🚨 THE ISSUE (FIXED)

When testing in a regular browser (not inside Telegram), the app cannot get the user ID from Telegram. This causes exam submissions to fail with "Telegram user ID is unavailable".

## ✅ THE SOLUTION

I've added a **debug panel** that allows you to set a test user ID for browser testing.

## 🧪 TESTING STEPS

### Step 1: Start the Backend
```bash
cd "C:\Users\mm\Documents\00entrance bot\mirkuzGrade9-12bot"
python app.py
```

### Step 2: Start the Frontend
```bash
cd "C:\Users\mm\Documents\00entrance bot\mirkuzGrade9-12bot\game-hub"
npm run dev:backend
```

### Step 3: Open with Debug Mode
Open your browser to:
```
http://localhost:3000?debug=true
```

### Step 4: Set Test User ID
You'll see a **green debug panel** in the top-right corner:
1. Enter a test user ID (e.g., `123456`)
2. Click "Set ID"
3. The ID will be saved and displayed

### Step 5: Test XP Awarding
1. Navigate to any exam
2. Take the exam
3. Submit it
4. Check the browser console (F12) for logs like:
   ```
   📡 API Request: /api/exams/1/attempts POST
   ✅ Next.js API: Backend success { xp_awarded: 50, total_xp: 50, ... }
   ```

### Step 6: Check Backend Terminal
Look for logs like:
```
=== EXAM SUBMISSION START ===
Exam ID: 1, User ID: 123456, Score: 85
XP Awarded - User: 123456, Amount: 50, Reason: Exam completion
Exam submission complete - XP awarded: 50, Total XP: 50
```

### Step 7: Check Leaderboard
1. Navigate to the Leaderboard page
2. You should see your test user with XP
3. Check browser console for leaderboard API logs

### Step 8: Check Profile
1. Navigate to Profile page
2. You should see XP, level, badges
3. For grades 11-12, you should see Matrik score

## 🔧 What Was Fixed

1. **Created missing API routes** - Chapter exams, user profile, note completion
2. **Fixed backend transaction management** - XP now awarded correctly
3. **Added debug panel** - Allows setting test user ID for browser testing
4. **Enhanced logging** - Comprehensive logs in both frontend and backend
5. **Updated backend URLs** - All API routes now point to localhost:8000

## 📊 Expected Results

- ✅ XP is awarded after taking exams
- ✅ User appears on leaderboard
- ✅ Profile shows XP, level, badges
- ✅ EUEE estimation displays (for grades 11-12)
- ✅ All API calls are logged in console

## ❌ If Still Not Working

1. Check backend is running on `http://localhost:8000`
2. Check frontend is running on `http://localhost:3000`
3. Make sure you opened with `?debug=true`
4. Make sure you set a test user ID in the debug panel
5. Check browser console for errors
6. Check backend terminal for errors

## 🎉 Success!

Once you see XP being awarded and appearing on the leaderboard, the fix is working correctly!
