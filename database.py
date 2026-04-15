import sqlite3
import math
import os
from datetime import date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "jims.db")


def get_conn():
    """Return a connection with row_factory so rows behave like dicts."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # safe concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")
    return conn



SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    NOT NULL UNIQUE,
    password TEXT    NOT NULL,
    role     TEXT    NOT NULL CHECK(role IN ('admin','student'))
);

CREATE TABLE IF NOT EXISTS students (
    db_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    email      TEXT    DEFAULT '',
    phone      TEXT    DEFAULT '',
    section    TEXT    NOT NULL DEFAULT 'MCA Sec-A',
    semester   INTEGER NOT NULL DEFAULT 2,
    avatar     TEXT    NOT NULL DEFAULT '#1e40af',
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    code    TEXT NOT NULL UNIQUE,
    name    TEXT NOT NULL,
    section TEXT NOT NULL,
    color   TEXT NOT NULL DEFAULT '#1e40af'
);

CREATE TABLE IF NOT EXISTS attendance (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    student_db_id  INTEGER NOT NULL REFERENCES students(db_id) ON DELETE CASCADE,
    subject_id     INTEGER NOT NULL REFERENCES subjects(id)    ON DELETE CASCADE,
    date           TEXT    NOT NULL,
    status         TEXT    NOT NULL CHECK(status IN ('present','absent','leave')),
    marked_by      TEXT    NOT NULL DEFAULT 'ADMIN001',
    UNIQUE(student_db_id, subject_id, date)
);

CREATE TABLE IF NOT EXISTS leaves (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT    NOT NULL UNIQUE,
    student_db_id  INTEGER NOT NULL REFERENCES students(db_id) ON DELETE CASCADE,
    type           TEXT    NOT NULL,
    from_date      TEXT    NOT NULL,
    to_date        TEXT    NOT NULL,
    days           INTEGER NOT NULL DEFAULT 1,
    reason         TEXT    NOT NULL DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    applied_on     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS seed_done (
    id   INTEGER PRIMARY KEY,
    done INTEGER DEFAULT 0
);
"""


def init_db():
    """Create tables and seed initial data (runs only once)."""
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()

    already = conn.execute("SELECT done FROM seed_done WHERE id=1").fetchone()
    if already and already["done"] == 1:
        conn.close()
        return

    _seed(conn)
    conn.execute("INSERT OR REPLACE INTO seed_done(id, done) VALUES(1, 1)")
    conn.commit()
    conn.close()


def _seed(conn):
    # Admin user
    conn.execute("INSERT OR IGNORE INTO users(username,password,role) VALUES(?,?,?)",
                 ("ADMIN001", "admin123", "admin"))

    # Student users
    student_users = [
        ("04414004425", "password123"),
        ("04614004425", "password123"),
        ("04714004425", "password123"),
        ("05614004425", "password123"),
        ("09914004425", "password123"),
        ("09214004425", "password123"),
    ]
    for uname, pwd in student_users:
        conn.execute("INSERT OR IGNORE INTO users(username,password,role) VALUES(?,?,?)",
                     (uname, pwd, "student"))

    # Students
    students_data = [
        ("04414004425", "Gagandeep Singh", "gagandeep@jims.edu", "9876543210", "MCA Sec-A", 2, "#1a7a6e"),
        ("04614004425", "Ajeet Singh",     "ajeet@jims.edu",     "9876543211", "MCA Sec-A", 2, "#9333ea"),
        ("04714004425", "Pushpansh Pandey","pushpansh@jims.edu", "9876543212", "MCA Sec-A", 2, "#c94040"),
        ("05614004425", "Namit Joshi",     "namit@jims.edu",     "9876543213", "MCA Sec-A", 2, "#d97706"),
        ("09914004425", "Karan Sharma",    "karan@jims.edu",     "9876543214", "MCA Sec-B", 2, "#1e40af"),
        ("09214004425", "Vansh Arora",     "vansh@jims.edu",     "9876543215", "MCA Sec-B", 2, "#be185d"),
    ]
    for sid, name, email, phone, section, sem, avatar in students_data:
        user = conn.execute("SELECT id FROM users WHERE username=?", (sid,)).fetchone()
        if user:
            conn.execute("""
                INSERT OR IGNORE INTO students(student_id,name,email,phone,section,semester,avatar,user_id)
                VALUES(?,?,?,?,?,?,?,?)
            """, (sid, name, email, phone, section, sem, avatar, user["id"]))

    # Subjects
    subjects_data = [
        ("DS101",  "Data Structures",    "MCA Sec-A", "#1a7a6e"),
        ("PY101",  "Python Programming", "MCA Sec-A", "#9333ea"),
        ("FSD101", "Full Stack Dev",     "MCA Sec-A", "#d97706"),
        ("DM101",  "Digital Marketing",  "MCA Sec-A", "#c94040"),
        ("OS101",  "OOSE",               "MCA Sec-A", "#1e40af"),
        ("DS201",  "Data Structures",    "MCA Sec-B", "#1a7a6e"),
        ("PY201",  "Python Programming", "MCA Sec-B", "#9333ea"),
    ]
    for code, name, section, color in subjects_data:
        conn.execute("INSERT OR IGNORE INTO subjects(code,name,section,color) VALUES(?,?,?,?)",
                     (code, name, section, color))

    # Leaves
    leaves_data = [
        ("L001", 1, "Medical",  "2026-02-10", "2026-02-12", 3, "Fever and flu, doctor advised rest",          "pending",  "2026-02-08"),
        ("L002", 2, "Family",   "2026-02-14", "2026-02-14", 1, "Sibling wedding ceremony",                    "approved", "2026-02-09"),
        ("L003", 3, "Academic", "2026-02-18", "2026-02-19", 2, "Inter-college tech fest participation",        "pending",  "2026-02-10"),
        ("L004", 4, "Medical",  "2026-02-05", "2026-02-07", 3, "Dental surgery recovery",                     "rejected", "2026-02-04"),
        ("L005", 1, "Personal", "2026-02-20", "2026-02-20", 1, "Personal emergency",                          "approved", "2026-02-19"),
        ("L006", 5, "Medical",  "2026-03-01", "2026-03-03", 3, "Viral fever",                                 "pending",  "2026-02-28"),
        ("L007", 2, "Sports",   "2026-03-05", "2026-03-05", 1, "State level chess tournament",                "approved", "2026-03-03"),
    ]
    for code, sdb, ltype, fdate, tdate, days, reason, status, applied in leaves_data:
        # Map positional dbId to actual db_id from students table
        stu = conn.execute("SELECT db_id FROM students LIMIT 1 OFFSET ?", (sdb-1,)).fetchone()
        if stu:
            conn.execute("""
                INSERT OR IGNORE INTO leaves(code,student_db_id,type,from_date,to_date,days,reason,status,applied_on)
                VALUES(?,?,?,?,?,?,?,?,?)
            """, (code, stu["db_id"], ltype, fdate, tdate, days, reason, status, applied))
            # Mark attendance for pre-approved seeded leaves
            if status == "approved":
                leave_row = conn.execute(
                    "SELECT * FROM leaves WHERE code=?", (code,)).fetchone()
                if leave_row:
                    auto_mark_leave(conn, dict(leave_row))

    # Seed attendance — last 40 working days
    def rand(seed_val):
        x = math.sin(seed_val) * 10000
        return x - math.floor(x)

    targets = {}
    students_rows = conn.execute("SELECT db_id FROM students ORDER BY db_id").fetchall()
    target_vals   = [87, 94, 72, 91, 65, 98]
    for i, row in enumerate(students_rows):
        targets[row["db_id"]] = target_vals[i] if i < len(target_vals) else 75

    subjects_rows = conn.execute("SELECT id, section FROM subjects").fetchall()
    secA_subs = [r["id"] for r in subjects_rows if r["section"] == "MCA Sec-A"]
    secB_subs = [r["id"] for r in subjects_rows if r["section"] == "MCA Sec-B"]

    all_students = conn.execute("SELECT db_id, section FROM students").fetchall()
    today = date.today()
    seed  = 0
    att_rows = []

    for days_back in range(40, -1, -1):
        d = today - timedelta(days=days_back)
        if d.weekday() >= 5:
            continue
        date_str = d.strftime("%Y-%m-%d")
        for stu in all_students:
            subs   = secA_subs if stu["section"] == "MCA Sec-A" else secB_subs
            target = targets.get(stu["db_id"], 75)
            for sub_id in subs:
                seed += 1
                status = "present" if rand(seed * 7 + stu["db_id"] * 13 + sub_id) * 100 <= target else "absent"
                att_rows.append((stu["db_id"], sub_id, date_str, status))

    conn.executemany("""
        INSERT OR IGNORE INTO attendance(student_db_id, subject_id, date, status)
        VALUES(?,?,?,?)
    """, att_rows)


# ─────────────────────────────────────────────
#  QUERY HELPERS  (used by app.py)
# ─────────────────────────────────────────────

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def rows_to_list(rows):
    return [dict(r) for r in rows]


def calc_summary(conn, student_db_id):
    row = conn.execute("""
        SELECT
            COUNT(*)                                        AS total,
            SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
            SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent,
            SUM(CASE WHEN status='leave'   THEN 1 ELSE 0 END) AS on_leave
        FROM attendance WHERE student_db_id=?
    """, (student_db_id,)).fetchone()
    total    = row["total"]   or 0
    present  = row["present"] or 0
    absent   = row["absent"]  or 0
    on_leave = row["on_leave"]or 0
    pct = round((present + on_leave) / total * 100) if total > 0 else 0
    return {"total": total, "present": present, "absent": absent, "onLeave": on_leave, "percentage": pct}


def calc_subject_att(conn, student_db_id, section):
    subs = rows_to_list(conn.execute(
        "SELECT * FROM subjects WHERE section=?", (section,)).fetchall())
    result = []
    for sub in subs:
        r = conn.execute("""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present,
                   SUM(CASE WHEN status='leave'   THEN 1 ELSE 0 END) AS on_leave
            FROM attendance WHERE student_db_id=? AND subject_id=?
        """, (student_db_id, sub["id"])).fetchone()
        total    = r["total"]    or 0
        present  = r["present"]  or 0
        on_leave = r["on_leave"] or 0
        pct = round((present + on_leave) / total * 100) if total > 0 else 0
        result.append({**sub, "total": total, "present": present, "onLeave": on_leave, "pct": pct,
                        "classes": f"{present}/{total}"})
    return result


def get_calendar(conn, student_db_id):
    rows = conn.execute(
        "SELECT date, status FROM attendance WHERE student_db_id=?",
        (student_db_id,)).fetchall()
    return {r["date"]: r["status"] for r in rows}


def auto_mark_leave(conn, leave):
    stu = conn.execute(
        "SELECT db_id, section FROM students WHERE db_id=?",
        (leave["student_db_id"],)).fetchone()
    if not stu:
        return
    subs = conn.execute(
        "SELECT id FROM subjects WHERE section=?", (stu["section"],)).fetchall()

    from datetime import datetime, timedelta
    d   = datetime.strptime(leave["from_date"], "%Y-%m-%d")
    end = datetime.strptime(leave["to_date"],   "%Y-%m-%d")
    while d <= end:
        if d.weekday() < 5:
            ds = d.strftime("%Y-%m-%d")
            for sub in subs:
                conn.execute("""
                    INSERT INTO attendance(student_db_id, subject_id, date, status)
                    VALUES(?,?,?,'leave')
                    ON CONFLICT(student_db_id, subject_id, date)
                    DO UPDATE SET status='leave'
                """, (stu["db_id"], sub["id"], ds))
        d += timedelta(days=1)
