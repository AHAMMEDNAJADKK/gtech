# gtech - Production-Ready EdTech CRM & Learning Management System

A minimal, professional, production-ready Customer Relationship Management (CRM) and Learning Management System (LMS) purpose-built for EdTech institutes, training academies, and coding bootcamps. Built on the modern **MERN stack** (MongoDB Atlas, Express.js, React 19, Node.js, Vite 8, Tailwind CSS).

---

## 🚀 Core EdTech Workflow

```
PROSPECT / ENQUIRY
       ↓ (Lead capture with course interest, source, and counselor assignment)
ACADEMIC COUNSELOR
       ↓ (Call tracking, follow-up dates, notes, status: New → Follow Up → Interested)
CONVERSION TO STUDENT
       ↓ (Auto-generates student ID STD-YYYY-XXXXXX, creates student user account)
COURSE & BATCH ALLOCATION
       ↓ (Assigns instructor, schedule timings, enrolls in cohort)
STUDENT LMS LEARNING PORTAL
       ↓ (/academy/learning: curriculum syllabus, lessons, video player, resources)
STUDENT ATTENDANCE
       ↓ (/student-attendance: daily attendance recording, Present/Absent, percentage overview)
ASSIGNMENTS & GRADING
       ↓ (/assignments: instructor creates tasks, student submissions, scoring & feedback)
FEES & INSTALLMENTS
       ↓ (/accounts: tuition fee plans, installment schedules, Razorpay checkout, PDF receipts)
COURSE COMPLETION
       ↓ (Completion criteria check: 100% lessons & passing assignments)
AUTOMATED CERTIFICATE
       ↓ (/certificates: landscape vector PDF, unique verification code, public QR verification)
```

---

## 🌟 Key Features

### 1. 🎓 Admissions & Academic Counselor Pipeline
- Prospect & lead capture with course preference and source tracking.
- Academic counselor ownership, call reminders, follow-up scheduling, and call logs.
- 1-click lead-to-student conversion (`POST /api/v1/leads/:id/convert-to-student`).

### 2. 📚 Course & Batch Management
- Structured course builder: curriculum modules, syllabi, text lessons, materials, tuition fees.
- Batch scheduling: cohort timings, instructors, student capacities, enrolled rosters.

### 3. 💻 Student Learning Portal (LMS)
- `/academy/learning`: Clean student portal displaying enrolled courses and progress percentage.
- Course syllabus viewer with video lessons, document attachments, and topic checklists.

### 4. 📅 Student Attendance Tracking
- `/student-attendance`: Batch-wise date selection, 1-click Present/Absent marking.
- Student attendance percentage tracking and historical attendance logs.

### 5. 📝 Assignments & Grading
- `/assignments`: Create batch assignments with due dates and submission formats.
- Student submission portal with instructor grade evaluation and feedback notes.

### 6. 💳 Student Fees & Online Payments
- `/accounts`: Student tuition ledger with custom installment schedules.
- Razorpay payment gateway integration for online tuition payments.
- Automatic receipt generation (`RCP-YYYY-XXXXXX`) and downloadable vector PDF receipts.

### 7. 📹 Virtual Classrooms (Google Meet & Zoom)
- `/live-classes`: Schedule and manage live video lectures.
- Direct "Join Class" buttons for students and instructors.

### 8. 🏆 Automated Certificate Generation & Public QR Verification
- `/certificates`: Issues verified certificates upon course completion.
- Vector landscape PDF certificate generator built with PDFKit.
- Public QR code verification page (`/verify-certificate/:code`) for credential validation.

### 9. 📊 Focused EdTech Dashboard
- 13 real-time operational KPIs: Total Enquiries, Active Leads, Follow-ups Due, Converted Students, Active Students, Active Courses, Active Batches, Upcoming Classes, Today's Attendance, Pending Assignments, Tuition Collected, Tuition Due, Certificates Issued.

### 10. 🔐 Role-Based Access Control (RBAC)
- **ADMIN**: Full system control.
- **COUNSELOR**: Lead pipeline, follow-ups, and conversions.
- **INSTRUCTOR**: Assigned batches, attendance, live classes, assignments, and grading.
- **STUDENT**: Isolated access to own courses, attendance, fees, submissions, and certificates.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, MongoDB Atlas (Mongoose), JWT, Bcrypt, PDFKit, QRCode, Razorpay.
- **Frontend**: React 19, Vite 8, Tailwind CSS, Framer Motion, Lucide Icons, React Router DOM 7.
- **Database**: MongoDB Atlas Cluster.

---

## ⚙️ Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/AHAMMEDNAJADKK/gtech.git
cd gtech
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd "front crm"
npm install
npm run dev
```

Visit `http://localhost:5173` to access the application.
