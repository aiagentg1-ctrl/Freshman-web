from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, Enum, ForeignKey, Text, UniqueConstraint
import enum
from datetime import datetime
from database import Base


class GradeEnum(enum.Enum):
    GRADE_9 = 9
    GRADE_10 = 10
    GRADE_11 = 11
    GRADE_12 = 12


class StreamEnum(enum.Enum):
    # Grades 9-10 study the common curriculum and get no stream choice.
    GENERAL = "GENERAL"
    NATURAL = "NATURAL"
    SOCIAL = "SOCIAL"


class SubjectEnum(enum.Enum):
    LOGIC = "logic"
    PSYCHOLOGY = "psychology"
    COMMUNICATIVE_ENGLISH = "communicative_english"
    EMERGING_TECHNOLOGY = "emerging_technology"
    ANTHROPOLOGY = "anthropology"
    GLOBAL_TRENDS = "global_trends"
    ENTREPRENEURSHIP = "entrepreneurship"
    ENGLISH = "english"
    PHYSICS = "physics"
    CHEMISTRY = "chemistry"
    BIOLOGY = "biology"
    APTITUDE = "aptitude"
    MATHEMATICS = "mathematics"
    CIVICS = "civics"
    HISTORY = "history"
    GEOGRAPHY = "geography"
    ECONOMICS = "economics"


class User(Base):
    __tablename__ = 'users'
    user_id = Column(BigInteger, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    custom_name = Column(String, nullable=True, default=None)  # User's preferred display name
    university = Column(String, nullable=True, default="")
    region = Column(String, nullable=True, default="")
    # Legacy school/city columns are retained for compatibility with existing profiles.
    school = Column(String, nullable=True, default="")
    city = Column(String, nullable=True, default="")
    grade = Column(Integer, nullable=False)
    stream = Column(Enum(StreamEnum), nullable=False)
    selected_subjects = Column(Text, nullable=False, default="[]", server_default="[]")
    premium_expires_at = Column(DateTime, nullable=True)
    # Legacy columns kept nullable so inserts still succeed on databases
    # created before the high-school-only pivot.
    referred_by = Column(BigInteger, nullable=True)
    referral_count = Column(Integer, default=0)
    unlocked_answers = Column(Boolean, default=False)
    total_score = Column(Integer, default=0)
    xp = Column(Integer, default=0)
    coins = Column(Integer, default=0)
    daily_streak = Column(Integer, default=0)
    frozen_streaks = Column(Integer, default=0)  # Number of streak freezes available
    last_active_date = Column(DateTime, nullable=True)
    # XP and Leveling system
    level = Column(Integer, default=1)
    # Matrik scores (preserved when stream changes)
    natural_matrik_score = Column(Integer, default=0)  # For Natural Science stream
    social_matrik_score = Column(Integer, default=0)  # For Social Science stream
    natural_matrik_breakdown = Column(Text, nullable=True)  # JSON string of Natural breakdown
    social_matrik_breakdown = Column(Text, nullable=True)  # JSON string of Social breakdown
    created_at = Column(DateTime, default=datetime.utcnow)


class ActiveDeviceSession(Base):
    """The single active Fresho mini-app installation for a Telegram user."""
    __tablename__ = "active_device_sessions"
    user_id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(String(128), nullable=False)
    token_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class EueeExam(Base):
    """An EUEE past exam uploaded by an admin as HTML or a PDF link/blob."""
    __tablename__ = 'euee_exams'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subject = Column(Enum(SubjectEnum), nullable=False, index=True)
    year = Column(String, nullable=False)  # e.g. "2016 E.C." or "2024 G.C."
    title = Column(String, nullable=False)
    # Freeform admin label, e.g. "Pilot Exam", "EUEE Model", "National Exam".
    custom_tag = Column(String, nullable=False, default="", server_default="")
    question_count = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    # "html" = interactive exam markup, "pdf" = a URL or data URI to a PDF.
    content_type = Column(String, nullable=False, default="html", server_default="html")
    content_data = Column(Text, nullable=False)
    semester = Column(String, nullable=False, default="all", server_default="all")
    is_premium = Column(Boolean, nullable=False, default=False, server_default="0")
    is_published = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow)


class EueeExamAttempt(Base):
    __tablename__ = 'euee_exam_attempts'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    exam_id = Column(Integer, ForeignKey('euee_exams.id'), nullable=False)
    score = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=False)
    time_spent = Column(Integer, nullable=True)  # seconds
    answers_json = Column(Text, nullable=True)  # JSON string of user's answers
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Note(Base):
    """A chapter of grade notes uploaded by an admin as sanitized HTML."""
    __tablename__ = 'notes'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subject = Column(Enum(SubjectEnum), nullable=False, index=True)
    grade = Column(Integer, nullable=False, index=True)  # 9, 10, 11, 12
    stream = Column(Enum(StreamEnum), nullable=True, default=None)  # Null for grades 9-10 (General)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    html_content = Column(Text, nullable=False)
    semester = Column(String, nullable=False, default="all", server_default="all")
    is_premium = Column(Boolean, nullable=False, default=False, server_default="0")
    is_published = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow)


class NoteCompletion(Base):
    """Track when users complete reading notes."""
    __tablename__ = 'note_completions'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    note_id = Column(Integer, ForeignKey('notes.id'), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserBadge(Base):
    """Track badges earned by users."""
    __tablename__ = 'user_badges'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    badge_name = Column(String, nullable=False)  # e.g., "First Step", "Perfect Score"
    badge_emoji = Column(String, nullable=False)  # e.g., "📖", "💯"
    earned_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class XpReward(Base):
    """Idempotency records for one-time milestone XP awards."""
    __tablename__ = 'xp_rewards'
    __table_args__ = (UniqueConstraint('user_id', 'reward_key', name='uq_xp_reward_user_key'),)
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    reward_key = Column(String, nullable=False)
    xp_awarded = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChapterExam(Base):
    """Chapter-specific EUEE questions (untimed practice)."""
    __tablename__ = 'chapter_exams'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    note_id = Column(Integer, ForeignKey('notes.id'), nullable=True)  # Optional link to a note/chapter
    subject = Column(Enum(SubjectEnum), nullable=False, index=True)
    grade = Column(Integer, nullable=False)
    stream = Column(Enum(StreamEnum), nullable=True, default=None)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    question_count = Column(Integer, nullable=False)
    content_type = Column(String, nullable=False, default="html", server_default="html")
    content_data = Column(Text, nullable=False)
    semester = Column(String, nullable=False, default="all", server_default="all")
    is_premium = Column(Boolean, nullable=False, default=False, server_default="0")
    is_published = Column(Boolean, nullable=False, default=True, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChapterExamAttempt(Base):
    """Attempts on chapter-specific exams (untimed, no leaderboard)."""
    __tablename__ = 'chapter_exam_attempts'
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey('users.user_id'), nullable=False, index=True)
    chapter_exam_id = Column(Integer, ForeignKey('chapter_exams.id'), nullable=False)
    score = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=False)
    answers_json = Column(Text, nullable=True)  # JSON string of user's answers
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
