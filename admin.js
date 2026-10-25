/**
 * EXCELLENCE COACHING CLASSES, GALLE BORGAON, MAHARASHTRA
 * Dedicated Administrative Router & Integrated Operations Console
 * File: admin.js
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Operations Center | Excellence Coaching Classes</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.344.0/dist/umd/lucide.min.js"></script>
  <style>
    :root {
      --lavender: #A78BFA;
      --lavender-light: #EDE9FE;
      --sky-blue: #60A5FA;
      --sky-light: #E0F2FE;
      --mint: #6EE7B7;
      --mint-light: #D1FAE5;
      --coral: #FB7185;
      --coral-light: #FFE4E6;
      --sunshine: #FCD34D;
      --navy: #1E293B;
      --text-muted: #64748B;
      --bg: #F8FAFC;
      --white: #FFFFFF;
      --radius-sm: 14px;
      --radius-md: 20px;
      --radius-lg: 28px;

      --clay-box: 
        8px 8px 18px rgba(167, 139, 250, 0.12),
        -6px -6px 16px #FFFFFF,
        inset 2px 2px 4px rgba(255, 255, 255, 0.9),
        inset -2px -2px 4px rgba(167, 139, 250, 0.1);

      --clay-btn-purple:
        5px 5px 12px rgba(139, 92, 246, 0.35),
        -3px -3px 8px #FFFFFF,
        inset 1px 1px 2px rgba(255, 255, 255, 0.6);

      --clay-input:
        inset 3px 3px 6px rgba(167, 139, 250, 0.12),
        inset -3px -3px 6px #FFFFFF;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Nunito', sans-serif; }
    body { background-color: var(--bg); color: var(--navy); display: flex; min-height: 100vh; }
    h1, h2, h3, h4 { font-family: 'Poppins', sans-serif; font-weight: 700; }

    /* Security Gatekeeper Login Overlay */
    #gatekeeper {
      display: flex; align-items: center; justify-content: center;
      width: 100vw; height: 100vh; position: fixed; top: 0; left: 0;
      background: #F1F5F9; z-index: 1000;
    }
    .gate-box {
      background: white; border-radius: var(--radius-lg); padding: 40px;
      max-width: 420px; width: 100%; box-shadow: var(--clay-box); text-align: center;
    }

    /* Admin Sidebar */
    .sidebar {
      width: 260px; background: white; border-right: 2px solid rgba(255, 255, 255, 0.8);
      box-shadow: 4px 0 20px rgba(167, 139, 250, 0.08); padding: 24px 16px;
      display: flex; flex-direction: column; justify-content: space-between;
      position: sticky; top: 0; height: 100vh;
    }
    .side-nav { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-top: 24px; }
    .side-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      border-radius: var(--radius-sm); font-weight: 700; font-size: 0.9rem; color: var(--text-muted);
      cursor: pointer; transition: all 0.2s;
    }
    .side-item:hover, .side-item.active {
      background: var(--lavender-light); color: #6D28D9; transform: translateX(3px);
    }

    /* Main Content Area */
    .main-body { flex: 1; padding: 32px; overflow-y: auto; }
    .clay-card {
      background: var(--white); border-radius: var(--radius-md);
      box-shadow: var(--clay-box); border: 2px solid rgba(255, 255, 255, 0.85);
    }
    .clay-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-radius: 20px; border: none;
      font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .btn-purple { background: linear-gradient(135deg, #A78BFA, #8B5CF6); color: white; box-shadow: var(--clay-btn-purple); }
    .btn-white { background: white; color: var(--navy); box-shadow: 3px 3px 8px rgba(167, 139, 250, 0.1), -2px -2px 6px #FFFFFF; }

    .clay-input {
      width: 100%; padding: 10px 14px; border-radius: var(--radius-sm);
      border: 1px solid transparent; background: #F8FAFC;
      box-shadow: var(--clay-input); font-weight: 600; outline: none;
    }
    .clay-input:focus { border-color: var(--lavender); background: white; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-bottom: 28px; }
    .stat-card { padding: 20px; display: flex; align-items: center; gap: 16px; }

    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 12px 16px; background: #F8FAFC; font-weight: 800; font-size: 0.82rem; }
    td { padding: 12px 16px; border-top: 1px solid #F1F5F9; font-size: 0.88rem; font-weight: 600; }

    @media (max-width: 900px) {
      body { flex-direction: column; }
      .sidebar { width: 100%; height: auto; position: static; }
      .side-nav { flex-direction: row; flex-wrap: wrap; }
    }
  </style>
</head>
<body>

  <!-- ADMIN AUTH GATEKEEPER VIEW -->
  <div id="gatekeeper">
    <div class="gate-box">
      <div style="width: 48px; height: 48px; border-radius: 16px; background: var(--lavender); color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
        <i data-lucide="lock"></i>
      </div>
      <h3 style="margin-bottom: 8px;">Admin Gateway</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 24px;">Excellence Coaching Classes • Galle Borgaon</p>

      <form onsubmit="handleAdminLogin(event)">
        <input type="text" id="adminIdent" class="clay-input" placeholder="Admin Email / Username" required style="margin-bottom: 12px;">
        <input type="password" id="adminPass" class="clay-input" placeholder="Password" required style="margin-bottom: 18px;">
        <button type="submit" class="clay-btn btn-purple" style="width: 100%;">Access Operations</button>
      </form>
    </div>
  </div>

  <!-- AUTHENTICATED ADMIN OPERATIONS SIDEBAR -->
  <aside class="sidebar">
    <div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 12px; background: #8B5CF6; color: white; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="shield-check" style="width: 20px;"></i>
        </div>
        <div>
          <div style="font-weight: 800; font-size: 0.95rem;">STAFF DESK</div>
          <div style="font-size: 0.7rem; color: #8B5CF6; font-weight: 800;">GALLE BORGAON</div>
        </div>
      </div>

      <ul class="side-nav">
        <li class="side-item active" onclick="showTab('tab-dash')"><i data-lucide="layout-dashboard" style="width: 18px;"></i> Overview</li>
        <li class="side-item" onclick="showTab('tab-enq')"><i data-lucide="users" style="width: 18px;"></i> Admissions</li>
        <li class="side-item" onclick="showTab('tab-course')"><i data-lucide="book-open" style="width: 18px;"></i> Courses</li>
        <li class="side-item" onclick="showTab('tab-tests')"><i data-lucide="check-square" style="width: 18px;"></i> Online Tests</li>
        <li class="side-item" onclick="showTab('tab-resources')"><i data-lucide="file-text" style="width: 18px;"></i> Resources</li>
        <li class="side-item" onclick="showTab('tab-announcements')"><i data-lucide="bell" style="width: 18px;"></i> Notices</li>
        <li class="side-item" onclick="showTab('tab-students')"><i data-lucide="user-check" style="width: 18px;"></i> Students</li>
      </ul>
    </div>

    <div>
      <a href="/" target="_blank" class="clay-btn btn-white" style="width: 100%; margin-bottom: 8px; justify-content: center;">
        <i data-lucide="external-link" style="width: 16px;"></i> Public Website
      </a>
      <button class="clay-btn btn-white" onclick="adminSignOut()" style="width: 100%; justify-content: center; color: #E11D48;">
        <i data-lucide="log-out" style="width: 16px;"></i> Log Out
      </button>
    </div>
  </aside>

  <main class="main-body">
    <!-- 1. OVERVIEW TAB -->
    <div id="tab-dash">
      <h2 style="margin-bottom: 20px;">Operations Overview</h2>

      <div class="stat-grid">
        <div class="clay-card stat-card">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--sky-light); color: #0284C7; display: flex; align-items: center; justify-content: center;"><i data-lucide="user-plus"></i></div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 800;" id="stEnq">0</div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Enquiries</div>
          </div>
        </div>

        <div class="clay-card stat-card">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--lavender-light); color: #7C3AED; display: flex; align-items: center; justify-content: center;"><i data-lucide="graduation-cap"></i></div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 800;" id="stStudents">0</div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Students</div>
          </div>
        </div>

        <div class="clay-card stat-card">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--mint-light); color: #059669; display: flex; align-items: center; justify-content: center;"><i data-lucide="book"></i></div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 800;" id="stCourses">0</div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Courses</div>
          </div>
        </div>

        <div class="clay-card stat-card">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--coral-light); color: #E11D48; display: flex; align-items: center; justify-content: center;"><i data-lucide="award"></i></div>
          <div>
            <div style="font-size: 1.5rem; font-weight: 800;" id="stAttempts">0</div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Exam Submissions</div>
          </div>
        </div>
      </div>

      <div class="clay-card" style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">Recent Admission Applications</h3>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Student</th>
                <th>Phone</th>
                <th>Course</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="dashEnqTbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. ENQUIRIES TAB -->
    <div id="tab-enq" style="display: none;">
      <div class="clay-card" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3>Admission Enquiries Desk</h3>
          <a href="/api/admin/export/enquiries" class="clay-btn btn-purple"><i data-lucide="download"></i> Export CSV</a>
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Student</th>
                <th>Phone</th>
                <th>Course</th>
                <th>Update Status</th>
                <th>Quick Chat</th>
              </tr>
            </thead>
            <tbody id="allEnqTbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 3. COURSES TAB -->
    <div id="tab-course" style="display: none;">
      <div class="clay-card" style="padding: 24px; margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Add New Academic Course</h3>
        <form onsubmit="handleNewCourse(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <input type="text" id="cTitle" class="clay-input" placeholder="Course Title" required>
          <input type="text" id="cClass" class="clay-input" placeholder="Target Class (e.g. 11th & 12th)">
          <input type="number" id="cFee" class="clay-input" placeholder="Fee (₹)" required>
          <input type="text" id="cDur" class="clay-input" placeholder="Duration (e.g. 1 Year)">
          <div style="grid-column: span 2;">
            <input type="text" id="cDesc" class="clay-input" placeholder="Syllabus Overview">
          </div>
          <button type="submit" class="clay-btn btn-purple" style="width: 140px;">Add Course</button>
        </form>
      </div>

      <div class="clay-card" style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">Active Courses</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Class</th>
              <th>Fee</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="coursesAdminTbody"></tbody>
        </table>
      </div>
    </div>

    <!-- 4. TESTS AUTHORING STUDIO TAB -->
    <div id="tab-tests" style="display: none;">
      <div class="clay-card" style="padding: 24px; margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Create Timed MCQ Test</h3>
        <form onsubmit="handleCreateAdminTest(event)">
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
            <input type="text" id="tTitle" class="clay-input" placeholder="Test Title (e.g. Wave Optics Mock 1)" required>
            <input type="text" id="tSubject" class="clay-input" placeholder="Subject (Physics/Chemistry)" required>
            <input type="number" id="tDuration" class="clay-input" placeholder="Duration (Mins)" value="20" required>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 16px;">
            <label style="font-weight: 700; font-size: 0.85rem;">
              <input type="checkbox" id="tNegative" checked> Enable -0.25 Negative Marking (CET/NEET Format)
            </label>
          </div>

          <div style="background: #F8FAFC; padding: 18px; border-radius: var(--radius-sm); margin-bottom: 16px; border: 1px solid #E2E8F0;">
            <h4 style="font-size: 0.95rem; margin-bottom: 10px;">Question #1</h4>
            <input type="text" id="tQText" class="clay-input" placeholder="Enter Question Stem" required style="margin-bottom: 10px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <input type="text" id="tOpt0" class="clay-input" placeholder="Option A" required>
              <input type="text" id="tOpt1" class="clay-input" placeholder="Option B" required>
              <input type="text" id="tOpt2" class="clay-input" placeholder="Option C" required>
              <input type="text" id="tOpt3" class="clay-input" placeholder="Option D" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">Correct Option:</label>
                <select id="tCorrect" class="clay-input">
                  <option value="0">Option A</option>
                  <option value="1">Option B</option>
                  <option value="2">Option C</option>
                  <option value="3">Option D</option>
                </select>
              </div>
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">Solution / Explanation:</label>
                <input type="text" id="tExp" class="clay-input" placeholder="e.g. Formula derived from Snell's law.">
              </div>
            </div>
          </div>

          <button type="submit" class="clay-btn btn-purple">Publish Assessment</button>
        </form>
      </div>

      <div class="clay-card" style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">Active Practice Tests</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Duration</th>
              <th>Questions</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="testsAdminTbody"></tbody>
        </table>
      </div>
    </div>

    <!-- 5. STUDY MATERIAL TAB -->
    <div id="tab-resources" style="display: none;">
      <div class="clay-card" style="padding: 24px; margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Add Study Material / Notes</h3>
        <form onsubmit="handleNewResource(event)" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <input type="text" id="rTitle" class="clay-input" placeholder="Resource Title (e.g. Electrostatics Notes)" required>
          <input type="text" id="rSubject" class="clay-input" placeholder="Subject (Physics/Maths)" required>
          <input type="text" id="rClass" class="clay-input" placeholder="Target Class (Class 11/12)" required>
          <input type="url" id="rUrl" class="clay-input" placeholder="Direct PDF Document URL" required>
          <div style="grid-column: span 2;">
            <input type="text" id="rDesc" class="clay-input" placeholder="Brief Description / Topics Covered">
          </div>
          <button type="submit" class="clay-btn btn-purple" style="width: 160px;">Upload Resource</button>
        </form>
      </div>

      <div class="clay-card" style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">Available Notes & Formula Sheets</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Class</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="resourcesAdminTbody"></tbody>
        </table>
      </div>
    </div>

    <!-- 6. CAMPUS ANNOUNCEMENTS TAB -->
    <div id="tab-announcements" style="display: none;">
      <div class="clay-card" style="padding: 24px; margin-bottom: 24px;">
        <h3 style="margin-bottom: 16px;">Publish Campus Announcement</h3>
        <form onsubmit="handleNewAnnouncement(event)" style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">
          <input type="text" id="aTitle" class="clay-input" placeholder="Announcement Title" required>
          <input type="text" id="aCat" class="clay-input" placeholder="Category (Exams/Holidays/Admissions)">
          <div style="grid-column: span 2;">
            <textarea id="aDesc" class="clay-input" rows="2" placeholder="Full notice message for students and parents..." required></textarea>
          </div>
          <button type="submit" class="clay-btn btn-purple" style="width: 160px;">Post Notice</button>
        </form>
      </div>

      <div class="clay-card" style="padding: 24px;">
        <h3 style="margin-bottom: 16px;">Published Notices</h3>
        <div id="annAdminList" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>
    </div>

    <!-- 7. REGISTERED STUDENTS TAB -->
    <div id="tab-students" style="display: none;">
      <div class="clay-card" style="padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3>Registered Student Accounts</h3>
          <input type="text" id="stuSearch" class="clay-input" placeholder="Search by name, phone..." style="width: 240px;" oninput="filterStudents()">
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Registered</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="studentsAdminTbody"></tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    lucide.createIcons();

    document.addEventListener('DOMContentLoaded', () => {
      verifyAdmin();
    });

    async function verifyAdmin() {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user.role === 'admin') {
        document.getElementById('gatekeeper').style.display = 'none';
        loadDashboardMetrics();
        loadAllEnquiries();
        loadAdminCourses();
        loadAdminTests();
        loadAdminResources();
        loadAdminAnnouncements();
        loadAdminStudents();
      } else {
        document.getElementById('gatekeeper').style.display = 'flex';
      }
    }

    async function handleAdminLogin(e) {
      e.preventDefault();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: document.getElementById('adminIdent').value,
          password: document.getElementById('adminPass').value
        })
      });
      const data = await res.json();
      if (data.success && data.user.role === 'admin') {
        document.getElementById('gatekeeper').style.display = 'none';
        loadDashboardMetrics();
        loadAllEnquiries();
        loadAdminCourses();
        loadAdminTests();
        loadAdminResources();
        loadAdminAnnouncements();
        loadAdminStudents();
      } else {
        alert(data.message || 'Staff verification failed');
      }
    }

    function showTab(id) {
      const tabs = ['tab-dash', 'tab-enq', 'tab-course', 'tab-tests', 'tab-resources', 'tab-announcements', 'tab-students'];
      tabs.forEach(t => {
        const el = document.getElementById(t);
        if (el) el.style.display = (t === id) ? 'block' : 'none';
      });
      document.querySelectorAll('.side-item').forEach(el => el.classList.remove('active'));
      event.currentTarget.classList.add('active');
    }

    async function loadDashboardMetrics() {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      if (data.success) {
        document.getElementById('stEnq').innerText = data.metrics.enquiries;
        document.getElementById('stStudents').innerText = data.metrics.students;
        document.getElementById('stCourses').innerText = data.metrics.courses;
        document.getElementById('stAttempts').innerText = data.metrics.attempts;

        const tbody = document.getElementById('dashEnqTbody');
        tbody.innerHTML = '';
        data.recentEnquiries.forEach(eq => {
          tbody.innerHTML += \`
            <tr>
              <td><strong>\${eq.referenceNumber}</strong></td>
              <td>\${eq.studentName}</td>
              <td>\${eq.phone}</td>
              <td>\${eq.desiredCourse}</td>
              <td>\${eq.status}</td>
            </tr>
          \`;
        });
        lucide.createIcons();
      }
    }

    async function loadAllEnquiries() {
      const res = await fetch('/api/admin/enquiries');
      const data = await res.json();
      const tbody = document.getElementById('allEnqTbody');
      tbody.innerHTML = '';
      (data.enquiries || []).forEach(eq => {
        tbody.innerHTML += \`
          <tr>
            <td><strong>\${eq.referenceNumber}</strong></td>
            <td>\${eq.studentName}</td>
            <td><a href="tel:\${eq.phone}">\${eq.phone}</a></td>
            <td>\${eq.desiredCourse}</td>
            <td>
              <select onchange="changeStatus('\${eq._id}', this.value)" style="padding: 4px 8px; border-radius: 8px;">
                <option value="New" \${eq.status==='New'?'selected':''}>New</option>
                <option value="Contacted" \${eq.status==='Contacted'?'selected':''}>Contacted</option>
                <option value="Admitted" \${eq.status==='Admitted'?'selected':''}>Admitted</option>
              </select>
            </td>
            <td>
              <a href="https://wa.me/91\${eq.phone}" target="_blank" style="color: #059669; font-weight: 700;">WhatsApp</a>
            </td>
          </tr>
        \`;
      });
      lucide.createIcons();
    }

    async function changeStatus(id, val) {
      await fetch('/api/admin/enquiries/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: val })
      });
      loadDashboardMetrics();
    }

    async function loadAdminCourses() {
      const res = await fetch('/api/courses');
      const data = await res.json();
      const tbody = document.getElementById('coursesAdminTbody');
      tbody.innerHTML = '';
      (data.courses || []).forEach(c => {
        tbody.innerHTML += \`
          <tr>
            <td>\${c.title}</td>
            <td>\${c.targetClass}</td>
            <td>₹\${Number(c.fee).toLocaleString('en-IN')}</td>
            <td>
              <button onclick="delCourse('\${c._id}')" class="clay-btn btn-white" style="color: #E11D48; padding: 4px 10px;">Delete</button>
            </td>
          </tr>
        \`;
      });
      lucide.createIcons();
    }

    async function handleNewCourse(e) {
      e.preventDefault();
      await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.getElementById('cTitle').value,
          targetClass: document.getElementById('cClass').value,
          fee: document.getElementById('cFee').value,
          duration: document.getElementById('cDur').value,
          description: document.getElementById('cDesc').value
        })
      });
      e.target.reset();
      loadAdminCourses();
      loadDashboardMetrics();
    }

    async function delCourse(id) {
      if (!confirm('Delete this course?')) return;
      await fetch('/api/admin/courses/' + id, { method: 'DELETE' });
      loadAdminCourses();
      loadDashboardMetrics();
    }

    async function loadAdminTests() {
      const res = await fetch('/api/tests');
      const data = await res.json();
      const tbody = document.getElementById('testsAdminTbody');
      tbody.innerHTML = '';
      (data.tests || []).forEach(t => {
        tbody.innerHTML += \`
          <tr>
            <td><strong>\${t.title}</strong></td>
            <td>\${t.subject}</td>
            <td>\${t.durationMinutes} Mins</td>
            <td>\${t.questions ? t.questions.length : 0} Qs</td>
            <td>
              <button onclick="delTest('\${t._id}')" class="clay-btn btn-white" style="color: #E11D48; padding: 4px 10px;">Remove</button>
            </td>
          </tr>
        \`;
      });
      lucide.createIcons();
    }

    async function handleCreateAdminTest(e) {
      e.preventDefault();
      const payload = {
        title: document.getElementById('tTitle').value,
        subject: document.getElementById('tSubject').value,
        durationMinutes: Number(document.getElementById('tDuration').value),
        enableNegativeMarking: document.getElementById('tNegative').checked,
        questions: [{
          id: 'q_' + Date.now(),
          text: document.getElementById('tQText').value,
          options: [
            document.getElementById('tOpt0').value,
            document.getElementById('tOpt1').value,
            document.getElementById('tOpt2').value,
            document.getElementById('tOpt3').value
          ],
          correctAnswerIndex: Number(document.getElementById('tCorrect').value),
          explanation: document.getElementById('tExp').value
        }]
      };
      await fetch('/api/admin/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      e.target.reset();
      loadAdminTests();
      loadDashboardMetrics();
    }

    async function delTest(id) {
      if (!confirm('Delete this test?')) return;
      await fetch('/api/admin/tests/' + id, { method: 'DELETE' });
      loadAdminTests();
      loadDashboardMetrics();
    }

    async function loadAdminResources() {
      const res = await fetch('/api/resources');
      const data = await res.json();
      const tbody = document.getElementById('resourcesAdminTbody');
      tbody.innerHTML = '';
      (data.resources || []).forEach(r => {
        tbody.innerHTML += \`
          <tr>
            <td><strong>\${r.title}</strong></td>
            <td>\${r.subject}</td>
            <td>\${r.targetClass}</td>
            <td>
              <button onclick="delResource('\${r._id}')" class="clay-btn btn-white" style="color: #E11D48; padding: 4px 10px;">Delete</button>
            </td>
          </tr>
        \`;
      });
      lucide.createIcons();
    }

    async function handleNewResource(e) {
      e.preventDefault();
      await fetch('/api/admin/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.getElementById('rTitle').value,
          subject: document.getElementById('rSubject').value,
          targetClass: document.getElementById('rClass').value,
          fileUrl: document.getElementById('rUrl').value,
          description: document.getElementById('rDesc').value
        })
      });
      e.target.reset();
      loadAdminResources();
    }

    async function delResource(id) {
      if (!confirm('Remove this resource?')) return;
      await fetch('/api/admin/resources/' + id, { method: 'DELETE' });
      loadAdminResources();
    }

    async function loadAdminAnnouncements() {
      const res = await fetch('/api/announcements');
      const data = await res.json();
      const div = document.getElementById('annAdminList');
      div.innerHTML = '';
      (data.announcements || []).forEach(a => {
        div.innerHTML += \`
          <div class="clay-card" style="padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>\${a.title}</strong>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">\${a.description}</p>
            </div>
            <button onclick="delAnnouncement('\${a._id}')" class="clay-btn btn-white" style="color: #E11D48; padding: 4px 10px;">Delete</button>
          </div>
        \`;
      });
      lucide.createIcons();
    }

    async function handleNewAnnouncement(e) {
      e.preventDefault();
      await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: document.getElementById('aTitle').value,
          category: document.getElementById('aCat').value,
          description: document.getElementById('aDesc').value
        })
      });
      e.target.reset();
      loadAdminAnnouncements();
    }

    async function delAnnouncement(id) {
      if (!confirm('Remove this announcement?')) return;
      await fetch('/api/admin/announcements/' + id, { method: 'DELETE' });
      loadAdminAnnouncements();
    }

    let allStudentsCache = [];
    async function loadAdminStudents() {
      const res = await fetch('/api/admin/students');
      const data = await res.json();
      allStudentsCache = data.students || [];
      renderStudentsTable(allStudentsCache);
    }

    function renderStudentsTable(list) {
      const tbody = document.getElementById('studentsAdminTbody');
      tbody.innerHTML = '';
      list.forEach(s => {
        tbody.innerHTML += \`
          <tr>
            <td><strong>\${s.fullName}</strong></td>
            <td>\${s.phone}</td>
            <td>\${s.email}</td>
            <td>\${new Date(s.createdAt).toLocaleDateString()}</td>
            <td>
              <a href="tel:\${s.phone}" class="clay-btn btn-white" style="padding: 4px 10px; font-size: 0.8rem;">Call</a>
            </td>
          </tr>
        \`;
      });
      lucide.createIcons();
    }

    function filterStudents() {
      const q = document.getElementById('stuSearch').value.toLowerCase();
      const filtered = allStudentsCache.filter(s => 
        s.fullName.toLowerCase().includes(q) || s.phone.includes(q) || s.email.toLowerCase().includes(q)
      );
      renderStudentsTable(filtered);
    }

    async function adminSignOut() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.reload();
    }
  </script>
</body>
</html>`);
});
module.exports = router;
