import math, csv, io
from flask import Flask, request, jsonify, session, render_template, Response
from database import (get_conn, init_db, row_to_dict, rows_to_list,
                      calc_summary, calc_subject_att, get_calendar, auto_mark_leave)
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "jims-secret-key-2026"

init_db()   # create tables + seed once

# ─── STARTUP MIGRATION: ensure approved leaves are reflected in attendance ──
def _migrate_approved_leaves():
    """One-time fix: for every approved leave, ensure attendance rows exist.
    Safe to run multiple times — uses ON CONFLICT DO UPDATE."""
    conn = get_conn()
    approved = rows_to_list(conn.execute(
        "SELECT * FROM leaves WHERE status='approved'").fetchall())
    for leave in approved:
        auto_mark_leave(conn, leave)
    conn.commit()
    conn.close()

_migrate_approved_leaves()

def enrich_leave(row):
    d = dict(row) if not isinstance(row, dict) else row
    return {
        "id":            d["id"],
        "code":          d["code"],
        "studentDbId":   d["student_db_id"],
        "studentName":   d.get("student_name",""),
        "studentAvatar": d.get("student_avatar","#1e40af"),
        "studentIdStr":  d.get("student_id_str",""),
        "studentSection":d.get("student_section",""),
        "type":          d["type"],
        "fromDate":      d["from_date"],
        "toDate":        d["to_date"],
        "days":          d["days"],
        "reason":        d["reason"],
        "status":        d["status"],
        "appliedOn":     d["applied_on"],
    }

LEAVE_Q = """
    SELECT l.*,
           s.name       AS student_name,
           s.avatar     AS student_avatar,
           s.student_id AS student_id_str,
           s.section    AS student_section
    FROM leaves l
    JOIN students s ON s.db_id = l.student_db_id
"""

ATT_Q = """
    SELECT a.*,
           s.name       AS student_name,
           s.student_id AS student_id,
           s.avatar     AS student_avatar,
           s.section    AS section,
           sub.name     AS subject_name,
           sub.code     AS subject_code,
           sub.color    AS subject_color
    FROM attendance a
    JOIN students  s   ON s.db_id = a.student_db_id
    JOIN subjects  sub ON sub.id  = a.subject_id
"""

def stu_dict(conn, row):
    s   = dict(row) if not isinstance(row, dict) else row
    att = calc_summary(conn, s["db_id"])
    return {"dbId":s["db_id"],"studentId":s["student_id"],"name":s["name"],
            "email":s["email"],"phone":s["phone"],"section":s["section"],
            "semester":s["semester"],"avatar":s["avatar"],"userId":s["user_id"],**att}

# ─── MAIN ROUTE ────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ─── AUTH ──────────────────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def login():
    d    = request.json or {}
    conn = get_conn()
    user = row_to_dict(conn.execute(
        "SELECT * FROM users WHERE username=? AND password=? AND role=?",
        (d.get("username","").strip(), d.get("password","").strip(), d.get("role","student"))
    ).fetchone())
    conn.close()
    if not user:
        return jsonify({"error":"Invalid credentials"}),401
    session["user_id"] = user["id"]; session["role"] = user["role"]
    out = {"id":user["id"],"username":user["username"],"role":user["role"]}
    if user["role"] == "student":
        conn = get_conn()
        s = row_to_dict(conn.execute("SELECT * FROM students WHERE user_id=?",(user["id"],)).fetchone())
        conn.close()
        if s:
            out["student"] = {"dbId":s["db_id"],"studentId":s["student_id"],"name":s["name"],
                              "email":s["email"],"phone":s["phone"],"section":s["section"],
                              "semester":s["semester"],"avatar":s["avatar"],"userId":s["user_id"]}
    return jsonify(out)

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear(); return jsonify({"ok":True})

# ─── SUBJECTS ──────────────────────────────────────────────────────────────

@app.route("/api/subjects")
def get_subjects():
    conn = get_conn()
    rows = rows_to_list(conn.execute("SELECT * FROM subjects ORDER BY id").fetchall())
    conn.close(); return jsonify(rows)

# ─── STUDENTS ──────────────────────────────────────────────────────────────

@app.route("/api/students", methods=["GET"])
def get_students():
    conn   = get_conn()
    rows   = conn.execute("SELECT * FROM students ORDER BY db_id").fetchall()
    result = [stu_dict(conn, r) for r in rows]
    conn.close(); return jsonify(result)

@app.route("/api/students", methods=["POST"])
def add_student():
    d          = request.json or {}
    name       = (d.get("name") or "").strip()
    student_id = (d.get("studentId") or "").strip()
    if not name or not student_id:
        return jsonify({"error":"Name and Student ID are required"}),400
    conn = get_conn()
    if conn.execute("SELECT 1 FROM students WHERE student_id=?",(student_id,)).fetchone():
        conn.close(); return jsonify({"error":"Student ID already exists"}),400
    colors  = ["#1a7a6e","#9333ea","#c94040","#d97706","#1e40af","#be185d","#0891b2","#7c3aed"]
    count   = conn.execute("SELECT COUNT(*) AS c FROM students").fetchone()["c"]
    avatar  = d.get("avatar") or colors[count % len(colors)]
    password= d.get("password") or "password123"
    conn.execute("INSERT INTO users(username,password,role) VALUES(?,?,?)",(student_id,password,"student"))
    uid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO students(student_id,name,email,phone,section,semester,avatar,user_id) VALUES(?,?,?,?,?,?,?,?)",
                 (student_id,name,d.get("email",""),d.get("phone",""),
                  d.get("section","MCA Sec-A"),int(d.get("semester",2)),avatar,uid))
    db_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    row    = conn.execute("SELECT * FROM students WHERE db_id=?",(db_id,)).fetchone()
    result = stu_dict(conn, row)
    conn.close(); return jsonify(result),201

@app.route("/api/students/<sid>", methods=["PUT"])
def update_student(sid):
    d    = request.json or {}
    conn = get_conn()
    s    = row_to_dict(conn.execute("SELECT * FROM students WHERE student_id=?",(sid,)).fetchone())
    if not s: conn.close(); return jsonify({"error":"Not found"}),404
    conn.execute("UPDATE students SET name=?,email=?,phone=?,section=?,semester=? WHERE student_id=?",
                 (d.get("name",s["name"]),d.get("email",s["email"]),d.get("phone",s["phone"]),
                  d.get("section",s["section"]),int(d.get("semester",s["semester"])),sid))
    if d.get("password"):
        conn.execute("UPDATE users SET password=? WHERE id=?",(d["password"],s["user_id"]))
    conn.commit()
    row    = conn.execute("SELECT * FROM students WHERE student_id=?",(sid,)).fetchone()
    result = stu_dict(conn, row)
    conn.close(); return jsonify(result)

@app.route("/api/students/<sid>", methods=["DELETE"])
def delete_student(sid):
    conn = get_conn()
    s    = row_to_dict(conn.execute("SELECT * FROM students WHERE student_id=?",(sid,)).fetchone())
    if not s: conn.close(); return jsonify({"error":"Not found"}),404
    conn.execute("DELETE FROM students WHERE student_id=?",(sid,))
    conn.execute("DELETE FROM users    WHERE id=?",(s["user_id"],))
    conn.commit(); conn.close(); return jsonify({"ok":True})

# ─── ATTENDANCE ────────────────────────────────────────────────────────────

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    where, params = ["1=1"],[]
    if v := request.args.get("studentDbId",type=int): where.append("a.student_db_id=?"); params.append(v)
    if v := request.args.get("subjectId",  type=int): where.append("a.subject_id=?");    params.append(v)
    if v := request.args.get("date"):      where.append("a.date=?");    params.append(v)
    if v := request.args.get("dateFrom"):  where.append("a.date>=?");   params.append(v)
    if v := request.args.get("dateTo"):    where.append("a.date<=?");   params.append(v)
    if v := request.args.get("status"):    where.append("a.status=?");  params.append(v)
    if v := request.args.get("section"):   where.append("s.section=?"); params.append(v)
    conn = get_conn()
    rows = rows_to_list(conn.execute(
        ATT_Q+" WHERE "+" AND ".join(where)+" ORDER BY a.date DESC, s.name ASC", params).fetchall())
    conn.close()
    for r in rows:
        r["studentDbId"]  = r.pop("student_db_id")
        r["subjectId"]    = r.pop("subject_id")
        r["markedBy"]     = r.pop("marked_by","")
        r["studentName"]  = r.pop("student_name","")
        r["studentAvatar"]= r.pop("student_avatar","")
        r["studentId"]    = r.pop("student_id","")
        r["subjectName"]  = r.pop("subject_name","")
        r["subjectCode"]  = r.pop("subject_code","")
        r["subjectColor"] = r.pop("subject_color","")
    return jsonify(rows)

@app.route("/api/attendance", methods=["POST"])
def save_attendance():
    d = request.json or {}
    if not all([d.get("studentDbId"),d.get("subjectId"),d.get("date"),d.get("status")]):
        return jsonify({"error":"studentDbId, subjectId, date, status required"}),400
    conn = get_conn()
    conn.execute("""
        INSERT INTO attendance(student_db_id,subject_id,date,status) VALUES(?,?,?,?)
        ON CONFLICT(student_db_id,subject_id,date) DO UPDATE SET status=excluded.status
    """,(d["studentDbId"],d["subjectId"],d["date"],d["status"]))
    conn.commit()
    rec = row_to_dict(conn.execute(
        "SELECT * FROM attendance WHERE student_db_id=? AND subject_id=? AND date=?",
        (d["studentDbId"],d["subjectId"],d["date"])).fetchone())
    conn.close(); return jsonify(rec),201

@app.route("/api/attendance/bulk", methods=["POST"])
def bulk_attendance():
    items = request.json or []; saved = 0
    conn  = get_conn()
    for item in items:
        sid,sub,dt,st = item.get("studentDbId"),item.get("subjectId"),item.get("date"),item.get("status")
        if not all([sid,sub,dt,st]): continue
        conn.execute("""
            INSERT INTO attendance(student_db_id,subject_id,date,status) VALUES(?,?,?,?)
            ON CONFLICT(student_db_id,subject_id,date) DO UPDATE SET status=excluded.status
        """,(sid,sub,dt,st)); saved += 1
    conn.commit(); conn.close(); return jsonify({"saved":saved})

@app.route("/api/attendance/<int:att_id>", methods=["PUT"])
def update_att(att_id):
    status = (request.json or {}).get("status")
    if not status: return jsonify({"error":"status required"}),400
    conn = get_conn()
    conn.execute("UPDATE attendance SET status=? WHERE id=?",(status,att_id))
    conn.commit()
    rec = row_to_dict(conn.execute("SELECT * FROM attendance WHERE id=?",(att_id,)).fetchone())
    conn.close()
    return jsonify(rec) if rec else (jsonify({"error":"Not found"}),404)

@app.route("/api/attendance/<int:att_id>", methods=["DELETE"])
def delete_att(att_id):
    conn = get_conn()
    conn.execute("DELETE FROM attendance WHERE id=?",(att_id,))
    conn.commit(); conn.close(); return jsonify({"ok":True})

# ─── LEAVES ────────────────────────────────────────────────────────────────

@app.route("/api/leaves", methods=["GET"])
def get_leaves():
    conn = get_conn()
    sdi  = request.args.get("studentDbId",type=int)
    q    = LEAVE_Q+(" WHERE l.student_db_id=?" if sdi else "")+" ORDER BY l.applied_on DESC"
    rows = conn.execute(q,(sdi,) if sdi else ()).fetchall()
    conn.close(); return jsonify([enrich_leave(r) for r in rows])

@app.route("/api/leaves", methods=["POST"])
def add_leave():
    d  = request.json or {}
    fd,td = d.get("fromDate",""),d.get("toDate","")
    if not fd or not td: return jsonify({"error":"fromDate and toDate required"}),400
    dt  = datetime.strptime(fd,"%Y-%m-%d")
    end = datetime.strptime(td,"%Y-%m-%d")
    days = sum(1 for i in range((end-dt).days+1) if (dt+timedelta(days=i)).weekday()<5)
    conn  = get_conn()
    count = conn.execute("SELECT COUNT(*) AS c FROM leaves").fetchone()["c"]
    code  = f"L{str(count+1).zfill(3)}"
    conn.execute("""
        INSERT INTO leaves(code,student_db_id,type,from_date,to_date,days,reason,status,applied_on)
        VALUES(?,?,?,?,?,?,?,?,?)
    """,(code,d["studentDbId"],d.get("type","Personal"),fd,td,days,d.get("reason",""),
         "pending",datetime.now().strftime("%Y-%m-%d")))
    conn.commit()
    nid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    row = conn.execute(LEAVE_Q+" WHERE l.id=?",(nid,)).fetchone()
    conn.close(); return jsonify(enrich_leave(row)),201

@app.route("/api/leaves/<int:lid>", methods=["PUT"])
def update_leave(lid):
    status = (request.json or {}).get("status")
    if not status: return jsonify({"error":"status required"}),400
    conn  = get_conn()
    leave = row_to_dict(conn.execute("SELECT * FROM leaves WHERE id=?",(lid,)).fetchone())
    if not leave: conn.close(); return jsonify({"error":"Not found"}),404
    conn.execute("UPDATE leaves SET status=? WHERE id=?",(status,lid)); conn.commit()
    if status == "approved":
        updated = row_to_dict(conn.execute("SELECT * FROM leaves WHERE id=?",(lid,)).fetchone())
        auto_mark_leave(conn, updated); conn.commit()
    row = conn.execute(LEAVE_Q+" WHERE l.id=?",(lid,)).fetchone()
    conn.close(); return jsonify(enrich_leave(row))

# ─── STATS — STUDENT ───────────────────────────────────────────────────────

@app.route("/api/stats/student/<int:sdb>")
def student_stats(sdb):
    conn = get_conn()
    stu  = row_to_dict(conn.execute("SELECT * FROM students WHERE db_id=?",(sdb,)).fetchone())
    if not stu: conn.close(); return jsonify({"error":"Not found"}),404
    leaves = rows_to_list(conn.execute(
        "SELECT * FROM leaves WHERE student_db_id=? ORDER BY applied_on DESC",(sdb,)).fetchall())
    result = {"summary":calc_summary(conn,sdb),"subjects":calc_subject_att(conn,sdb,stu["section"]),
              "calendar":get_calendar(conn,sdb),"leaves":leaves}
    conn.close(); return jsonify(result)

# ─── STATS — ADMIN ─────────────────────────────────────────────────────────

@app.route("/api/stats/admin")
def admin_stats():
    conn    = get_conn()
    sturows = conn.execute("SELECT * FROM students ORDER BY db_id").fetchall()
    all_stu = [stu_dict(conn,r) for r in sturows]
    today   = datetime.now()
    ms      = today.strftime("%Y-%m")
    mrows   = conn.execute("SELECT status FROM attendance WHERE date LIKE ?",(ms+"%",)).fetchall()
    mp = round(sum(1 for r in mrows if r["status"] in ("present","leave"))/len(mrows)*100) if mrows else 0
    at_risk = sum(1 for s in all_stu if s["percentage"]<75)
    pl      = conn.execute("SELECT COUNT(*) AS c FROM leaves WHERE status='pending'").fetchone()["c"]
    months  = []
    for i in range(5,-1,-1):
        d2   = datetime(today.year,today.month,1)-timedelta(days=i*30)
        ms2  = d2.strftime("%Y-%m")
        rows2= conn.execute("SELECT status FROM attendance WHERE date LIKE ?",(ms2+"%",)).fetchall()
        pct2 = round(sum(1 for r in rows2 if r["status"] in ("present","leave"))/len(rows2)*100) if rows2 else 0
        months.append({"label":d2.strftime("%b"),"pct":pct2})
    ls = {k:conn.execute("SELECT COUNT(*) AS c FROM leaves WHERE status=?",(k,)).fetchone()["c"]
          for k in ("pending","approved","rejected")}
    ls["total"] = sum(ls.values())
    dist = [{"type":r["type"],"count":r["count"]} for r in
            conn.execute("SELECT type,COUNT(*) AS count FROM leaves GROUP BY type").fetchall()]
    pl_list = [enrich_leave(r) for r in conn.execute(
        LEAVE_Q+" WHERE l.status='pending' ORDER BY l.applied_on DESC LIMIT 5").fetchall()]
    conn.close()
    return jsonify({"totalStudents":len(all_stu),"monthlyAttendance":mp,"atRiskStudents":at_risk,
                    "pendingLeaves":pl,"allStudents":all_stu,"months":months,
                    "leaveStats":ls,"leaveDistribution":dist,"pendingLeavesList":pl_list})

# ─── EXPORT REPORTS ────────────────────────────────────────────────────────

from datetime import date as date_cls

def csv_response(rows, headers, filename):
    """Build a CSV download response."""
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    buf.seek(0)
    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.route("/api/export/attendance")
def export_attendance():
    """Merged attendance report – one row per student with each subject as columns + overall %.
    Supports dateFrom/dateTo filters."""
    conn      = get_conn()
    today     = date_cls.today()
    date_from = request.args.get("dateFrom", "")
    date_to   = request.args.get("dateTo",   "")
    where, params = [], []
    if date_from: where.append("a.date >= ?"); params.append(date_from)
    if date_to:   where.append("a.date <= ?"); params.append(date_to)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    rows_db = conn.execute(f"""
        SELECT s.db_id AS student_db_id,
               s.name  AS student_name, s.student_id, s.section, s.semester,
               sub.code AS subject_code, sub.name AS subject_name,
               COUNT(*)                                              AS total_classes,
               SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present,
               SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent,
               SUM(CASE WHEN a.status='leave'   THEN 1 ELSE 0 END) AS on_leave
        FROM attendance a
        JOIN students s   ON s.db_id = a.student_db_id
        JOIN subjects sub ON sub.id  = a.subject_id
        {where_sql}
        GROUP BY s.db_id, sub.id
        ORDER BY s.name, sub.name
    """, params).fetchall()

    # Fetch approved leave DAYS per student from leaves table (date-filtered)
    leave_where, leave_params = ["status='approved'"], []
    if date_from: leave_where.append("from_date >= ?"); leave_params.append(date_from)
    if date_to:   leave_where.append("to_date <= ?");   leave_params.append(date_to)
    leave_rows = conn.execute(
        "SELECT student_db_id, SUM(days) AS total_days FROM leaves WHERE "
        + " AND ".join(leave_where) + " GROUP BY student_db_id",
        leave_params
    ).fetchall()
    approved_leave_days = {r["student_db_id"]: (r["total_days"] or 0) for r in leave_rows}
    conn.close()

    # Pivot: collect all subjects in appearance order
    subject_order = []
    seen_subjects = set()
    student_map   = {}

    for r in rows_db:
        subj_key = r["subject_code"]
        if subj_key not in seen_subjects:
            seen_subjects.add(subj_key)
            subject_order.append((subj_key, r["subject_name"]))
        sid = r["student_db_id"]
        if sid not in student_map:
            student_map[sid] = {
                "student_name":  r["student_name"],
                "student_id":    r["student_id"],
                "section":       r["section"],
                "semester":      r["semester"],
                "subjects":      {},
                "total_present": 0,
                "total_leave":   0,
                "total_classes": 0,
            }
        student_map[sid]["subjects"][subj_key] = {
            "present":       r["present"],
            "on_leave":      r["on_leave"],
            "total_classes": r["total_classes"],
        }
        student_map[sid]["total_present"] += r["present"]
        student_map[sid]["total_leave"]   += r["on_leave"]
        student_map[sid]["total_classes"] += r["total_classes"]

    # Build dynamic headers
    base_headers = ["Student Name", "Student ID", "Section", "Semester"]
    subj_headers = []
    for code, name in subject_order:
        label = f"{name} ({code})"
        subj_headers += [f"{label} - Present", f"{label} - Total"]
    headers = base_headers + subj_headers + ["Overall Present", "On Leave", "Overall Total", "Overall %"]

    # Build rows
    data = []
    for sid, stu in sorted(student_map.items(), key=lambda x: x[1]["student_name"]):
        row = [stu["student_name"], stu["student_id"], stu["section"], stu["semester"]]
        for code, _ in subject_order:
            subj = stu["subjects"].get(code)
            if subj:
                effective_present = subj["present"] + subj["on_leave"]
                row += [effective_present, subj["total_classes"]]
            else:
                row += [0, 0]
        leave_days = approved_leave_days.get(sid, 0)
        effective = stu["total_present"] + stu["total_leave"]
        overall = round(effective / stu["total_classes"] * 100, 1) if stu["total_classes"] else 0.0
        row += [stu["total_present"], leave_days, stu["total_classes"], f"{overall}%"]
        data.append(row)

    date_label = f"{date_from}_to_{date_to}" if date_from or date_to else today.strftime('%Y%m%d')
    return csv_response(data, headers, f"attendance_report_{date_label}.csv")


@app.route("/api/export/leaves")
def export_leaves():
    """All leave applications with student details. Supports dateFrom/dateTo filters on applied_on."""
    conn      = get_conn()
    today     = date_cls.today()
    date_from = request.args.get("dateFrom", "")
    date_to   = request.args.get("dateTo",   "")
    where, params = [], []
    if date_from: where.append("l.applied_on >= ?"); params.append(date_from)
    if date_to:   where.append("l.applied_on <= ?"); params.append(date_to)
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    rows_db = conn.execute(f"""
        SELECT s.name AS student_name, s.student_id, s.section,
               l.code, l.type, l.from_date, l.to_date, l.days,
               l.reason, l.status, l.applied_on
        FROM leaves l
        JOIN students s ON s.db_id = l.student_db_id
        {where_sql}
        ORDER BY l.applied_on DESC
    """, params).fetchall()
    conn.close()
    date_label = f"{date_from}_to_{date_to}" if date_from or date_to else today.strftime('%Y%m%d')
    headers = ["Student Name","Student ID","Section","Leave Code",
               "Leave Type","From Date","To Date","Days",
               "Reason","Status","Applied On"]
    data = [(r["student_name"],r["student_id"],r["section"],r["code"],
             r["type"],r["from_date"],r["to_date"],r["days"],
             r["reason"],r["status"],r["applied_on"]) for r in rows_db]
    return csv_response(data, headers, f"leave_report_{date_label}.csv")


@app.route("/api/export/at-risk")
def export_at_risk():
    """Students with overall attendance below 75%. Supports dateFrom/dateTo to scope the calculation."""
    conn      = get_conn()
    today     = date_cls.today()
    date_from = request.args.get("dateFrom", "")
    date_to   = request.args.get("dateTo",   "")
    students_db = conn.execute("SELECT * FROM students ORDER BY name").fetchall()
    headers = ["Student Name","Student ID","Section","Semester",
               "Total Classes","Present","Absent","On Leave",
               "Attendance %","Classes Needed to Reach 75%"]
    data = []
    for s in students_db:
        # Build scoped attendance query
        where, params = ["student_db_id = ?"], [s["db_id"]]
        if date_from: where.append("date >= ?"); params.append(date_from)
        if date_to:   where.append("date <= ?"); params.append(date_to)
        rows = conn.execute(
            "SELECT status FROM attendance WHERE " + " AND ".join(where), params
        ).fetchall()
        total   = len(rows)
        present = sum(1 for r in rows if r["status"] == "present")
        absent  = sum(1 for r in rows if r["status"] == "absent")
        on_leave= sum(1 for r in rows if r["status"] == "leave")
        effective = present + on_leave
        pct     = round(effective / total * 100, 1) if total else 0.0
        if pct < 75:
            needed = max(0, math.ceil((0.75 * total - effective) / 0.25))
            data.append((s["name"], s["student_id"], s["section"], s["semester"],
                         total, present, absent, on_leave, f"{pct}%", needed))
    conn.close()
    date_label = f"{date_from}_to_{date_to}" if date_from or date_to else today.strftime('%Y%m%d')
    return csv_response(data, headers, f"at_risk_students_{date_label}.csv")


@app.route("/api/export/students")
def export_students():
    """All students with full attendance stats. Supports dateFrom/dateTo to scope stats."""
    conn      = get_conn()
    today     = date_cls.today()
    date_from = request.args.get("dateFrom", "")
    date_to   = request.args.get("dateTo",   "")
    rows_db   = conn.execute("SELECT * FROM students ORDER BY name").fetchall()
    headers   = ["Student Name","Student ID","Email","Phone",
                 "Section","Semester","Total Classes","Present",
                 "Absent","On Leave","Attendance %","Status"]
    data = []
    for s in rows_db:
        where, params = ["student_db_id = ?"], [s["db_id"]]
        if date_from: where.append("date >= ?"); params.append(date_from)
        if date_to:   where.append("date <= ?"); params.append(date_to)
        rows = conn.execute(
            "SELECT status FROM attendance WHERE " + " AND ".join(where), params
        ).fetchall()
        total   = len(rows)
        present = sum(1 for r in rows if r["status"] == "present")
        absent  = sum(1 for r in rows if r["status"] == "absent")
        on_leave= sum(1 for r in rows if r["status"] == "leave")
        pct     = round((present + on_leave) / total * 100, 1) if total else 0.0
        status  = "On Track" if pct >= 75 else "At Risk"
        data.append((s["name"], s["student_id"], s["email"], s["phone"],
                     s["section"], s["semester"],
                     total, present, absent, on_leave, f"{pct}%", status))
    conn.close()
    date_label = f"{date_from}_to_{date_to}" if date_from or date_to else today.strftime('%Y%m%d')
    return csv_response(data, headers, f"student_list_{date_label}.csv")

# ─── SUBJECT MANAGEMENT ────────────────────────────────────────────────────

@app.route("/api/subjects", methods=["POST"])
def add_subject():
    d = request.json or {}
    code    = (d.get("code") or "").strip().upper()
    name    = (d.get("name") or "").strip()
    section = (d.get("section") or "").strip()
    color   = d.get("color", "#1e40af")
    if not code or not name or not section:
        return jsonify({"error": "code, name and section are required"}), 400
    conn = get_conn()
    if conn.execute("SELECT 1 FROM subjects WHERE code=?", (code,)).fetchone():
        conn.close()
        return jsonify({"error": "Subject code already exists"}), 400
    conn.execute("INSERT INTO subjects(code,name,section,color) VALUES(?,?,?,?)",
                 (code, name, section, color))
    conn.commit()
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    row    = row_to_dict(conn.execute("SELECT * FROM subjects WHERE id=?", (new_id,)).fetchone())
    conn.close()
    return jsonify(row), 201

@app.route("/api/subjects/<int:sub_id>", methods=["PUT"])
def update_subject(sub_id):
    d    = request.json or {}
    conn = get_conn()
    sub  = row_to_dict(conn.execute("SELECT * FROM subjects WHERE id=?", (sub_id,)).fetchone())
    if not sub:
        conn.close()
        return jsonify({"error": "Subject not found"}), 404
    conn.execute("UPDATE subjects SET name=?, section=?, color=? WHERE id=?",
                 (d.get("name", sub["name"]), d.get("section", sub["section"]),
                  d.get("color", sub["color"]), sub_id))
    conn.commit()
    row = row_to_dict(conn.execute("SELECT * FROM subjects WHERE id=?", (sub_id,)).fetchone())
    conn.close()
    return jsonify(row)

@app.route("/api/subjects/<int:sub_id>", methods=["DELETE"])
def delete_subject(sub_id):
    conn = get_conn()
    conn.execute("DELETE FROM subjects WHERE id=?", (sub_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ─── STUDENT PROFILE ───────────────────────────────────────────────────────

@app.route("/api/profile", methods=["GET"])
def get_profile():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_conn()
    stu  = row_to_dict(conn.execute("SELECT * FROM students WHERE user_id=?", (user_id,)).fetchone())
    conn.close()
    if not stu:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify({"dbId": stu["db_id"], "studentId": stu["student_id"], "name": stu["name"],
                    "email": stu["email"], "phone": stu["phone"], "section": stu["section"],
                    "semester": stu["semester"], "avatar": stu["avatar"]})

@app.route("/api/profile/password", methods=["PUT"])
def change_password():
    d       = request.json or {}
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    old_pwd = d.get("oldPassword", "")
    new_pwd = d.get("newPassword", "")
    if not old_pwd or not new_pwd:
        return jsonify({"error": "Old and new password required"}), 400
    conn = get_conn()
    user = row_to_dict(conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone())
    if not user or user["password"] != old_pwd:
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 400
    conn.execute("UPDATE users SET password=? WHERE id=?", (new_pwd, user_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

# ─── NOTIFICATIONS ─────────────────────────────────────────────────────────

@app.route("/api/notifications")
def get_notifications():
    role    = session.get("role", "")
    user_id = session.get("user_id")
    conn    = get_conn()
    notifs  = []

    if role == "admin":
        rows = conn.execute("""
            SELECT l.id, l.type, l.from_date, l.to_date, l.days,
                   s.name AS student_name, l.applied_on
            FROM leaves l JOIN students s ON s.db_id = l.student_db_id
            WHERE l.status='pending'
            ORDER BY l.applied_on DESC LIMIT 10
        """).fetchall()
        for r in rows:
            notifs.append({
                "type":    "leave_pending",
                "message": f"{r['student_name']} applied for {r['type']} leave ({r['days']}d)",
                "date":    r["applied_on"],
                "leaveId": r["id"]
            })
    elif role == "student":
        stu = conn.execute("SELECT db_id FROM students WHERE user_id=?", (user_id,)).fetchone()
        if stu:
            rows = conn.execute("""
                SELECT id, type, status, from_date, to_date
                FROM leaves
                WHERE student_db_id=? AND status IN ('approved','rejected')
                ORDER BY applied_on DESC LIMIT 10
            """, (stu["db_id"],)).fetchall()
            for r in rows:
                emoji = "✅" if r["status"] == "approved" else "❌"
                notifs.append({
                    "type":    f"leave_{r['status']}",
                    "message": f"{emoji} {r['type']} leave ({r['from_date']} → {r['to_date']}) {r['status']}",
                    "date":    r["from_date"],
                    "leaveId": r["id"]
                })
    conn.close()
    return jsonify(notifs)

# ─── LEAVE CANCELLATION (student) ──────────────────────────────────────────

@app.route("/api/leaves/<int:lid>/cancel", methods=["PUT"])
def cancel_leave(lid):
    user_id = session.get("user_id")
    conn    = get_conn()
    stu     = row_to_dict(conn.execute(
        "SELECT db_id FROM students WHERE user_id=?", (user_id,)).fetchone())
    if not stu:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    leave = row_to_dict(conn.execute("SELECT * FROM leaves WHERE id=?", (lid,)).fetchone())
    if not leave:
        conn.close()
        return jsonify({"error": "Leave not found"}), 404
    if leave["student_db_id"] != stu["db_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    if leave["status"] != "pending":
        conn.close()
        return jsonify({"error": "Only pending leaves can be cancelled"}), 400
    conn.execute("DELETE FROM leaves WHERE id=?", (lid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
