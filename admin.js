/**
 * EXCELLENCE COACHING CLASSES — Admin Management Portal
 * Location: Galle Borgaon, Maharashtra, India
 * 
 * Self-contained Express Router rendering the complete claymorphism
 * administrator dashboard, real-time metrics, status workflows, and CSV exports.
 */

const express = require('express');
const router = express.Router();

router.get('*', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Staff Portal | Excellence Coaching Classes</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
    :root {
      --bg-canvas: #F0F4F8;
      --navy: #0F172A;
      --text-main: #1E293B;
      --text-muted: #64748B;
      
      --clay-purple: #7C3AED;
      --clay-purple-light: #F3E8FF;
      --clay-blue: #0284C7;
      --clay-blue-light: #E0F2FE;
      --clay-coral: #EA580C;
      --clay-coral-light: #FFEDD5;
      --clay-mint: #059669;
      --clay-mint-light: #D1FAE5;
      --clay-yellow: #D97706;
      --clay-yellow-light: #FEF3C7;

      --clay-shadow-card: 10px 10px 24px rgba(180, 195, 220, 0.4), -8px -8px 20px #FFFFFF;
      --clay-shadow-button: 5px 5px 12px rgba(160, 175, 205, 0.45), -4px -4px 10px #FFFFFF;
      --clay-shadow-pressed: inset 3px 3px 6px rgba(160, 175, 205, 0.5), inset -3px -3px 6px #FFFFFF;

      --radius-sm: 14px;
      --radius-md: 20px;
      --radius-lg: 28px;
      --radius-full: 9999px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg-canvas); color: var(--text-main); }
    h1, h2, h3, h4 { font-family: 'Space Grotesk', sans-serif; color: var(--navy); }

    #authView {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: linear-gradient(135deg, #EEF2F6 0%, #E2E8F0 100%);
    }

    .login-card {
      max-width: 440px;
      width: 100%;
      background: #FFFFFF;
      padding: 40px 32px;
      border-radius: var(--radius-lg);
      box-shadow: var(--clay-shadow-card);
      border: 2px solid rgba(255, 255, 255, 0.8);
      text-align: center;
    }

    .login-icon-box {
      width: 64px;
      height: 64px;
      border-radius: 20px;
      background: linear-gradient(135deg, var(--clay-purple), #4F46E5);
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      margin: 0 auto 20px;
      box-shadow: 4px 4px 12px rgba(124, 58, 237, 0.35);
    }

    #dashboardView {
      display: none;
      min-height: 100vh;
    }

    .admin-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
    }

    .admin-sidebar {
      background: #FFFFFF;
      padding: 28px 20px;
      border-right: 1.5px solid #E2E8F0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      font-size: 1.15rem;
      margin-bottom: 36px;
    }

    .sidebar-menu { list-style: none; }
    .sidebar-menu li { margin-bottom: 8px; }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.92rem;
      color: var(--text-muted);
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
    }

    .sidebar-link:hover, .sidebar-link.active {
      background: var(--clay-purple-light);
      color: var(--clay-purple);
    }

    .admin-main { padding: 36px; overflow-y: auto; }
    .admin-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }

    .metrics-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 18px;
      margin-bottom: 32px;
    }

    .metric-clay-card {
      background: #FFFFFF;
      padding: 22px;
      border-radius: var(--radius-md);
      box-shadow: var(--clay-shadow-card);
      border: 1px solid rgba(255, 255, 255, 0.8);
      position: relative;
    }

    .metric-clay-card span {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-clay-card h3 { font-size: 2rem; margin-top: 8px; }

    .table-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #FFFFFF;
      padding: 10px 16px;
      border-radius: var(--radius-full);
      box-shadow: var(--clay-shadow-button);
      width: 320px;
    }

    .search-input-wrap input { border: none; outline: none; font-size: 0.9rem; width: 100%; }
    .filter-group { display: flex; gap: 12px; }

    .admin-select {
      padding: 10px 16px;
      border-radius: var(--radius-full);
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--navy);
      outline: none;
      box-shadow: var(--clay-shadow-button);
    }

    .table-container {
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      box-shadow: var(--clay-shadow-card);
      overflow-x: auto;
      border: 1px solid rgba(255, 255, 255, 0.7);
    }

    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      background: #F8FAFC;
      padding: 16px 20px;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      border-bottom: 1.5px solid #E2E8F0;
    }

    td {
      padding: 16px 20px;
      font-size: 0.9rem;
      border-bottom: 1px solid #F1F5F9;
      color: var(--navy);
    }

    tr:hover td { background: #F8FAFC; }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .badge-Pending { background: var(--clay-yellow-light); color: var(--clay-yellow); }
    .badge-Under-Review { background: var(--clay-blue-light); color: var(--clay-blue); }
    .badge-Contacted { background: var(--clay-purple-light); color: var(--clay-purple); }
    .badge-Approved { background: var(--clay-mint-light); color: var(--clay-mint); }
    .badge-Rejected { background: #FEE2E2; color: #DC2626; }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: var(--radius-full);
      font-size: 0.88rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      outline: none;
      box-shadow: var(--clay-shadow-button);
      transition: all 0.2s;
    }

    .admin-btn:hover { transform: translateY(-2px); }
    .admin-btn:active { transform: translateY(1px); box-shadow: var(--clay-shadow-pressed); }
    .admin-btn-primary { background: var(--clay-purple); color: #FFF; }
    .admin-btn-outline { background: #FFFFFF; color: var(--navy); }
    .admin-btn-mint { background: var(--clay-mint); color: #FFF; }

    .admin-modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .admin-modal-overlay.open { display: flex; }

    .admin-modal {
      max-width: 680px;
      width: 100%;
      background: #FFFFFF;
      padding: 32px;
      border-radius: var(--radius-lg);
      box-shadow: var(--clay-shadow-card);
      max-height: 90vh;
      overflow-y: auto;
    }

    @media (max-width: 1024px) {
      .admin-layout { grid-template-columns: 1fr; }
      .admin-sidebar { display: none; }
      .metrics-row { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>

  <!-- AUTHENTICATION SCREEN -->
  <section id="authView">
    <div class="login-card">
      <div class="login-icon-box">
        <i class="fa-solid fa-shield-halved"></i>
      </div>
      <h2 style="font-size: 1.6rem; margin-bottom: 6px;">Excellence Staff Login</h2>
      <p style="font-size: 0.88rem; margin-bottom: 24px;">Galle Borgaon Administrative System</p>

      <form id="loginForm" novalidate>
        <div style="margin-bottom: 16px; text-align: left;">
          <label style="font-size: 0.82rem; font-weight: 700; display: block; margin-bottom: 6px;">Admin Email</label>
          <input type="email" id="adminEmail" required placeholder="admin@excellence.example" style="width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid #CBD5E1; outline: none;">
        </div>

        <div style="margin-bottom: 24px; text-align: left;">
          <label style="font-size: 0.82rem; font-weight: 700; display: block; margin-bottom: 6px;">Password</label>
          <input type="password" id="adminPassword" required placeholder="••••••••" style="width: 100%; padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid #CBD5E1; outline: none;">
        </div>

        <button type="submit" class="admin-btn admin-btn-primary" id="loginBtn" style="width: 100%; justify-content: center; padding: 13px;">
          <i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal
        </button>
      </form>

      <div style="margin-top: 24px; font-size: 0.82rem; color: var(--text-muted); border-top: 1px dashed #CBD5E1; padding-top: 16px;">
        <a href="/" style="color: var(--clay-purple); text-decoration: none; font-weight: 600;">
          <i class="fa-solid fa-arrow-left"></i> Return to Public Website
        </a>
      </div>
    </div>
  </section>

  <!-- DASHBOARD VIEW -->
  <div id="dashboardView">
    <div class="admin-layout">
      <!-- SIDEBAR -->
      <aside class="admin-sidebar">
        <div>
          <div class="sidebar-brand">
            <div style="width: 38px; height: 38px; border-radius: 12px; background: var(--clay-purple); color: #FFF; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div>
              Excellence Admin
              <small style="display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Galle Borgaon</small>
            </div>
          </div>

          <ul class="sidebar-menu">
            <li><a class="sidebar-link active" onclick="loadDashboard()"><i class="fa-solid fa-chart-pie"></i> Admissions</a></li>
            <li><a href="/" target="_blank" class="sidebar-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Live Website</a></li>
          </ul>
        </div>

        <div>
          <div style="padding: 12px; background: #F8FAFC; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.82rem;">
            <strong id="loggedUserEmail" style="display: block; overflow: hidden; text-overflow: ellipsis;">admin</strong>
            <span style="color: var(--clay-mint); font-weight: 600;">Authenticated Session</span>
          </div>
          <button class="admin-btn admin-btn-outline" style="width: 100%; justify-content: center;" onclick="logout()">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
          </button>
        </div>
      </aside>

      <!-- MAIN CONTENT -->
      <main class="admin-main">
        <div class="admin-top-header">
          <div>
            <h1 style="font-size: 1.8rem;">Admissions Management</h1>
            <p style="font-size: 0.88rem; color: var(--text-muted);">Monitor and process student enrollment applications from Galle Borgaon.</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <a href="/api/admin/export.csv" class="admin-btn admin-btn-mint" download>
              <i class="fa-solid fa-file-csv"></i> Export Authorized CSV
            </a>
            <button class="admin-btn admin-btn-outline" onclick="fetchAdmissions()">
              <i class="fa-solid fa-rotate"></i> Refresh
            </button>
          </div>
        </div>

        <!-- STATS METRICS -->
        <div class="metrics-row">
          <div class="metric-clay-card">
            <span>Total Enrolled</span>
            <h3 id="statTotal">0</h3>
          </div>
          <div class="metric-clay-card" style="border-left: 4px solid var(--clay-yellow);">
            <span>Pending Review</span>
            <h3 id="statPending" style="color: var(--clay-yellow);">0</h3>
          </div>
          <div class="metric-clay-card" style="border-left: 4px solid var(--clay-blue);">
            <span>Under Review</span>
            <h3 id="statUnderReview" style="color: var(--clay-blue);">0</h3>
          </div>
          <div class="metric-clay-card" style="border-left: 4px solid var(--clay-purple);">
            <span>Contacted</span>
            <h3 id="statContacted" style="color: var(--clay-purple);">0</h3>
          </div>
          <div class="metric-clay-card" style="border-left: 4px solid var(--clay-mint);">
            <span>Approved Seats</span>
            <h3 id="statApproved" style="color: var(--clay-mint);">0</h3>
          </div>
        </div>

        <!-- CONTROLS & FILTERS -->
        <div class="table-controls">
          <div class="search-input-wrap">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-muted);"></i>
            <input type="text" id="searchInput" placeholder="Search by name, ref, or phone..." oninput="debounceSearch()">
          </div>

          <div class="filter-group">
            <select id="filterStatus" class="admin-select" onchange="fetchAdmissions()">
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Contacted">Contacted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>

            <select id="filterCourse" class="admin-select" onchange="fetchAdmissions()">
              <option value="All">All Programs</option>
              <option value="class-11-sci">Class 11 Science</option>
              <option value="class-12-sci">Class 12 Science</option>
              <option value="mht-cet">MHT-CET</option>
              <option value="jee-prep">JEE Prep</option>
              <option value="neet-prep">NEET Prep</option>
            </select>
          </div>
        </div>

        <!-- ADMISSIONS TABLE -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Student</th>
                <th>Course</th>
                <th>Batch / City</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="admissionsTbody">
              <tr><td colspan="7" style="text-align: center; padding: 30px;">Loading student applications...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- PAGINATION CONTROLS -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
          <span style="font-size: 0.88rem; color: var(--text-muted);" id="paginationInfo">Showing 0 of 0</span>
          <div style="display: flex; gap: 8px;">
            <button class="admin-btn admin-btn-outline" id="prevPageBtn" onclick="changePage(-1)">&laquo; Previous</button>
            <button class="admin-btn admin-btn-outline" id="nextPageBtn" onclick="changePage(1)">Next &raquo;</button>
          </div>
        </div>
      </main>
    </div>
  </div>

  <!-- APPLICATION DETAILS & STATUS MODAL -->
  <div class="admin-modal-overlay" id="detailModal">
    <div class="admin-modal">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          <span class="status-badge" id="modalBadge">Status</span>
          <h2 id="modalRefTitle" style="font-size: 1.4rem; margin-top: 6px;">Application Reference</h2>
        </div>
        <button onclick="closeDetailModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 0.9rem;">
        <div><strong>Student Name:</strong> <span id="modalStudentName">-</span></div>
        <div><strong>Parent Name:</strong> <span id="modalParentName">-</span></div>
        <div><strong>Student Mobile:</strong> <span id="modalStudentMobile">-</span></div>
        <div><strong>Parent Mobile:</strong> <span id="modalParentMobile">-</span></div>
        <div><strong>Student Email:</strong> <span id="modalStudentEmail">-</span></div>
        <div><strong>Target Program:</strong> <span id="modalCourseName">-</span></div>
        <div><strong>Batch Preference:</strong> <span id="modalBatch">-</span></div>
        <div><strong>Location:</strong> <span id="modalLocation">-</span></div>
        <div><strong>Previous Exam %:</strong> <span id="modalPercentage">-</span></div>
        <div><strong>Submitted On:</strong> <span id="modalDate">-</span></div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 6px;">Student Questions / Aspirations</label>
        <p id="modalStudentMessage" style="font-size: 0.88rem; background: #F8FAFC; padding: 12px; border-radius: var(--radius-sm); color: var(--text-muted); font-style: italic;">None provided.</p>
      </div>

      <hr style="border: 0; border-top: 1px dashed #CBD5E1; margin: 20px 0;">

      <form id="statusUpdateForm">
        <input type="hidden" id="currentRecordId">
        <div style="margin-bottom: 16px;">
          <label style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 6px;">Update Admission Status</label>
          <select id="updateStatusSelect" class="admin-select" style="width: 100%;">
            <option value="Pending">Pending</option>
            <option value="Under Review">Under Review</option>
            <option value="Contacted">Contacted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 6px;">Administrative Internal Notes</label>
          <textarea id="updateNotes" rows="3" style="width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid #CBD5E1;" placeholder="Record counseling remarks or fee confirmation dates..."></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button type="button" class="admin-btn admin-btn-outline" onclick="closeDetailModal()">Cancel</button>
          <button type="submit" class="admin-btn admin-btn-primary" id="saveStatusBtn">Save Changes</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let currentPage = 1;
    let searchTimeout = null;
    let admissionsStore = [];

    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/me');
        const json = await res.json();
        if (res.ok && json.success) {
          showDashboard(json.user);
        } else {
          showLogin();
        }
      } catch (e) {
        showLogin();
      }
    }

    function showLogin() {
      document.getElementById('authView').style.display = 'flex';
      document.getElementById('dashboardView').style.display = 'none';
    }

    function showDashboard(user) {
      document.getElementById('authView').style.display = 'none';
      document.getElementById('dashboardView').style.display = 'block';
      document.getElementById('loggedUserEmail').textContent = user.email;
      loadDashboard();
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminEmail').value.trim();
      const password = document.getElementById('adminPassword').value;
      const btn = document.getElementById('loginBtn');

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showDashboard(data.user);
        } else {
          alert(data.error || 'Login failed. Please check credentials.');
        }
      } catch (err) {
        alert('Server unreachable. Please verify configuration.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Portal';
      }
    });

    async function logout() {
      await fetch('/api/admin/logout', { method: 'POST' });
      showLogin();
    }

    async function loadDashboard() {
      fetchMetrics();
      fetchAdmissions();
    }

    async function fetchMetrics() {
      try {
        const res = await fetch('/api/admin/dashboard');
        const data = await res.json();
        if (data.success && data.stats) {
          document.getElementById('statTotal').textContent = data.stats.total;
          document.getElementById('statPending').textContent = data.stats.pending;
          document.getElementById('statUnderReview').textContent = data.stats.underReview;
          document.getElementById('statContacted').textContent = data.stats.contacted;
          document.getElementById('statApproved').textContent = data.stats.approved;
        }
      } catch (e) {
        console.error('Metrics fetch error:', e);
      }
    }

    async function fetchAdmissions() {
      const status = document.getElementById('filterStatus').value;
      const course = document.getElementById('filterCourse').value;
      const search = document.getElementById('searchInput').value.trim();

      const params = new URLSearchParams({
        page: currentPage,
        limit: 15,
        status,
        course,
        search
      });

      const tbody = document.getElementById('admissionsTbody');
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Fetching records...</td></tr>';

      try {
        const res = await fetch('/api/admin/admissions?' + params.toString());
        const json = await res.json();
        if (json.success) {
          admissionsStore = json.data;
          renderTable(json.data);
          updatePagination(json.pagination);
        }
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error retrieving records.</td></tr>';
      }
    }

    function renderTable(list) {
      const tbody = document.getElementById('admissionsTbody');
      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">No admission applications found matching query.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(item => {
        const badgeClass = 'badge-' + (item.status.replace(/\\s+/g, '-'));
        const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        return \`
          <tr>
            <td><strong>\${item.referenceNumber}</strong></td>
            <td>
              <div>\${item.studentName}</div>
              <small style="color: var(--text-muted);">\${item.studentMobile}</small>
            </td>
            <td>\${item.desiredCourseName}</td>
            <td>\${item.city}</td>
            <td><span class="status-badge \${badgeClass}">\${item.status}</span></td>
            <td>\${dateStr}</td>
            <td>
              <button class="admin-btn admin-btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="openDetailModal('\${item._id}')">
                Manage
              </button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function updatePagination(pagination) {
      document.getElementById('paginationInfo').textContent = \`Showing page \${pagination.page} of \${pagination.totalPages} (\${pagination.total} records)\`;
      document.getElementById('prevPageBtn').disabled = pagination.page <= 1;
      document.getElementById('nextPageBtn').disabled = pagination.page >= pagination.totalPages;
    }

    function changePage(delta) {
      currentPage += delta;
      fetchAdmissions();
    }

    function debounceSearch() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        fetchAdmissions();
      }, 350);
    }

    function openDetailModal(id) {
      const item = admissionsStore.find(a => a._id === id);
      if (!item) return;

      document.getElementById('currentRecordId').value = item._id;
      document.getElementById('modalRefTitle').textContent = item.referenceNumber;
      document.getElementById('modalBadge').textContent = item.status;
      document.getElementById('modalBadge').className = 'status-badge badge-' + item.status.replace(/\\s+/g, '-');
      
      document.getElementById('modalStudentName').textContent = item.studentName;
      document.getElementById('modalParentName').textContent = item.parentName;
      document.getElementById('modalStudentMobile').textContent = item.studentMobile;
      document.getElementById('modalParentMobile').textContent = item.parentMobile;
      document.getElementById('modalStudentEmail').textContent = item.studentEmail;
      document.getElementById('modalCourseName').textContent = item.desiredCourseName;
      document.getElementById('modalBatch').textContent = item.preferredBatch;
      document.getElementById('modalLocation').textContent = item.city + ', ' + item.state;
      document.getElementById('modalPercentage').textContent = item.previousPercentage ? (item.previousPercentage + '%') : 'Not specified';
      document.getElementById('modalDate').textContent = new Date(item.createdAt).toLocaleString('en-IN');
      document.getElementById('modalStudentMessage').textContent = item.message || 'No additional questions provided.';

      document.getElementById('updateStatusSelect').value = item.status;
      document.getElementById('updateNotes').value = item.internalNotes || '';

      document.getElementById('detailModal').classList.add('open');
    }

    function closeDetailModal() {
      document.getElementById('detailModal').classList.remove('open');
    }

    document.getElementById('statusUpdateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('currentRecordId').value;
      const status = document.getElementById('updateStatusSelect').value;
      const internalNotes = document.getElementById('updateNotes').value;
      const btn = document.getElementById('saveStatusBtn');

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

      try {
        const res = await fetch(\`/api/admin/admissions/\${id}/status\`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, internalNotes })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          closeDetailModal();
          fetchMetrics();
          fetchAdmissions();
        } else {
          alert(data.error || 'Failed to update record.');
        }
      } catch (err) {
        alert('Server unreachable.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Changes';
      }
    });

    checkAuth();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

module.exports = router;
