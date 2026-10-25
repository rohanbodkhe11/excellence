/**
 * EXCELLENCE COACHING CLASSES — Core Application Server
 * Location: Galle Borgaon, Maharashtra, India
 * 
 * Production Node.js & Express server with MongoDB Atlas integration.
 * Serves public claymorphism website, REST APIs, and mounts admin portal.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const adminModule = require('./admin');

const app = express();

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'excellence_coaching_db';
const JWT_SECRET = process.env.JWT_SECRET || 'ecc-demo-secret-key-change-in-prod-2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const IS_PROD = process.env.NODE_ENV === 'production';

// Permitted Courses Catalog
const COURSES = [
  {
    id: 'class-11-sci',
    title: 'Class 11 Science (PCMB)',
    level: 'Higher Secondary (Grade 11)',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
    duration: '1 Academic Year',
    indicativeFee: '₹28,000 (Sample Indicative Fee)',
    description: 'Build an unshakeable foundation in senior secondary science concepts with comprehensive classroom sessions and systematic test evaluation.',
    features: ['NCERT & State Board Coverage', 'Daily Practice Problem (DPP) Sheets', 'Personal Doubt Counters', 'Bi-weekly Unit Assessments']
  },
  {
    id: 'class-12-sci',
    title: 'Class 12 Science Board Booster',
    level: 'Higher Secondary (Grade 12)',
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
    duration: '1 Academic Year',
    indicativeFee: '₹32,000 (Sample Indicative Fee)',
    description: 'Rigorous board syllabus coverage paired with answer-writing techniques, previous years question breakdowns, and simulated full-length pre-board exams.',
    features: ['Board Pattern Mock Papers', 'Derivation & Formula Booklets', 'Special Practical Guidance', 'Performance Mentorship']
  },
  {
    id: 'mht-cet',
    title: 'MHT-CET Target Accelerator',
    level: 'Class 11 & 12 Science Students',
    subjects: ['Physics', 'Chemistry', 'Mathematics / Biology'],
    duration: '8 to 10 Months Intensive',
    indicativeFee: '₹24,000 (Sample Indicative Fee)',
    description: 'Maharashtra CET focused test-series and shortcut pedagogy engineered to maximize speed, accuracy, and state percentile rank.',
    features: ['Maharashtra State Board Mapping', 'Computer-Based Test (CBT) Practice', 'Time Management Drill Modules', 'Chapter-wise Speed Tests']
  },
  {
    id: 'jee-prep',
    title: 'JEE Main & Advanced Foundation',
    level: 'Aspirants Targeting Engineering',
    subjects: ['Advanced Physics', 'Physical & Organic Chemistry', 'Calculus & Algebra'],
    duration: '1 to 2 Years Integrated',
    indicativeFee: '₹40,000 (Sample Indicative Fee)',
    description: 'Deep analytical problem-solving modules, multi-concept application sets, and calibrated national mock series for engineering aspirants.',
    features: ['Deep Concept Analysis', 'Multi-Concept Questions Archive', 'National Benchmark Mocks', 'Small Focus Batches']
  },
  {
    id: 'neet-prep',
    title: 'NEET-UG Medical Aspirant Program',
    level: 'Aspirants Targeting MBBS / BDS',
    subjects: ['Botany', 'Zoology', 'Physical & Organic Chemistry', 'Physics'],
    duration: '1 to 2 Years Integrated',
    indicativeFee: '₹40,000 (Sample Indicative Fee)',
    description: 'Line-by-line NCERT mastery with targeted Biology mnemonics, numerical speed conditioning in Physics, and error-reduction practice.',
    features: ['100% NCERT Biology Mastery', 'OMR Speed Strategy Sessions', 'Formula Drills & Doubt Vaults', 'Regular Parent Reviews']
  }
];

// ==========================================
// 2. MIDDLEWARES & SECURITY HEADERS
// ==========================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// In-Memory Rate Limiter (Cold-start safe)
const rateLimitMap = new Map();
function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const clientRecord = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > clientRecord.resetTime) {
      clientRecord.count = 1;
      clientRecord.resetTime = now + windowMs;
    } else {
      clientRecord.count += 1;
    }
    rateLimitMap.set(ip, clientRecord);

    if (clientRecord.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down and try again after a moment.'
      });
    }
    next();
  };
}

// Clean up stale rate limits every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
}, 60000);

// ==========================================
// 3. MONGODB ATLAS CONNECTION POOLING
// ==========================================
let cachedClient = null;
let cachedDb = null;
let isIndexesEnsured = false;

async function connectToDatabase() {
  if (!MONGODB_URI) {
    const error = new Error('MONGODB_URI environment variable is missing.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000
  });

  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  cachedClient = client;
  cachedDb = db;

  if (!isIndexesEnsured) {
    try {
      await db.collection('admissions').createIndex({ referenceNumber: 1 }, { unique: true });
      await db.collection('admissions').createIndex({ createdAt: -1 });
      await db.collection('admissions').createIndex({ status: 1 });
      await db.collection('contact_messages').createIndex({ createdAt: -1 });
      await db.collection('admin_users').createIndex({ email: 1 }, { unique: true });
      isIndexesEnsured = true;
    } catch (idxErr) {
      console.warn('Index initialization note:', idxErr.message);
    }
  }

  return { client, db };
}

// ==========================================
// 4. AUTHENTICATION MIDDLEWARE
// ==========================================
function authenticateAdmin(req, res, next) {
  const token = req.cookies.ecc_admin_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('ecc_admin_token');
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please sign in again.' });
  }
}

// ==========================================
// 5. PUBLIC API ENDPOINTS
// ==========================================

// Health Check
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  if (MONGODB_URI) {
    try {
      const { db } = await connectToDatabase();
      await db.command({ ping: 1 });
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'unreachable';
    }
  } else {
    dbStatus = 'missing_env';
  }

  res.json({
    status: 'healthy',
    institute: 'Excellence Coaching Classes, Galle Borgaon',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: '1.0.0'
  });
});

// Courses Catalog API
app.get('/api/courses', (req, res) => {
  res.json({ success: true, courses: COURSES });
});

// Online Admission Submission
app.post('/api/admissions', rateLimit(60000, 10), async (req, res) => {
  try {
    const {
      studentName,
      parentName,
      studentEmail,
      studentMobile,
      parentMobile,
      currentClass,
      desiredCourse,
      preferredBatch,
      academicYear,
      city,
      state,
      preferredContact,
      previousPercentage,
      message,
      consent
    } = req.body;

    if (!studentName || !parentName || !studentEmail || !studentMobile || !parentMobile || !desiredCourse || !consent) {
      return res.status(400).json({ success: false, error: 'Please complete all required fields and provide consent.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid student email address.' });
    }

    const phoneRegex = /^[0-9+\s-]{8,15}$/;
    if (!phoneRegex.test(studentMobile) || !phoneRegex.test(parentMobile)) {
      return res.status(400).json({ success: false, error: 'Please enter valid contact phone numbers.' });
    }

    const matchedCourse = COURSES.find(c => c.id === desiredCourse || c.title === desiredCourse);
    if (!matchedCourse) {
      return res.status(400).json({ success: false, error: 'Selected course is not available in our catalog.' });
    }

    const { db } = await connectToDatabase();

    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceNumber = `ECC-2026-${randomHex}`;

    const newApplication = {
      referenceNumber,
      studentName: String(studentName).trim().slice(0, 100),
      parentName: String(parentName).trim().slice(0, 100),
      studentEmail: String(studentEmail).trim().toLowerCase().slice(0, 120),
      studentMobile: String(studentMobile).trim().slice(0, 20),
      parentMobile: String(parentMobile).trim().slice(0, 20),
      currentClass: String(currentClass || 'Class 10 Passed').slice(0, 50),
      desiredCourseId: matchedCourse.id,
      desiredCourseName: matchedCourse.title,
      preferredBatch: String(preferredBatch || 'Morning Batch').slice(0, 50),
      academicYear: String(academicYear || '2026 - 2027').slice(0, 30),
      city: String(city || 'Galle Borgaon').trim().slice(0, 60),
      state: String(state || 'Maharashtra').trim().slice(0, 60),
      preferredContact: String(preferredContact || 'Phone Call').slice(0, 30),
      previousPercentage: previousPercentage ? Number(previousPercentage) || null : null,
      message: message ? String(message).trim().slice(0, 500) : '',
      status: 'Pending',
      internalNotes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('admissions').insertOne(newApplication);

    return res.status(201).json({
      success: true,
      message: 'Admission application submitted successfully.',
      referenceNumber,
      courseName: matchedCourse.title,
      status: 'Pending'
    });
  } catch (err) {
    if (err.code === 'CONFIG_MISSING' || err.name === 'MongoServerSelectionError') {
      return res.status(503).json({
        success: false,
        error: 'Database service is currently unreachable. Please verify MongoDB configuration.'
      });
    }
    console.error('Admission Error:', err);
    return res.status(500).json({ success: false, error: 'Internal system error occurred while submitting application.' });
  }
});

// Contact Inquiries
app.post('/api/contact', rateLimit(60000, 15), async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    const { db } = await connectToDatabase();
    const contactRecord = {
      name: String(name).trim().slice(0, 100),
      email: String(email).trim().toLowerCase().slice(0, 120),
      phone: String(phone || '').trim().slice(0, 20),
      subject: String(subject || 'General Inquiry').trim().slice(0, 150),
      message: String(message).trim().slice(0, 1000),
      status: 'Unread',
      createdAt: new Date()
    };

    await db.collection('contact_messages').insertOne(contactRecord);

    res.json({
      success: true,
      message: 'Thank you for contacting Excellence Coaching Classes. Our team will review your inquiry.'
    });
  } catch (err) {
    console.error('Contact Form Error:', err);
    res.status(500).json({ success: false, error: 'Failed to record message. Please try again later.' });
  }
});

// ==========================================
// 6. ADMIN AUTHENTICATION APIS
// ==========================================
app.post('/api/admin/login', rateLimit(60000, 8), async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return res.status(503).json({
      success: false,
      error: 'Admin authentication is not configured. Please set ADMIN_EMAIL and ADMIN_PASSWORD in environment variables.'
    });
  }

  if (cleanEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { email: cleanEmail, role: 'administrator' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('ecc_admin_token', token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Admin authentication successful.',
      user: { email: cleanEmail, role: 'administrator' }
    });
  }

  return res.status(401).json({ success: false, error: 'Invalid administrator email or password.' });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('ecc_admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  res.json({ success: true, user: req.admin });
});

// ==========================================
// 7. PROTECTED ADMIN DATA APIS
// ==========================================
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const { db } = await connectToDatabase();

    const [total, pending, underReview, contacted, approved, rejected, recentAdmissions, recentContacts] = await Promise.all([
      db.collection('admissions').countDocuments(),
      db.collection('admissions').countDocuments({ status: 'Pending' }),
      db.collection('admissions').countDocuments({ status: 'Under Review' }),
      db.collection('admissions').countDocuments({ status: 'Contacted' }),
      db.collection('admissions').countDocuments({ status: 'Approved' }),
      db.collection('admissions').countDocuments({ status: 'Rejected' }),
      db.collection('admissions').find().sort({ createdAt: -1 }).limit(8).toArray(),
      db.collection('contact_messages').find().sort({ createdAt: -1 }).limit(5).toArray()
    ]);

    res.json({
      success: true,
      stats: { total, pending, underReview, contacted, approved, rejected },
      recentAdmissions,
      recentContacts
    });
  } catch (err) {
    console.error('Admin Dashboard API Error:', err);
    res.status(500).json({ success: false, error: 'Unable to retrieve dashboard metrics.' });
  }
});

// Get Paginated Applications with Search & Filters
app.get('/api/admin/admissions', authenticateAdmin, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }
    if (req.query.course && req.query.course !== 'All') {
      query.desiredCourseId = req.query.course;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { referenceNumber: searchRegex },
        { studentName: searchRegex },
        { studentEmail: searchRegex },
        { studentMobile: searchRegex }
      ];
    }

    const [records, totalCount] = await Promise.all([
      db.collection('admissions').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('admissions').countDocuments(query)
    ]);

    res.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    });
  } catch (err) {
    console.error('Admin Admissions Fetch Error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve admission records.' });
  }
});

// Update Application Status & Notes
app.patch('/api/admin/admissions/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, internalNotes } = req.body;

    const validStatuses = ['Pending', 'Under Review', 'Contacted', 'Approved', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid admission status value.' });
    }

    const { db } = await connectToDatabase();
    const updateDoc = {
      $set: {
        status,
        updatedAt: new Date()
      }
    };

    if (typeof internalNotes === 'string') {
      updateDoc.$set.internalNotes = internalNotes.slice(0, 1000);
    }

    const result = await db.collection('admissions').updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: 'Application record not found.' });
    }

    res.json({ success: true, message: `Application status updated to ${status}.` });
  } catch (err) {
    console.error('Status Update Error:', err);
    res.status(500).json({ success: false, error: 'Failed to update application status.' });
  }
});

// CSV Export with Formula Injection Protection
app.get('/api/admin/export.csv', authenticateAdmin, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const admissions = await db.collection('admissions').find().sort({ createdAt: -1 }).toArray();

    function sanitizeForCsv(val) {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (['=', '+', '-', '@'].includes(str.charAt(0))) {
        str = "'" + str;
      }
      return `"${str}"`;
    }

    const headers = [
      'Reference Number',
      'Student Name',
      'Parent Name',
      'Student Email',
      'Student Mobile',
      'Parent Mobile',
      'Course',
      'Batch Preference',
      'Current Qualification',
      'City',
      'Status',
      'Submission Date',
      'Internal Notes'
    ];

    const rows = admissions.map(app => [
      sanitizeForCsv(app.referenceNumber),
      sanitizeForCsv(app.studentName),
      sanitizeForCsv(app.parentName),
      sanitizeForCsv(app.studentEmail),
      sanitizeForCsv(app.studentMobile),
      sanitizeForCsv(app.parentMobile),
      sanitizeForCsv(app.desiredCourseName),
      sanitizeForCsv(app.preferredBatch),
      sanitizeForCsv(app.currentClass),
      sanitizeForCsv(app.city),
      sanitizeForCsv(app.status),
      sanitizeForCsv(new Date(app.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      sanitizeForCsv(app.internalNotes || '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="excellence_admissions_' + Date.now() + '.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('CSV Export Error:', err);
    res.status(500).send('Failed to generate CSV export.');
  }
});

// ==========================================
// 8. MOUNT ADMIN PORTAL FROM admin.js
// ==========================================
app.use('/admin', adminModule);

// ==========================================
// 9. PUBLIC WEBSITE (CLAYMORPHISM SINGLE-PAGE)
// ==========================================
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found.' });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Excellence Coaching Classes | Galle Borgaon, Maharashtra</title>
  <meta name="description" content="Premier coaching institute for Class 11, 12 Science, MHT-CET, JEE & NEET in Galle Borgaon. Concept-based teaching and individual attention.">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
    :root {
      --bg-canvas: #EEF2F9;
      --bg-cream: #FFFDF9;
      --text-main: #1E293B;
      --text-muted: #64748B;
      --navy: #0F172A;
      
      --clay-purple: #9D77F6;
      --clay-purple-light: #F2EEFD;
      --clay-blue: #38BDF8;
      --clay-blue-light: #E0F2FE;
      --clay-coral: #F97316;
      --clay-coral-light: #FFEDD5;
      --clay-mint: #10B981;
      --clay-mint-light: #D1FAE5;
      --clay-yellow: #FBBF24;
      --clay-yellow-light: #FEF3C7;

      --clay-shadow-card: 14px 14px 28px rgba(186, 198, 222, 0.45), -12px -12px 24px #FFFFFF;
      --clay-shadow-button: 6px 6px 14px rgba(160, 175, 205, 0.5), -5px -5px 12px #FFFFFF;
      --clay-shadow-pressed: inset 4px 4px 8px rgba(160, 175, 205, 0.5), inset -4px -4px 8px #FFFFFF;
      --clay-shadow-input: inset 3px 3px 6px rgba(180, 195, 220, 0.4), inset -3px -3px 6px #FFFFFF;

      --radius-sm: 16px;
      --radius-md: 24px;
      --radius-lg: 32px;
      --radius-full: 9999px;

      --font-body: 'Plus Jakarta Sans', sans-serif;
      --font-display: 'Space Grotesk', sans-serif;
      --transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: var(--font-body); background-color: var(--bg-canvas); color: var(--text-main); line-height: 1.6; overflow-x: hidden; }

    @media (prefers-reduced-motion: reduce) {
      *, html { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }

    h1, h2, h3, h4 { font-family: var(--font-display); color: var(--navy); line-height: 1.25; }
    p { color: var(--text-muted); }
    a { text-decoration: none; color: inherit; }

    .container { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; }
    .section-padding { padding: 90px 0; }

    .badge-demo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--clay-yellow-light);
      color: #92400E;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 5px 14px;
      border-radius: var(--radius-full);
      box-shadow: 2px 2px 6px rgba(217, 119, 6, 0.15);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-pill {
      display: inline-block;
      padding: 6px 16px;
      border-radius: var(--radius-full);
      font-size: 0.85rem;
      font-weight: 700;
      background: var(--clay-purple-light);
      color: var(--clay-purple);
      margin-bottom: 12px;
    }

    .section-title-wrap { text-align: center; max-width: 720px; margin: 0 auto 56px; }
    .section-title-wrap h2 { font-size: 2.3rem; margin-top: 10px; }

    .clay-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 28px;
      border-radius: var(--radius-full);
      font-size: 0.98rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      outline: none;
      box-shadow: var(--clay-shadow-button);
      transition: var(--transition);
    }

    .clay-btn:hover { transform: translateY(-3px) scale(1.02); }
    .clay-btn:active { transform: translateY(1px) scale(0.98); box-shadow: var(--clay-shadow-pressed); }

    .clay-btn-primary { background: linear-gradient(135deg, #7C3AED, var(--clay-purple)); color: #FFFFFF; }
    .clay-btn-secondary { background: var(--bg-cream); color: var(--navy); }
    .clay-btn-coral { background: linear-gradient(135deg, #EA580C, var(--clay-coral)); color: #FFFFFF; }
    .clay-btn-mint { background: linear-gradient(135deg, #059669, var(--clay-mint)); color: #FFFFFF; }

    .clay-card {
      background: #FFFFFF;
      border-radius: var(--radius-lg);
      padding: 32px;
      box-shadow: var(--clay-shadow-card);
      border: 2px solid rgba(255, 255, 255, 0.7);
      position: relative;
      transition: var(--transition);
    }
    .clay-card:hover { transform: translateY(-4px); }

    .announcement-bar {
      background: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899);
      color: #FFFFFF;
      padding: 10px 16px;
      font-size: 0.88rem;
      text-align: center;
      position: relative;
      font-weight: 600;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      z-index: 101;
    }

    .announcement-bar .pulse-dot {
      width: 8px; height: 8px; background: #4ADE80; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #4ADE80;
    }

    .navbar {
      position: sticky; top: 0; z-index: 100; background: rgba(238, 242, 249, 0.88); backdrop-filter: blur(12px); padding: 16px 0; transition: var(--transition);
    }

    .nav-container { display: flex; align-items: center; justify-content: space-between; }
    .brand-logo { display: flex; align-items: center; gap: 12px; font-family: var(--font-display); font-size: 1.35rem; font-weight: 800; color: var(--navy); }

    .logo-clay-icon {
      width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, var(--clay-purple), #6366F1); display: flex; align-items: center; justify-content: center; color: #FFF; box-shadow: 4px 4px 10px rgba(124, 58, 237, 0.35); font-size: 1.2rem;
    }

    .brand-logo small { display: block; font-size: 0.72rem; font-weight: 600; color: var(--clay-purple); letter-spacing: 0.4px; }
    .nav-links { display: flex; align-items: center; gap: 28px; list-style: none; }
    .nav-link { font-weight: 600; color: var(--text-main); font-size: 0.94rem; transition: color 0.2s ease; position: relative; }
    .nav-link:hover { color: var(--clay-purple); }
    .nav-actions { display: flex; align-items: center; gap: 14px; }

    .btn-admin-link {
      font-size: 0.85rem; font-weight: 700; color: var(--text-muted); padding: 8px 16px; border-radius: var(--radius-full); background: rgba(255, 255, 255, 0.7); box-shadow: var(--clay-shadow-button); transition: var(--transition);
    }
    .btn-admin-link:hover { color: var(--clay-purple); transform: translateY(-2px); }

    .hamburger { display: none; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--navy); }

    .hero-section { padding: 70px 0 90px; position: relative; overflow: hidden; }
    .hero-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; align-items: center; gap: 48px; }
    .hero-content h1 { font-size: 3.3rem; font-weight: 800; letter-spacing: -1px; margin-bottom: 20px; color: var(--navy); }
    .hero-content h1 span.gradient-text { background: linear-gradient(135deg, var(--clay-purple), #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-description { font-size: 1.12rem; margin-bottom: 34px; line-height: 1.7; max-width: 580px; }
    .hero-buttons { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }

    .hero-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding-top: 20px; border-top: 2px dashed rgba(148, 163, 184, 0.35); }
    .metric-card { background: rgba(255, 255, 255, 0.65); padding: 16px; border-radius: var(--radius-sm); box-shadow: 4px 4px 10px rgba(186, 198, 222, 0.3); }
    .metric-card strong { display: block; font-size: 1.5rem; font-family: var(--font-display); color: var(--navy); }
    .metric-card span { font-size: 0.8rem; color: var(--text-muted); font-weight: 600; }

    .hero-visual { position: relative; display: flex; justify-content: center; align-items: center; }
    .clay-sphere {
      width: 380px; height: 380px; background: linear-gradient(135deg, #FDF4FF, #E0E7FF); border-radius: 40px; box-shadow: var(--clay-shadow-card); display: flex; align-items: center; justify-content: center; position: relative; border: 3px solid #FFF; transform: rotate(-3deg);
    }

    .floating-clay-item {
      position: absolute; background: #FFFFFF; padding: 14px 22px; border-radius: var(--radius-md); box-shadow: var(--clay-shadow-card); display: flex; align-items: center; gap: 12px; font-weight: 700; animation: floatMotion 4s ease-in-out infinite alternate;
    }
    .float-item-1 { top: -20px; left: -20px; border-left: 5px solid var(--clay-purple); }
    .float-item-2 { bottom: -15px; right: -10px; border-left: 5px solid var(--clay-mint); animation-delay: 1.5s; }
    .float-item-3 { top: 50%; right: -30px; border-left: 5px solid var(--clay-coral); animation-delay: 2.5s; }

    @keyframes floatMotion {
      0% { transform: translateY(0px) rotate(0deg); }
      100% { transform: translateY(-12px) rotate(2deg); }
    }

    .about-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 40px; }
    .about-pillar-card { text-align: center; padding: 32px 20px; }
    .about-icon {
      width: 70px; height: 70px; border-radius: 22px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; box-shadow: var(--clay-shadow-button);
    }

    .courses-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
    .course-card { display: flex; flex-direction: column; justify-content: space-between; height: 100%; }
    .course-top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .course-title { font-size: 1.38rem; margin-bottom: 12px; color: var(--navy); }
    .course-subjects { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .subject-pill { font-size: 0.78rem; font-weight: 600; background: var(--bg-canvas); padding: 4px 10px; border-radius: var(--radius-full); color: var(--text-main); }
    .course-features { list-style: none; margin: 16px 0 24px; }
    .course-features li { font-size: 0.88rem; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; color: var(--text-main); }
    .course-features li i { color: var(--clay-mint); }
    .course-footer { border-top: 1px dashed #CBD5E1; padding-top: 20px; margin-top: auto; display: flex; align-items: center; justify-content: space-between; }
    .course-price-wrap small { display: block; font-size: 0.72rem; color: var(--text-muted); }
    .course-price-wrap strong { font-size: 1.05rem; color: var(--navy); }

    .faculty-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    .faculty-card { text-align: center; padding: 30px 20px; }
    .faculty-avatar-box {
      width: 90px; height: 90px; margin: 0 auto 16px; border-radius: 50%; background: linear-gradient(135deg, #E0E7FF, #FDF4FF); display: flex; align-items: center; justify-content: center; font-size: 2.2rem; color: var(--clay-purple); box-shadow: var(--clay-shadow-card); border: 3px solid #FFF;
    }
    .faculty-name { font-size: 1.15rem; margin-bottom: 4px; }
    .faculty-subj { font-size: 0.84rem; font-weight: 700; color: var(--clay-purple); margin-bottom: 12px; display: block; }
    .faculty-bio { font-size: 0.83rem; line-height: 1.5; }

    .process-timeline { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; position: relative; margin-top: 40px; }
    .step-card { position: relative; padding: 26px 20px; }
    .step-number {
      width: 44px; height: 44px; border-radius: 14px; background: var(--clay-purple); color: #FFF; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; margin-bottom: 18px; box-shadow: 3px 3px 8px rgba(124, 58, 237, 0.4);
    }

    .testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
    .testimonial-card { font-style: normal; position: relative; }
    .quote-icon { font-size: 1.8rem; color: rgba(157, 119, 246, 0.3); margin-bottom: 12px; }
    .student-meta { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .student-icon-circle {
      width: 42px; height: 42px; border-radius: 50%; background: var(--clay-blue-light); display: flex; align-items: center; justify-content: center; color: #0284C7; font-weight: 700;
    }

    .admission-wrapper { max-width: 820px; margin: 0 auto; }
    .wizard-progress { display: flex; justify-content: space-between; margin-bottom: 36px; position: relative; }
    .wizard-progress::before { content: ''; position: absolute; top: 20px; left: 30px; right: 30px; height: 4px; background: #CBD5E1; z-index: 1; }
    .progress-step { position: relative; z-index: 2; text-align: center; cursor: default; }
    .step-circle {
      width: 42px; height: 42px; border-radius: 50%; background: #FFFFFF; box-shadow: var(--clay-shadow-button); display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; font-weight: 700; color: var(--text-muted); border: 3px solid transparent; transition: var(--transition);
    }
    .progress-step.active .step-circle { background: var(--clay-purple); color: #FFFFFF; border-color: #EDE9FE; }
    .progress-step.completed .step-circle { background: var(--clay-mint); color: #FFFFFF; }
    .step-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
    .progress-step.active .step-label { color: var(--navy); font-weight: 700; }

    .form-step-content { display: none; }
    .form-step-content.active { display: block; animation: fadeIn 0.3s ease; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .form-group { margin-bottom: 20px; }
    .form-group label { display: block; font-size: 0.88rem; font-weight: 700; margin-bottom: 8px; color: var(--navy); }

    .clay-input, .clay-select, .clay-textarea {
      width: 100%; padding: 13px 18px; border-radius: var(--radius-sm); border: 1.5px solid #E2E8F0; background: #F8FAFC; box-shadow: var(--clay-shadow-input); font-family: inherit; font-size: 0.94rem; color: var(--navy); outline: none; transition: border-color 0.2s ease;
    }
    .clay-input:focus, .clay-select:focus, .clay-textarea:focus { border-color: var(--clay-purple); background: #FFFFFF; }
    .consent-box { display: flex; gap: 12px; align-items: flex-start; margin: 20px 0; font-size: 0.84rem; }
    .wizard-nav-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; border-top: 1px dashed #CBD5E1; padding-top: 24px; }

    .review-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .review-table td { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; font-size: 0.9rem; }
    .review-table td:first-child { font-weight: 700; color: var(--text-muted); width: 40%; }

    .faq-container { max-width: 820px; margin: 0 auto; }
    .accordion-item {
      background: #FFFFFF; border-radius: var(--radius-md); box-shadow: var(--clay-shadow-button); margin-bottom: 16px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.8);
    }
    .accordion-header {
      width: 100%; padding: 20px 24px; text-align: left; background: none; border: none; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: var(--navy); cursor: pointer;
    }
    .accordion-body { padding: 0 24px 20px; color: var(--text-muted); font-size: 0.94rem; display: none; line-height: 1.6; }
    .accordion-item.open .accordion-body { display: block; }
    .accordion-item.open .accordion-header i { transform: rotate(180deg); }

    .contact-grid { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 36px; }
    .contact-detail-row { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    .contact-clay-icon {
      width: 48px; height: 48px; border-radius: 14px; background: var(--clay-purple-light); color: var(--clay-purple); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; box-shadow: var(--clay-shadow-button);
    }

    .modal-overlay {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(6px); z-index: 1000; justify-content: center; align-items: center; padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal-box { max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; }

    .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 2000; display: flex; flex-direction: column; gap: 12px; }
    .toast {
      padding: 14px 22px; border-radius: var(--radius-sm); color: #FFF; font-weight: 600; font-size: 0.9rem; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15); display: flex; align-items: center; gap: 12px; animation: slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .toast-success { background: #059669; }
    .toast-error { background: #DC2626; }
    .toast-info { background: #2563EB; }

    .site-footer { background: #0F172A; color: #94A3B8; padding: 70px 0 30px; margin-top: 60px; }
    .footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 48px; }
    .site-footer h4 { color: #FFFFFF; margin-bottom: 20px; font-size: 1.1rem; }
    .footer-links { list-style: none; }
    .footer-links li { margin-bottom: 10px; }
    .footer-links a:hover { color: #FFFFFF; }
    .footer-bottom { border-top: 1px solid #1E293B; padding-top: 24px; text-align: center; font-size: 0.85rem; }

    @media (max-width: 1024px) {
      .hero-grid { grid-template-columns: 1fr; text-align: center; }
      .hero-description { margin-left: auto; margin-right: auto; }
      .hero-buttons { justify-content: center; }
      .hero-visual { margin-top: 30px; }
      .about-grid { grid-template-columns: repeat(2, 1fr); }
      .courses-grid { grid-template-columns: repeat(2, 1fr); }
      .faculty-grid { grid-template-columns: repeat(2, 1fr); }
      .process-timeline { grid-template-columns: repeat(2, 1fr); }
      .testimonial-grid { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .navbar .nav-links {
        display: none; flex-direction: column; position: absolute; top: 100%; left: 0; width: 100%; background: #FFFFFF; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      }
      .navbar .nav-links.active { display: flex; }
      .hamburger { display: block; }
      .hero-content h1 { font-size: 2.4rem; }
      .courses-grid { grid-template-columns: 1fr; }
      .contact-grid { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
      .about-grid { grid-template-columns: 1fr; }
      .faculty-grid { grid-template-columns: 1fr; }
      .process-timeline { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <!-- Top Announcement Bar -->
  <aside class="announcement-bar" role="complementary" aria-label="Announcement">
    <span class="pulse-dot"></span>
    <span><strong>Admissions Open (2026–2027 Batches)</strong> — Start Your Concept Journey with Excellence!</span>
    <span class="badge-demo">Demo Mode</span>
  </aside>

  <!-- Sticky Navbar -->
  <header>
    <nav class="navbar" aria-label="Main Navigation">
      <div class="container nav-container">
        <a href="#hero" class="brand-logo" aria-label="Excellence Coaching Classes Home">
          <div class="logo-clay-icon">
            <i class="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            Excellence Coaching
            <small>Galle Borgaon, Maharashtra</small>
          </div>
        </a>

        <ul class="nav-links" id="navLinks">
          <li><a href="#about" class="nav-link">About</a></li>
          <li><a href="#courses" class="nav-link">Courses</a></li>
          <li><a href="#faculty" class="nav-link">Faculty</a></li>
          <li><a href="#process" class="nav-link">Process</a></li>
          <li><a href="#testimonials" class="nav-link">Testimonials</a></li>
          <li><a href="#faq" class="nav-link">FAQs</a></li>
          <li><a href="#contact" class="nav-link">Contact</a></li>
        </ul>

        <div class="nav-actions">
          <a href="#admission" class="clay-btn clay-btn-primary" style="padding: 10px 20px; font-size: 0.88rem;">
            <i class="fa-solid fa-file-signature"></i> Apply Now
          </a>
          <a href="/admin" class="btn-admin-link" title="Institute Administration Login">
            <i class="fa-solid fa-lock"></i> Admin
          </a>
          <button class="hamburger" id="hamburgerBtn" aria-label="Toggle navigation menu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>
    </nav>
  </header>

  <main>
    <!-- HERO SECTION -->
    <section id="hero" class="hero-section">
      <div class="container hero-grid">
        <div class="hero-content">
          <div class="badge-pill">
            <i class="fa-solid fa-award"></i> Premier Science & Competitive Coaching
          </div>
          <h1>Your Dreams Deserve <span class="gradient-text">Excellence.</span></h1>
          <p class="hero-description">
            Build strong concepts, boost your confidence, and prepare for your next academic milestone with structured learning, expert guidance, and regular practice in Galle Borgaon.
          </p>

          <div class="hero-buttons">
            <a href="#admission" class="clay-btn clay-btn-coral">
              <i class="fa-solid fa-paper-plane"></i> Apply for Admission
            </a>
            <a href="#courses" class="clay-btn clay-btn-secondary">
              <i class="fa-solid fa-book-open"></i> Explore Courses
            </a>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <strong>5 Core</strong>
              <span>Targeted Programs</span>
            </div>
            <div class="metric-card">
              <strong>1-on-1</strong>
              <span>Doubt Assistance</span>
            </div>
            <div class="metric-card">
              <strong>Weekly</strong>
              <span>Mock Assessments</span>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="clay-sphere">
            <div style="text-align: center; padding: 20px;">
              <i class="fa-solid fa-atom" style="font-size: 5rem; color: var(--clay-purple); margin-bottom: 14px;"></i>
              <h3 style="font-size: 1.3rem;">Learn Today.<br>Lead Tomorrow.</h3>
              <p style="font-size: 0.82rem; margin-top: 6px;">Excellence Academic Model</p>
            </div>
            <div class="floating-clay-item float-item-1">
              <i class="fa-solid fa-dna" style="color: var(--clay-purple);"></i>
              <div>NEET & JEE Prep</div>
            </div>
            <div class="floating-clay-item float-item-2">
              <i class="fa-solid fa-chart-line" style="color: var(--clay-mint);"></i>
              <div>MHT-CET Speed Mocks</div>
            </div>
            <div class="floating-clay-item float-item-3">
              <i class="fa-solid fa-flask" style="color: var(--clay-coral);"></i>
              <div>Class 11 & 12 Sci</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT SECTION -->
    <section id="about" class="section-padding" style="background: rgba(255, 255, 255, 0.5);">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Who We Are</span>
          <h2>Our Learning Philosophy</h2>
          <p>We believe academic success is the natural result of disciplined practice, crystalline concepts, and supportive mentors who believe in every student.</p>
        </div>

        <div class="about-grid">
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-purple-light); color: var(--clay-purple);">
              <i class="fa-solid fa-brain"></i>
            </div>
            <h3>1. Learn</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Deep conceptual clarity from fundamentals without superficial rote learning.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-blue-light); color: var(--clay-blue);">
              <i class="fa-solid fa-pen-ruler"></i>
            </div>
            <h3>2. Practice</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Daily problem worksheets calibrated from fundamental to challenging competitive tiers.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-coral-light); color: var(--clay-coral);">
              <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <h3>3. Improve</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Detailed error analysis sessions after each exam to eliminate recurrent missteps.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-mint-light); color: var(--clay-mint);">
              <i class="fa-solid fa-trophy"></i>
            </div>
            <h3>4. Achieve</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Build genuine examination confidence for Board, CET, JEE, and NEET milestones.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- COURSES SECTION -->
    <section id="courses" class="section-padding">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Academic Offerings</span>
          <h2>Structured Learning Programs</h2>
          <p>Tailored curriculum paths designed to prepare students for both Maharashtra State Board exams and national competitive entrance milestones.</p>
        </div>

        <div class="courses-grid" id="coursesList"></div>
      </div>
    </section>

    <!-- WHY CHOOSE US -->
    <section class="section-padding" style="background: var(--bg-cream);">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Excellence Edge</span>
          <h2>Why Students & Parents Trust Us</h2>
          <p>Every student receives personalized attention in an encouraging, focused, and distraction-free learning ecosystem.</p>
        </div>

        <div class="about-grid">
          <div class="clay-card" style="padding: 24px;">
            <i class="fa-solid fa-user-check" style="font-size: 1.8rem; color: var(--clay-purple); margin-bottom: 12px;"></i>
            <h4 style="margin-bottom: 6px;">Small Batch Sizes</h4>
            <p style="font-size: 0.85rem;">Optimal teacher-to-student ratio ensuring no child's question gets left unanswered.</p>
          </div>
          <div class="clay-card" style="padding: 24px;">
            <i class="fa-solid fa-clipboard-question" style="font-size: 1.8rem; color: var(--clay-blue); margin-bottom: 12px;"></i>
            <h4 style="margin-bottom: 6px;">Dedicated Doubt Vault</h4>
            <p style="font-size: 0.85rem;">Daily allocated doubt hours for 1-on-1 discussion on homework and test queries.</p>
          </div>
          <div class="clay-card" style="padding: 24px;">
            <i class="fa-solid fa-chart-pie" style="font-size: 1.8rem; color: var(--clay-coral); margin-bottom: 12px;"></i>
            <h4 style="margin-bottom: 6px;">Parent Progress Updates</h4>
            <p style="font-size: 0.85rem;">Monthly report cards and parent-teacher consultations to review growth trajectory.</p>
          </div>
          <div class="clay-card" style="padding: 24px;">
            <i class="fa-solid fa-book-bookmark" style="font-size: 1.8rem; color: var(--clay-mint); margin-bottom: 12px;"></i>
            <h4 style="margin-bottom: 6px;">Curated Study Notes</h4>
            <p style="font-size: 0.85rem;">Concise formula sheets, chapter revision summaries, and solved board question banks.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FACULTY SECTION -->
    <section id="faculty" class="section-padding">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Mentorship</span>
          <h2>Our Sample Faculty Profiles</h2>
          <p><span class="badge-demo">Demo Faculty Data</span> — Subject mentors dedicated to making complex concepts approachable and engaging.</p>
        </div>

        <div class="faculty-grid">
          <div class="clay-card faculty-card">
            <div class="faculty-avatar-box"><i class="fa-solid fa-user-tie"></i></div>
            <h4 class="faculty-name">Amit Sharma</h4>
            <span class="faculty-subj">Physics Mentor</span>
            <p class="faculty-bio">Specializes in visual mechanics and electrodynamics problem solving with intuitive real-world analogies.</p>
            <div style="margin-top: 12px;"><span class="badge-demo">8+ Yrs Exp (Sample)</span></div>
          </div>
          <div class="clay-card faculty-card">
            <div class="faculty-avatar-box"><i class="fa-solid fa-user-tie"></i></div>
            <h4 class="faculty-name">Priya Deshmukh</h4>
            <span class="faculty-subj">Chemistry Specialist</span>
            <p class="faculty-bio">Expert in Organic mechanisms, reaction flowcharts, and high-scoring Physical Chemistry formulas.</p>
            <div style="margin-top: 12px;"><span class="badge-demo">6+ Yrs Exp (Sample)</span></div>
          </div>
          <div class="clay-card faculty-card">
            <div class="faculty-avatar-box"><i class="fa-solid fa-user-tie"></i></div>
            <h4 class="faculty-name">Rahul Patil</h4>
            <span class="faculty-subj">Mathematics Faculty</span>
            <p class="faculty-bio">Focuses on speed tricks, calculus visualization, and step-by-step proofs for Board and MHT-CET success.</p>
            <div style="margin-top: 12px;"><span class="badge-demo">10+ Yrs Exp (Sample)</span></div>
          </div>
          <div class="clay-card faculty-card">
            <div class="faculty-avatar-box"><i class="fa-solid fa-user-tie"></i></div>
            <h4 class="faculty-name">Sneha Kulkarni</h4>
            <span class="faculty-subj">Biology Specialist</span>
            <p class="faculty-bio">Pioneer in NCERT line-by-line diagram drills and mnemonic systems for Botany and Human Physiology.</p>
            <div style="margin-top: 12px;"><span class="badge-demo">7+ Yrs Exp (Sample)</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- LEARNING PROCESS TIMELINE -->
    <section id="process" class="section-padding" style="background: rgba(255, 255, 255, 0.4);">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Step-by-Step</span>
          <h2>The 4-Step Academic Journey</h2>
          <p>A proven roadmap structured to take students from foundational concepts to examination excellence.</p>
        </div>

        <div class="process-timeline">
          <div class="clay-card step-card">
            <div class="step-number">1</div>
            <h4>Enroll & Assess</h4>
            <p style="font-size: 0.88rem; margin-top: 8px;">Select your academic target and undergo an initial diagnostic session to map your focus areas.</p>
          </div>
          <div class="clay-card step-card">
            <div class="step-number">2</div>
            <h4>Master Concepts</h4>
            <p style="font-size: 0.88rem; margin-top: 8px;">Attend interactive daily lectures focused on fundamentals, formulas, and derivations.</p>
          </div>
          <div class="clay-card step-card">
            <div class="step-number">3</div>
            <h4>Practice & Test</h4>
            <p style="font-size: 0.88rem; margin-top: 8px;">Solve daily problem sets and attend bi-weekly chapter assessments under simulated conditions.</p>
          </div>
          <div class="clay-card step-card">
            <div class="step-number">4</div>
            <h4>Refine & Excel</h4>
            <p style="font-size: 0.88rem; margin-top: 8px;">Participate in pre-board and entrance test series with personalized doubt analysis for peak performance.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- TESTIMONIALS (SAMPLE DEMO) -->
    <section id="testimonials" class="section-padding">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Student Voices</span>
          <h2>What Our Community Says</h2>
          <p><span class="badge-demo">Sample Demonstration Content</span> — Genuine student testimonials will be published upon batch verification.</p>
        </div>

        <div class="testimonial-grid">
          <div class="clay-card testimonial-card">
            <div class="quote-icon"><i class="fa-solid fa-quote-left"></i></div>
            <p style="font-size: 0.92rem; line-height: 1.6;">"The regular test series and continuous doubt-clearing sessions gave me the confidence I needed to score well in my Class 12 board examinations."</p>
            <div class="student-meta">
              <div class="student-icon-circle">AP</div>
              <div>
                <strong style="display: block; font-size: 0.92rem;">Aniket P. (Demo Student)</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted);">Class 12 Science Batch</span>
              </div>
            </div>
          </div>
          <div class="clay-card testimonial-card">
            <div class="quote-icon"><i class="fa-solid fa-quote-left"></i></div>
            <p style="font-size: 0.92rem; line-height: 1.6;">"Teachers in Galle Borgaon are very approachable. Breaking down complex physics concepts into simple daily examples made all the difference for CET."</p>
            <div class="student-meta">
              <div class="student-icon-circle">SK</div>
              <div>
                <strong style="display: block; font-size: 0.92rem;">Sakshi K. (Demo Student)</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted);">MHT-CET Aspirant</span>
              </div>
            </div>
          </div>
          <div class="clay-card testimonial-card">
            <div class="quote-icon"><i class="fa-solid fa-quote-left"></i></div>
            <p style="font-size: 0.92rem; line-height: 1.6;">"The structured study plan and disciplined environment helped me improve my score consistency across all mock tests throughout the academic year."</p>
            <div class="student-meta">
              <div class="student-icon-circle">RJ</div>
              <div>
                <strong style="display: block; font-size: 0.92rem;">Rohan J. (Demo Student)</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted);">Class 11 Science Batch</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ADMISSION WIZARD -->
    <section id="admission" class="section-padding" style="background: var(--bg-cream);">
      <div class="container admission-wrapper">
        <div class="section-title-wrap">
          <span class="badge-pill">Online Registration</span>
          <h2>Apply for Admission (2026–2027)</h2>
          <p>Fill in this 4-step form to register your interest. Applications are reviewed sequentially by our academic office.</p>
        </div>

        <div class="clay-card" style="padding: 40px 32px;">
          <div class="wizard-progress" role="progressbar" aria-label="Admission steps">
            <div class="progress-step active" id="stepIndicator1">
              <div class="step-circle">1</div>
              <span class="step-label">Student</span>
            </div>
            <div class="progress-step" id="stepIndicator2">
              <div class="step-circle">2</div>
              <span class="step-label">Academic</span>
            </div>
            <div class="progress-step" id="stepIndicator3">
              <div class="step-circle">3</div>
              <span class="step-label">Program</span>
            </div>
            <div class="progress-step" id="stepIndicator4">
              <div class="step-circle">4</div>
              <span class="step-label">Review</span>
            </div>
          </div>

          <form id="admissionForm" novalidate>
            <!-- STEP 1 -->
            <div class="form-step-content active" id="step1">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 1: Student & Guardian Details</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="studentName">Student Full Name *</label>
                  <input type="text" id="studentName" class="clay-input" placeholder="e.g. Aditya Rajesh Shinde" required>
                </div>
                <div class="form-group">
                  <label for="parentName">Parent / Guardian Name *</label>
                  <input type="text" id="parentName" class="clay-input" placeholder="e.g. Rajesh Shinde" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="studentEmail">Student Email Address *</label>
                  <input type="email" id="studentEmail" class="clay-input" placeholder="aditya@example.com" required>
                </div>
                <div class="form-group">
                  <label for="studentMobile">Student WhatsApp / Mobile *</label>
                  <input type="tel" id="studentMobile" class="clay-input" placeholder="98XXXXXXXX" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="parentMobile">Parent Contact Number *</label>
                  <input type="tel" id="parentMobile" class="clay-input" placeholder="98XXXXXXXX" required>
                </div>
                <div class="form-group">
                  <label for="preferredContact">Preferred Contact Method</label>
                  <select id="preferredContact" class="clay-select">
                    <option value="Phone Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
              </div>
              <div class="wizard-nav-actions" style="justify-content: flex-end;">
                <button type="button" class="clay-btn clay-btn-primary" onclick="wizardNext(1)">
                  Next: Academic Info <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- STEP 2 -->
            <div class="form-step-content" id="step2">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 2: Educational Background & Address</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="currentClass">Current Class / Qualification *</label>
                  <select id="currentClass" class="clay-select" required>
                    <option value="Class 10 Appearing / Passed">Class 10 Appearing / Passed</option>
                    <option value="Class 11 Science">Class 11 Science</option>
                    <option value="Class 12 Science">Class 12 Science</option>
                    <option value="Repeater / Drop Year">Repeater / Drop Year Aspirant</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="previousPercentage">Previous Exam Marks / Percentage (Optional)</label>
                  <input type="number" id="previousPercentage" class="clay-input" placeholder="e.g. 88.5" min="30" max="100" step="0.1">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="city">Town / City *</label>
                  <input type="text" id="city" class="clay-input" value="Galle Borgaon" required>
                </div>
                <div class="form-group">
                  <label for="state">State *</label>
                  <input type="text" id="state" class="clay-input" value="Maharashtra" required>
                </div>
              </div>
              <div class="wizard-nav-actions">
                <button type="button" class="clay-btn clay-btn-secondary" onclick="wizardBack(2)">
                  <i class="fa-solid fa-arrow-left"></i> Back
                </button>
                <button type="button" class="clay-btn clay-btn-primary" onclick="wizardNext(2)">
                  Next: Program Selection <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- STEP 3 -->
            <div class="form-step-content" id="step3">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 3: Program & Schedule Preference</h3>
              <div class="form-group">
                <label for="desiredCourse">Target Course / Program *</label>
                <select id="desiredCourse" class="clay-select" required>
                  <option value="">-- Please select a program --</option>
                  <option value="class-11-sci">Class 11 Science (PCMB Foundation)</option>
                  <option value="class-12-sci">Class 12 Science Board Booster</option>
                  <option value="mht-cet">MHT-CET Target Accelerator</option>
                  <option value="jee-prep">JEE Main & Advanced Foundation</option>
                  <option value="neet-prep">NEET-UG Medical Aspirant Program</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="preferredBatch">Preferred Batch Timing</label>
                  <select id="preferredBatch" class="clay-select">
                    <option value="Morning Batch (7:00 AM - 10:30 AM)">Morning Batch (7:00 AM - 10:30 AM)</option>
                    <option value="Evening Batch (4:00 PM - 7:30 PM)">Evening Batch (4:00 PM - 7:30 PM)</option>
                    <option value="Weekend Special (Sat & Sun)">Weekend Special (Sat & Sun)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="academicYear">Academic Year</label>
                  <input type="text" id="academicYear" class="clay-input" value="2026 - 2027" readonly>
                </div>
              </div>
              <div class="form-group">
                <label for="admissionMessage">Any Specific Questions or Notes for Mentors</label>
                <textarea id="admissionMessage" class="clay-textarea" rows="3" placeholder="Tell us about any specific subject you wish to strengthen..."></textarea>
              </div>
              <div class="wizard-nav-actions">
                <button type="button" class="clay-btn clay-btn-secondary" onclick="wizardBack(3)">
                  <i class="fa-solid fa-arrow-left"></i> Back
                </button>
                <button type="button" class="clay-btn clay-btn-primary" onclick="wizardNext(3)">
                  Next: Review & Confirm <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- STEP 4 -->
            <div class="form-step-content" id="step4">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 4: Verify Application Details</h3>
              <p style="font-size: 0.88rem; margin-bottom: 16px;">Please inspect your submission carefully. An official reference code will be generated upon confirmation.</p>

              <div class="clay-card" style="padding: 16px; background: #F8FAFC; margin-bottom: 20px;">
                <table class="review-table">
                  <tr><td>Student Name:</td><td id="revName">-</td></tr>
                  <tr><td>Parent Name:</td><td id="revParent">-</td></tr>
                  <tr><td>Contact Numbers:</td><td id="revPhones">-</td></tr>
                  <tr><td>Student Email:</td><td id="revEmail">-</td></tr>
                  <tr><td>Selected Program:</td><td id="revCourse" style="font-weight: 700; color: var(--clay-purple);">-</td></tr>
                  <tr><td>Batch & City:</td><td id="revBatch">-</td></tr>
                </table>
              </div>

              <div class="consent-box">
                <input type="checkbox" id="consentCheckbox" required style="margin-top: 4px; width: 18px; height: 18px; accent-color: var(--clay-purple);">
                <label for="consentCheckbox">
                  I hereby certify that all information supplied is accurate. I understand that submitting this admission form indicates registration of interest and does not guarantee admission until fee verification and class seat confirmation by Excellence Coaching Classes.
                </label>
              </div>

              <div class="wizard-nav-actions">
                <button type="button" class="clay-btn clay-btn-secondary" onclick="wizardBack(4)">
                  <i class="fa-solid fa-arrow-left"></i> Edit Details
                </button>
                <button type="submit" class="clay-btn clay-btn-coral" id="submitAdmissionBtn">
                  <i class="fa-solid fa-check"></i> Complete & Submit Application
                </button>
              </div>
            </div>
          </form>

          <!-- Success Screen -->
          <div id="admissionSuccessBox" style="display: none; text-align: center; padding: 40px 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--clay-mint-light); color: var(--clay-mint); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 24px;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <h3 style="font-size: 1.8rem; margin-bottom: 10px;">Application Successfully Received!</h3>
            <p style="max-width: 540px; margin: 0 auto 24px;">Thank you for registering with Excellence Coaching Classes. Your unique application reference number has been created in our database:</p>
            
            <div style="display: inline-block; background: #FFFFFF; border: 2px dashed var(--clay-purple); border-radius: var(--radius-md); padding: 16px 36px; margin-bottom: 24px;">
              <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">Application Reference Number</span>
              <div id="issuedRefNumber" style="font-size: 1.8rem; font-family: var(--font-display); font-weight: 800; color: var(--navy); margin-top: 4px;">ECC-2026-XXXXX</div>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 24px;">
              Please save this reference code. Our administrative desk in Galle Borgaon will contact you through your preferred channel for syllabus counseling and enrollment completion.
            </p>

            <button type="button" class="clay-btn clay-btn-primary" onclick="resetAdmissionWizard()">
              <i class="fa-solid fa-rotate-right"></i> Submit Another Registration
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ SECTION -->
    <section id="faq" class="section-padding">
      <div class="container faq-container">
        <div class="section-title-wrap">
          <span class="badge-pill">Queries Answered</span>
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about our teaching batches, admission policies, and student support.</p>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            Which courses are currently offered at Excellence Coaching Classes?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            We specialize in Class 11 Science (State Board & NCERT), Class 12 Science Board preparation, MHT-CET targeted crash and comprehensive series, as well as JEE Main and NEET-UG foundational programs.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            What happens after I submit the online admission form?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Once submitted, your application is saved in our system with a unique reference number. Our admission coordinator verifies course prerequisites and reaches out to schedule a diagnostic session and batch counseling.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            Are trial or demo lectures available before final fee payment?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Yes, students may attend up to two demo concept lectures upon registration to experience our classroom methodology, note-taking approach, and mentor interactions firsthand.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            How are course fees finalized and paid?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            All fees indicated on our website are sample indicative ranges. Official fee schedules, installment alternatives, and potential merit-based concessions are finalized in person at our Galle Borgaon coaching center.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            Can students enroll for both Board and Entrance exams simultaneously?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Yes, our integrated curriculum is specifically designed so that Board concept mastery directly supports competitive exam practice for MHT-CET, JEE, or NEET without schedule clash.
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT SECTION -->
    <section id="contact" class="section-padding" style="background: rgba(255, 255, 255, 0.5);">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Reach Us</span>
          <h2>Connect with Our Office</h2>
          <p>Have questions about batch timings or syllabus planning? Visit our Galle Borgaon center or send us a message.</p>
        </div>

        <div class="contact-grid">
          <div class="clay-card">
            <h3 style="margin-bottom: 24px;">Institute Information</h3>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-location-dot"></i></div>
              <div>
                <strong>Location</strong>
                <p style="font-size: 0.9rem;">Galle Borgaon, Maharashtra, India<br><span class="badge-demo">Representative Location</span></p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-phone"></i></div>
              <div>
                <strong>Phone Contact</strong>
                <p style="font-size: 0.9rem;">+91 90000 12345<br><span class="badge-demo">Demo Helpline</span></p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-envelope"></i></div>
              <div>
                <strong>Official Email</strong>
                <p style="font-size: 0.9rem;">hello@excellence-demo.example<br><span class="badge-demo">Configurable Demonstration Address</span></p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-clock"></i></div>
              <div>
                <strong>Counseling Hours</strong>
                <p style="font-size: 0.9rem;">Monday to Saturday: 8:00 AM – 7:30 PM<br>Sunday: 9:00 AM – 1:00 PM (Doubt Sessions)</p>
              </div>
            </div>

            <div style="margin-top: 28px;">
              <a href="https://wa.me/919000012345?text=Hello%20Excellence%20Coaching%20Classes%20I%20would%20like%20to%20inquire%20about%20admissions" target="_blank" rel="noopener noreferrer" class="clay-btn clay-btn-mint" style="width: 100%;">
                <i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp (Demo)
              </a>
            </div>
          </div>

          <div class="clay-card">
            <h3 style="margin-bottom: 20px;">Send a Direct Message</h3>
            <form id="contactForm" novalidate>
              <div class="form-group">
                <label for="contactName">Your Name *</label>
                <input type="text" id="contactName" class="clay-input" placeholder="e.g. Mahesh Jadhav" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="contactEmail">Email Address *</label>
                  <input type="email" id="contactEmail" class="clay-input" placeholder="mahesh@example.com" required>
                </div>
                <div class="form-group">
                  <label for="contactPhone">Phone Number</label>
                  <input type="tel" id="contactPhone" class="clay-input" placeholder="+91 98XXXXXXXX">
                </div>
              </div>
              <div class="form-group">
                <label for="contactSubject">Subject</label>
                <input type="text" id="contactSubject" class="clay-input" placeholder="Inquiry about MHT-CET Morning Batch">
              </div>
              <div class="form-group">
                <label for="contactMessage">Your Message *</label>
                <textarea id="contactMessage" class="clay-textarea" rows="4" placeholder="How can our academic counselors assist you?" required></textarea>
              </div>
              <button type="submit" class="clay-btn clay-btn-primary" id="contactSubmitBtn">
                <i class="fa-solid fa-paper-plane"></i> Send Inquiry
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- COURSE MODAL -->
  <div class="modal-overlay" id="courseModal" role="dialog" aria-modal="true" aria-labelledby="modalCourseTitle">
    <div class="clay-card modal-box">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          <span class="badge-pill" id="modalCourseLevel">Course Level</span>
          <h3 id="modalCourseTitle" style="font-size: 1.5rem; margin-top: 6px;">Course Details</h3>
        </div>
        <button onclick="closeCourseModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
      </div>
      <p id="modalCourseDesc" style="margin-bottom: 20px; line-height: 1.7;"></p>
      
      <div style="margin-bottom: 20px;">
        <h4 style="margin-bottom: 10px; font-size: 1rem;">Core Syllabus Subjects:</h4>
        <div id="modalCourseSubjects" class="course-subjects"></div>
      </div>

      <div style="margin-bottom: 24px;">
        <h4 style="margin-bottom: 10px; font-size: 1rem;">Pedagogical Highlights:</h4>
        <ul id="modalCourseFeatures" class="course-features"></ul>
      </div>

      <div style="background: #F1F5F9; padding: 14px; border-radius: var(--radius-sm); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem; font-weight: 600;">Sample Indicative Fee:</span>
          <strong id="modalCourseFee" style="color: var(--navy);">Fee information</strong>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 14px;">
        <button class="clay-btn clay-btn-secondary" onclick="closeCourseModal()">Close</button>
        <button class="clay-btn clay-btn-coral" id="modalApplyBtn">Apply for this Program</button>
      </div>
    </div>
  </div>

  <!-- TOAST NOTIFICATION CONTAINER -->
  <div class="toast-container" id="toastBox"></div>

  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="brand-logo" style="color: #FFF; margin-bottom: 16px;">
            <div class="logo-clay-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <div>Excellence Coaching<small style="color: #A5B4FC;">Galle Borgaon, MH</small></div>
          </div>
          <p style="font-size: 0.88rem; color: #94A3B8; margin-bottom: 18px;">
            "Learn Today. Lead Tomorrow." Empowering students with top-tier science education and entrance training.
          </p>
          <div style="display: flex; gap: 12px;">
            <a href="#hero" class="btn-admin-link" style="background: #1E293B; color: #E2E8F0;"><i class="fa-brands fa-facebook-f"></i></a>
            <a href="#hero" class="btn-admin-link" style="background: #1E293B; color: #E2E8F0;"><i class="fa-brands fa-instagram"></i></a>
            <a href="#hero" class="btn-admin-link" style="background: #1E293B; color: #E2E8F0;"><i class="fa-brands fa-youtube"></i></a>
          </div>
        </div>

        <div>
          <h4>Curriculum</h4>
          <ul class="footer-links">
            <li><a href="#courses">Class 11 Science</a></li>
            <li><a href="#courses">Class 12 Science</a></li>
            <li><a href="#courses">MHT-CET Program</a></li>
            <li><a href="#courses">JEE Foundation</a></li>
            <li><a href="#courses">NEET Medical Prep</a></li>
          </ul>
        </div>

        <div>
          <h4>Institute</h4>
          <ul class="footer-links">
            <li><a href="#about">Learning Method</a></li>
            <li><a href="#faculty">Faculty Team</a></li>
            <li><a href="#process">Admission Steps</a></li>
            <li><a href="#testimonials">Student Feedback</a></li>
            <li><a href="/admin">Staff Administration</a></li>
          </ul>
        </div>

        <div>
          <h4>Center Office</h4>
          <p style="font-size: 0.88rem; margin-bottom: 8px;">Galle Borgaon, Maharashtra, India</p>
          <p style="font-size: 0.88rem; margin-bottom: 8px;">Phone: +91 90000 12345 (Demo)</p>
          <p style="font-size: 0.88rem; margin-bottom: 14px;">Email: hello@excellence-demo.example</p>
          <span class="badge-demo">Demo Platform</span>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; <span id="currentYear"></span> Excellence Coaching Classes. All rights reserved.</p>
        <p style="font-size: 0.78rem; margin-top: 6px; color: #64748B;">
          Notice: Contact numbers, fees, faculty profiles, and student testimonials represent sample demonstrator content for preview purposes.
        </p>
      </div>
    </div>
  </footer>

  <script>
    let coursesData = [];
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navLinks = document.getElementById('navLinks');
    hamburgerBtn.addEventListener('click', () => navLinks.classList.toggle('active'));

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });

    function showToast(message, type = 'info') {
      const box = document.getElementById('toastBox');
      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML = (type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : (type === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-info"></i>')) + ' <span>' + message + '</span>';
      box.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s ease';
        setTimeout(() => toast.remove(), 400);
      }, 4000);
    }

    async function fetchCourses() {
      try {
        const res = await fetch('/api/courses');
        const json = await res.json();
        if (json.success && json.courses) {
          coursesData = json.courses;
          renderCoursesGrid(json.courses);
        }
      } catch (e) {
        console.error('Failed to load courses catalog:', e);
      }
    }

    function renderCoursesGrid(courses) {
      const container = document.getElementById('coursesList');
      container.innerHTML = courses.map(c => {
        const subjectsHtml = c.subjects.map(s => '<span class="subject-pill">' + s + '</span>').join('');
        const featuresHtml = c.features.map(f => '<li><i class="fa-solid fa-circle-check"></i> ' + f + '</li>').join('');
        return \`
          <div class="clay-card course-card">
            <div>
              <div class="course-top-bar">
                <span class="badge-pill" style="margin-bottom: 0;">\${c.level}</span>
                <span class="badge-demo">Indicative Fee</span>
              </div>
              <h3 class="course-title">\${c.title}</h3>
              <p style="font-size: 0.88rem; line-height: 1.5;">\${c.description}</p>
              <div class="course-subjects">\${subjectsHtml}</div>
              <ul class="course-features">\${featuresHtml}</ul>
            </div>

            <div class="course-footer">
              <div class="course-price-wrap">
                <small>Duration: \${c.duration}</small>
                <strong>\${c.indicativeFee}</strong>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="clay-btn clay-btn-secondary" style="padding: 8px 14px; font-size: 0.84rem;" onclick="openCourseModal('\${c.id}')">Details</button>
                <button class="clay-btn clay-btn-coral" style="padding: 8px 14px; font-size: 0.84rem;" onclick="selectCourseAndEnroll('\${c.id}')">Apply Now</button>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function openCourseModal(courseId) {
      const course = coursesData.find(c => c.id === courseId);
      if (!course) return;

      document.getElementById('modalCourseLevel').textContent = course.level;
      document.getElementById('modalCourseTitle').textContent = course.title;
      document.getElementById('modalCourseDesc').textContent = course.description;
      document.getElementById('modalCourseFee').textContent = course.indicativeFee + ' (' + course.duration + ')';
      
      document.getElementById('modalCourseSubjects').innerHTML = course.subjects.map(s => '<span class="subject-pill">' + s + '</span>').join('');
      document.getElementById('modalCourseFeatures').innerHTML = course.features.map(f => '<li><i class="fa-solid fa-circle-check"></i> ' + f + '</li>').join('');

      document.getElementById('modalApplyBtn').onclick = () => {
        closeCourseModal();
        selectCourseAndEnroll(course.id);
      };

      document.getElementById('courseModal').classList.add('open');
    }

    function closeCourseModal() {
      document.getElementById('courseModal').classList.remove('open');
    }

    function selectCourseAndEnroll(courseId) {
      const selectBox = document.getElementById('desiredCourse');
      selectBox.value = courseId;
      document.getElementById('admission').scrollIntoView({ behavior: 'smooth' });
    }

    let currentStep = 1;

    function wizardNext(fromStep) {
      if (fromStep === 1) {
        const name = document.getElementById('studentName').value.trim();
        const parent = document.getElementById('parentName').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const phone = document.getElementById('studentMobile').value.trim();
        const parentPhone = document.getElementById('parentMobile').value.trim();

        if (!name || !parent || !email || !phone || !parentPhone) {
          showToast('Please fill out all mandatory contact fields.', 'error');
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showToast('Please enter a valid student email address.', 'error');
          return;
        }
      }

      if (fromStep === 2) {
        const city = document.getElementById('city').value.trim();
        const state = document.getElementById('state').value.trim();
        if (!city || !state) {
          showToast('Please enter city and state location.', 'error');
          return;
        }
      }

      if (fromStep === 3) {
        const course = document.getElementById('desiredCourse').value;
        if (!course) {
          showToast('Please select your target coaching program.', 'error');
          return;
        }
        populateReviewTable();
      }

      setWizardStep(fromStep + 1);
    }

    function wizardBack(fromStep) {
      setWizardStep(fromStep - 1);
    }

    function setWizardStep(targetStep) {
      document.querySelectorAll('.form-step-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.progress-step').forEach((el, index) => {
        el.classList.remove('active');
        if (index + 1 < targetStep) el.classList.add('completed');
        else el.classList.remove('completed');
        if (index + 1 === targetStep) el.classList.add('active');
      });

      document.getElementById('step' + targetStep).classList.add('active');
      currentStep = targetStep;
    }

    function populateReviewTable() {
      document.getElementById('revName').textContent = document.getElementById('studentName').value;
      document.getElementById('revParent').textContent = document.getElementById('parentName').value;
      document.getElementById('revPhones').textContent = document.getElementById('studentMobile').value + ' (Student) / ' + document.getElementById('parentMobile').value + ' (Parent)';
      document.getElementById('revEmail').textContent = document.getElementById('studentEmail').value;
      
      const selCourse = document.getElementById('desiredCourse');
      document.getElementById('revCourse').textContent = selCourse.options[selCourse.selectedIndex].text;
      document.getElementById('revBatch').textContent = document.getElementById('preferredBatch').value + ' - ' + document.getElementById('city').value;
    }

    document.getElementById('admissionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const consent = document.getElementById('consentCheckbox').checked;
      if (!consent) {
        showToast('Please confirm the accuracy declaration before submitting.', 'error');
        return;
      }

      const submitBtn = document.getElementById('submitAdmissionBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Application...';

      const payload = {
        studentName: document.getElementById('studentName').value,
        parentName: document.getElementById('parentName').value,
        studentEmail: document.getElementById('studentEmail').value,
        studentMobile: document.getElementById('studentMobile').value,
        parentMobile: document.getElementById('parentMobile').value,
        preferredContact: document.getElementById('preferredContact').value,
        currentClass: document.getElementById('currentClass').value,
        previousPercentage: document.getElementById('previousPercentage').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        desiredCourse: document.getElementById('desiredCourse').value,
        preferredBatch: document.getElementById('preferredBatch').value,
        academicYear: document.getElementById('academicYear').value,
        message: document.getElementById('admissionMessage').value,
        consent: true
      };

      try {
        const response = await fetch('/api/admissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok && data.success) {
          document.getElementById('admissionForm').style.display = 'none';
          document.querySelector('.wizard-progress').style.display = 'none';
          document.getElementById('issuedRefNumber').textContent = data.referenceNumber;
          document.getElementById('admissionSuccessBox').style.display = 'block';
          showToast('Application registered successfully!', 'success');
        } else {
          showToast(data.error || 'Submission failed. Please check entries.', 'error');
        }
      } catch (err) {
        showToast('Could not reach admission server. Verify connection.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Complete & Submit Application';
      }
    });

    function resetAdmissionWizard() {
      document.getElementById('admissionForm').reset();
      document.getElementById('admissionForm').style.display = 'block';
      document.querySelector('.wizard-progress').style.display = 'flex';
      document.getElementById('admissionSuccessBox').style.display = 'none';
      setWizardStep(1);
    }

    document.getElementById('contactForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('contactSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

      const payload = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        subject: document.getElementById('contactSubject').value,
        message: document.getElementById('contactMessage').value
      };

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message, 'success');
          document.getElementById('contactForm').reset();
        } else {
          showToast(data.error || 'Failed to send message.', 'error');
        }
      } catch (err) {
        showToast('Message server unreachable.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Inquiry';
      }
    });

    function toggleFaq(btn) {
      const item = btn.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    }

    fetchCourses();
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Centralized Error Handling
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, error: 'Internal application server error.' });
  }
  res.status(500).send('An unexpected server error occurred. Please refresh the page.');
});

// Conditional local listener (ignored when invoked in Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Excellence Coaching Classes Server Active`);
    console.log(`  Local URL:   http://localhost:${PORT}`);
    console.log(`  Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
