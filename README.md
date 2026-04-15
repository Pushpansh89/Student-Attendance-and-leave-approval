# JIMS — Student Attendance & Leave Management System



```
attendance_system/
├── app.py               
├── data_store.py        
├── requirements.txt
├── templates/
│   └── index.html      
└── static/
    ├── css/
    │   └── style.css    
    └── js/
        └── app.js      
```

---

## Setup & Run

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the app
```bash
python app.py
```

### 3. Open in browser
```
http://localhost:5000
```

---

## Demo Credentials

| Role          | Username      | Password    |
|---------------|---------------|-------------|
| Administrator | ADMIN001      | admin123    |
| Student       | 04614004425   | password123 |
| Student       | 04414004425   | password123 |
| Student       | 04714004425   | password123 |
| Student       | 05614004425   | password123 |
| Student       | 09914004425   | password123 |
| Student       | 09214004425   | password123 |

---

## Features

### Student Dashboard
- Overall attendance %, days present/absent, leave count
- Subject-wise attendance with progress bars
- Recent leave status
- Attendance alerts for subjects below 75%

### Student — My Attendance
- Monthly calendar view (Present / Absent / Leave / Weekend)
- Subject-wise breakdown with progress bars
- Recent attendance log

### Student — Apply Leave
- Leave application form with type, dates, reason
- Working days calculator
- Leave balance by type
- Policy reminder

### Student — Leave History
- All leave applications with status

### Admin — Dashboard
- System-wide stats
- Pending leave approvals (quick approve/reject)
- Student attendance overview with progress bars

### Admin — Manage Attendance
- View all attendance records in a filterable table
- Filters: Student, Subject, Date range, Status
- **Edit** any record's status inline (dropdown)
- **Add** new attendance record via modal
- **Delete** any attendance record
- Paginated view (20 per page)

### Admin — Leave Requests
- View all leave applications
- Filter by status
- Approve / reject with auto-marking of leave status in attendance

### Admin — Students
- Student cards with attendance % and status badges
- Search by name/ID, filter by section/status
- Add new student (creates login credentials)
- Edit student details and password
- Delete student (removes all related records)

### Admin — Reports & Analytics
- 6-month attendance trend chart
- Leave status breakdown
- Leave type distribution 
- At-risk student list (below 75%)
- Export report buttons

# Student-Attendance-and-leave-approval
