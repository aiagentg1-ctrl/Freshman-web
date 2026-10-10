"use client";

import { useState, useEffect } from "react";
import { Calculator, X, Plus, Trash2, ChevronLeft, Share2, CheckCircle2, AlertCircle } from "lucide-react";

interface Course {
  id: number;
  name: string;
  creditHours: number;
  mark: number;
}

interface GradingScale {
  letter: string;
  numberGrade: number;
  minMark: number;
  maxMark: number;
  description: string;
}

// Grading scale from the image (with first semester modification)
const GRADING_SCALE: GradingScale[] = [
  { letter: "A+", numberGrade: 4.00, minMark: 90, maxMark: 100, description: "Excellent - First class with great distinction" },
  { letter: "A", numberGrade: 4.00, minMark: 83, maxMark: 90, description: "Excellent - First class with great distinction" }, // Modified for first semester
  { letter: "A-", numberGrade: 3.75, minMark: 80, maxMark: 83, description: "Excellent - First class with great distinction" }, // Modified for first semester
  { letter: "B+", numberGrade: 3.50, minMark: 75, maxMark: 80, description: "Very good - First class with distinction" },
  { letter: "B", numberGrade: 3.00, minMark: 68, maxMark: 75, description: "Good - Second class" },
  { letter: "B-", numberGrade: 2.75, minMark: 65, maxMark: 68, description: "Good - Second class" },
  { letter: "C+", numberGrade: 2.50, minMark: 60, maxMark: 65, description: "Satisfactory" },
  { letter: "C", numberGrade: 2.00, minMark: 50, maxMark: 60, description: "Satisfactory" },
  { letter: "C-", numberGrade: 1.75, minMark: 45, maxMark: 50, description: "Unsatisfactory - Low class" },
  { letter: "D", numberGrade: 1.00, minMark: 40, maxMark: 45, description: "Very poor" },
  { letter: "F", numberGrade: 0.00, minMark: 0, maxMark: 40, description: "Fail" },
];

function getGradeForMark(mark: number): GradingScale {
  for (const grade of GRADING_SCALE) {
    if (mark >= grade.minMark && mark <= grade.maxMark) {
      return grade;
    }
  }
  return GRADING_SCALE[GRADING_SCALE.length - 1]; // Default to F
}

function calculateGPA(courses: Course[]): { gpa: number; totalCredits: number; totalPoints: number } {
  let totalCredits = 0;
  let totalPoints = 0;

  for (const course of courses) {
    if (course.creditHours > 0 && course.mark >= 0) {
      const grade = getGradeForMark(course.mark);
      totalCredits += course.creditHours;
      totalPoints += grade.numberGrade * course.creditHours;
    }
  }

  const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  return { gpa, totalCredits, totalPoints };
}

export default function GPACalculatorScreen({
  onClose,
}: {
  onClose: () => void;
}) {
  const [courses, setCourses] = useState<Course[]>([
    { id: 1, name: "", creditHours: 3, mark: 0 },
  ]);
  const [showGradingScale, setShowGradingScale] = useState(false);
  const [remainingFreeCalculations, setRemainingFreeCalculations] = useState<number>(() => {
    const stored = localStorage.getItem("freshoGpaFreeCalculations");
    return stored ? parseInt(stored, 10) : 1;
  });
  const [hasInvited, setHasInvited] = useState(() => {
    return localStorage.getItem("freshoGpaHasInvited") === "true";
  });
  const [showInvitePrompt, setShowInvitePrompt] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const { gpa, totalCredits, totalPoints } = calculateGPA(courses);

  const addCourse = () => {
    const newId = Math.max(...courses.map((c) => c.id), 0) + 1;
    setCourses([...courses, { id: newId, name: "", creditHours: 3, mark: 0 }]);
  };

  const removeCourse = (id: number) => {
    if (courses.length > 1) {
      setCourses(courses.filter((c) => c.id !== id));
    }
  };

  const updateCourse = (id: number, field: keyof Course, value: string | number) => {
    setCourses(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleCalculate = () => {
    if (remainingFreeCalculations > 0 || hasInvited) {
      if (!hasInvited && remainingFreeCalculations === 1) {
        setRemainingFreeCalculations(0);
        localStorage.setItem("freshoGpaFreeCalculations", "0");
      }
      setCalculated(true);
    } else {
      setShowInvitePrompt(true);
    }
  };

  const generateInviteLink = () => {
    // Generate a shareable link
    const userId = localStorage.getItem("freshoTelegramUserId");
    const inviteLink = `https://t.me/your_bot?start=${userId}`;
    navigator.clipboard.writeText(inviteLink);
    setHasInvited(true);
    localStorage.setItem("freshoGpaHasInvited", "true");
    setShowInvitePrompt(false);
    setRemainingFreeCalculations(Infinity); // Unlimited after inviting
    alert("Invite link copied! Share it with friends to unlock unlimited GPA calculations.");
  };

  const gradeDistribution = courses.reduce((acc, course) => {
    if (course.mark >= 0) {
      const grade = getGradeForMark(course.mark);
      acc[grade.letter] = (acc[grade.letter] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col flex-1 bg-slate-50">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-slate-500 text-sm font-medium"
          >
            <ChevronLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-lg font-bold text-slate-900 flex-1">GPA Calculator</h1>
          <button
            onClick={() => setShowGradingScale(!showGradingScale)}
            className="text-xs font-semibold text-[#1D70F5] bg-blue-50 px-3 py-1.5 rounded-lg"
          >
            {showGradingScale ? "Hide Scale" : "View Scale"}
          </button>
        </div>
      </div>

      {/* Grading Scale Panel */}
      {showGradingScale && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-xs font-bold text-blue-900 mb-2">Grading Scale (First Semester)</p>
          <div className="space-y-1">
            {GRADING_SCALE.map((grade) => (
              <div key={grade.letter} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-800">{grade.letter}</span>
                <span className="text-blue-700">{grade.minMark}-{grade.maxMark}%</span>
                <span className="text-blue-600 font-mono">{grade.numberGrade.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Free Trial Status */}
      {!hasInvited && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-800">
              {remainingFreeCalculations > 0
                ? `${remainingFreeCalculations} free calculation${remainingFreeCalculations === 1 ? "" : "s"} remaining`
                : "Free trial used up"}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        {/* Course List */}
        <div className="space-y-3">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Course Name</label>
                    <input
                      type="text"
                      value={course.name}
                      onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                      placeholder="e.g., Physics 101"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#1D70F5]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Credit Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={course.creditHours}
                        onChange={(e) => updateCourse(course.id, "creditHours", parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#1D70F5]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Mark (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={course.mark}
                        onChange={(e) => updateCourse(course.id, "mark", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#1D70F5]"
                      />
                    </div>
                  </div>
                </div>
                {courses.length > 1 && (
                  <button
                    onClick={() => removeCourse(course.id)}
                    className="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addCourse}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-semibold text-sm flex items-center justify-center gap-2 hover:border-[#1D70F5] hover:text-[#1D70F5] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Course
        </button>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          disabled={courses.some((c) => !c.name || c.creditHours <= 0)}
          className="w-full bg-[#1D70F5] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Calculator className="w-5 h-5" /> Calculate GPA
        </button>

        {/* Results */}
        {calculated && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your GPA</p>
              <p className="text-4xl font-extrabold text-[#1D70F5] mt-1">{gpa.toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-1">out of 4.00</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{totalCredits}</p>
                <p className="text-xs text-slate-500">Total Credits</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{totalPoints.toFixed(1)}</p>
                <p className="text-xs text-slate-500">Total Points</p>
              </div>
            </div>

            {/* Grade Distribution */}
            {Object.keys(gradeDistribution).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Grade Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(gradeDistribution).map(([letter, count]) => (
                    <span key={letter} className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {letter}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Prompt Modal */}
      {showInvitePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-5 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Free Trial Used Up</h2>
              <p className="text-sm text-slate-600 mb-4">
                You've used your free GPA calculation. Share Fresho with friends to unlock unlimited calculations!
              </p>
              <button
                onClick={generateInviteLink}
                className="w-full bg-[#1D70F5] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mb-3"
              >
                <Share2 className="w-4 h-4" /> Get Invite Link
              </button>
              <button
                onClick={() => setShowInvitePrompt(false)}
                className="w-full py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
