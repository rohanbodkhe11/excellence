/**
 * EXCELLENCE COACHING CLASSES (ECC) — Core Application Server
 * Location: Galle Borgaon, Maharashtra, India
 * Founder & Owner: Prof. Anil Karangle
 * Official Email: excellencecoachingclasses@gmail.com
 * Tagline: Learn Today. Lead Tomorrow.
 * 
 * Production Node.js & Express server with MongoDB Atlas integration.
 * Claymorphism UI, Admissions API, Course Catalog & Admin Router.
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');

// Safe module loading for serverless deployment environments
let adminModule = null;
try {
  adminModule = require('./admin');
} catch (loadErr) {
  console.warn('[ECC Server] Admin submodule note:', loadErr.message);
}

const app = express();

// ==========================================
// 1. CONFIGURATION & SOURCE OF TRUTH (ECC)
// ==========================================
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'ecc_database';
const JWT_SECRET = process.env.JWT_SECRET || 'ecc-production-secure-token-secret-gal-borgaon';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const IS_PROD = process.env.NODE_ENV === 'production';

// Verified Institute Metadata
const INSTITUTE_INFO = {
  name: 'Excellence Coaching Classes',
  shortName: 'ECC',
  tagline: 'Learn Today. Lead Tomorrow.',
  owner: 'Prof. Anil Karangle',
  location: 'Galle Borgaon, Maharashtra, India',
  email: 'excellencecoachingclasses@gmail.com',
  feeRangeText: '₹20,000 – ₹25,000',
  feePolicyNote: 'Indicative fee range. Final fees are finalized after an in-person meeting with Prof. Anil Karangle.'
};

// Verified Course Offerings (5 Confirmed Categories)
const COURSES = [
  {
    id: 'course-11th-standard',
    title: '11th Standard',
    category: 'Higher Secondary Foundation',
    targetAudience: 'Students entering or studying in 11th Standard',
    indicativeFee: INSTITUTE_INFO.feeRangeText,
    feeNote: INSTITUTE_INFO.feePolicyNote,
    description: 'Comprehensive academic instruction covering core foundational science principles to prepare students thoroughly for senior secondary curricula and examinations.'
  },
  {
    id: 'course-12th-standard',
    title: '12th Standard',
    category: 'Senior Secondary Board Preparation',
    targetAudience: 'Students preparing for 12th Standard board assessments',
    indicativeFee: INSTITUTE_INFO.feeRangeText,
    feeNote: INSTITUTE_INFO.feePolicyNote,
    description: 'In-depth syllabus coverage, structured conceptual review, and analytical practice tailored specifically to excel in 12th Standard examinations.'
  },
  {
    id: 'course-mht-cet',
    title: 'MHT-CET',
    category: 'State Engineering & Pharmacy Entrance',
    targetAudience: 'Maharashtra CET Aspirants (11th & 12th Standard)',
    indicativeFee: INSTITUTE_INFO.feeRangeText,
    feeNote: INSTITUTE_INFO.feePolicyNote,
    description: 'Targeted preparation adhering to the Maharashtra State Board curriculum, emphasizing high-speed problem-solving, formula retention, and accuracy.'
  },
  {
    id: 'course-jee',
    title: 'JEE',
    category: 'National Engineering Entrance',
    targetAudience: 'Engineering Aspirants Targeting JEE Main & Advanced',
    indicativeFee: INSTITUTE_INFO.feeRangeText,
    feeNote: INSTITUTE_INFO.feePolicyNote,
    description: 'Structured conceptual mastery and multi-concept problem solving designed to build rigorous analytical skills required for engineering entrance examinations.'
  },
  {
    id: 'course-neet',
    title: 'NEET',
    category: 'National Medical Entrance',
    targetAudience: 'Medical Aspirants Targeting NEET-UG',
    indicativeFee: INSTITUTE_INFO.feeRangeText,
    feeNote: INSTITUTE_INFO.feePolicyNote,
    description: 'Rigorous conceptual training emphasizing fundamental clarity, numerical speed, and thorough textbook-aligned mastery required for competitive medical admissions.'
  }
];

// ==========================================
// 2. MIDDLEWARES & SECURITY HEADERS
// ==========================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Standard security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// In-Memory Rate Limiter (Serverless & Cold-Start Safe)
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
        error: 'Too many requests. Please wait a moment and try again.'
      });
    }
    next();
  };
}

// Clean up stale rate limits without blocking Vercel serverless shutdown
const rateCleaner = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
}, 60000);
if (rateCleaner && typeof rateCleaner.unref === 'function') {
  rateCleaner.unref();
}

// ==========================================
// 3. MONGODB ATLAS POOLED CONNECTION
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
      console.warn('[ECC DB] Index setup:', idxErr.message);
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

// Institute Info API
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: INSTITUTE_INFO
  });
});

// Health & Readiness
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
    status: 'operational',
    institute: INSTITUTE_INFO.name,
    owner: INSTITUTE_INFO.owner,
    location: INSTITUTE_INFO.location,
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Courses Catalog API
app.get('/api/courses', (req, res) => {
  res.json({
    success: true,
    courses: COURSES,
    feePolicyNote: INSTITUTE_INFO.feePolicyNote
  });
});

// Online Admission Registration
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
      city,
      state,
      preferredContact,
      previousPercentage,
      message,
      consent
    } = req.body;

    if (!studentName || !parentName || !studentEmail || !studentMobile || !parentMobile || !desiredCourse || !consent) {
      return res.status(400).json({ success: false, error: 'Please fill out all required fields and confirm the declaration.' });
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
      return res.status(400).json({ success: false, error: 'Selected course is not recognized in our confirmed offerings.' });
    }

    const { db } = await connectToDatabase();

    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referenceNumber = `ECC-${randomHex}`;

    const newApplication = {
      referenceNumber,
      studentName: String(studentName).trim().slice(0, 100),
      parentName: String(parentName).trim().slice(0, 100),
      studentEmail: String(studentEmail).trim().toLowerCase().slice(0, 120),
      studentMobile: String(studentMobile).trim().slice(0, 20),
      parentMobile: String(parentMobile).trim().slice(0, 20),
      currentClass: String(currentClass || 'Standard').slice(0, 50),
      desiredCourseId: matchedCourse.id,
      desiredCourseName: matchedCourse.title,
      city: String(city || 'Galle Borgaon').trim().slice(0, 60),
      state: String(state || 'Maharashtra').trim().slice(0, 60),
      preferredContact: String(preferredContact || 'Email').slice(0, 30),
      previousPercentage: previousPercentage ? Number(previousPercentage) || null : null,
      message: message ? String(message).trim().slice(0, 500) : '',
      indicativeFeeRange: INSTITUTE_INFO.feeRangeText,
      feeNote: INSTITUTE_INFO.feePolicyNote,
      status: 'Pending Review',
      internalNotes: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('admissions').insertOne(newApplication);

    return res.status(201).json({
      success: true,
      message: 'Admission enquiry submitted successfully.',
      referenceNumber,
      courseName: matchedCourse.title,
      status: 'Pending Review'
    });
  } catch (err) {
    if (err.code === 'CONFIG_MISSING' || err.name === 'MongoServerSelectionError') {
      return res.status(503).json({
        success: false,
        error: 'Database connection is temporarily unavailable. Please verify server environment variables.'
      });
    }
    console.error('[ECC Admission Error]:', err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred while processing the admission enquiry.' });
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
      subject: String(subject || 'General Enquiry').trim().slice(0, 150),
      message: String(message).trim().slice(0, 1000),
      status: 'Unread',
      createdAt: new Date()
    };

    await db.collection('contact_messages').insertOne(contactRecord);

    res.json({
      success: true,
      message: 'Thank you for reaching out to Excellence Coaching Classes. Your enquiry has been received.'
    });
  } catch (err) {
    console.error('[ECC Contact Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to record your message. Please write directly to ' + INSTITUTE_INFO.email });
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
      error: 'Administrator credentials are not configured. Please define ADMIN_EMAIL and ADMIN_PASSWORD in environment variables.'
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
// 7. PROTECTED ADMIN DATA APIS (GENUINE DATA ONLY)
// ==========================================
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const { db } = await connectToDatabase();

    const [total, pending, underReview, contacted, approved, rejected, recentAdmissions, recentContacts] = await Promise.all([
      db.collection('admissions').countDocuments(),
      db.collection('admissions').countDocuments({ status: 'Pending Review' }),
      db.collection('admissions').countDocuments({ status: 'Under Review' }),
      db.collection('admissions').countDocuments({ status: 'Contacted' }),
      db.collection('admissions').countDocuments({ status: 'Approved' }),
      db.collection('admissions').countDocuments({ status: 'Rejected' }),
      db.collection('admissions').find().sort({ createdAt: -1 }).limit(10).toArray(),
      db.collection('contact_messages').find().sort({ createdAt: -1 }).limit(10).toArray()
    ]);

    res.json({
      success: true,
      stats: { total, pending, underReview, contacted, approved, rejected },
      recentAdmissions,
      recentContacts
    });
  } catch (err) {
    console.error('[ECC Admin Dashboard Error]:', err);
    res.status(500).json({ success: false, error: 'Unable to retrieve genuine dashboard metrics.' });
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
    console.error('[ECC Admin Admissions Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve admission records.' });
  }
});

// Update Application Status & Notes
app.patch('/api/admin/admissions/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, internalNotes } = req.body;

    const validStatuses = ['Pending Review', 'Under Review', 'Contacted', 'Approved', 'Rejected'];
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
    console.error('[ECC Status Update Error]:', err);
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
      sanitizeForCsv(app.currentClass),
      sanitizeForCsv(app.city),
      sanitizeForCsv(app.status),
      sanitizeForCsv(new Date(app.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
      sanitizeForCsv(app.internalNotes || '')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ecc_admissions_' + Date.now() + '.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('[ECC CSV Export Error]:', err);
    res.status(500).send('Failed to generate CSV export.');
  }
});

// ==========================================
// 8. MOUNT ADMIN PORTAL IF AVAILABLE
// ==========================================
if (adminModule) {
  app.use('/admin', adminModule);
} else {
  app.get('/admin*', (req, res) => {
    res.status(503).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>ECC Admin Portal Setup</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; background: #EEF2F9; color: #1E293B;">
        <h2>Excellence Coaching Classes — Admin Portal</h2>
        <p>The admin submodule is initializing or awaiting deployment of <code>admin.js</code>.</p>
        <p><a href="/">Return to Main Website</a></p>
      </body>
      </html>
    `);
  });
}

// ==========================================
// 9. PUBLIC WEBSITE (PRESERVED CLAYMORPHISM UI)
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
  <meta name="description" content="Excellence Coaching Classes (ECC), Galle Borgaon, Maharashtra. Founded by Prof. Anil Karangle. Coaching for 11th Standard, 12th Standard, MHT-CET, JEE, and NEET.">
  
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

    .section-title-wrap { text-align: center; max-width: 760px; margin: 0 auto 56px; }
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
      padding: 11px 16px;
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
    .metric-card strong { display: block; font-size: 1.35rem; font-family: var(--font-display); color: var(--navy); }
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
    .course-footer { border-top: 1px dashed #CBD5E1; padding-top: 20px; margin-top: auto; display: flex; align-items: center; justify-content: space-between; }
    .course-price-wrap small { display: block; font-size: 0.72rem; color: var(--text-muted); }
    .course-price-wrap strong { font-size: 1.05rem; color: var(--navy); }

    .fee-notice-banner {
      background: var(--clay-yellow-light); border-left: 4px solid var(--clay-yellow); padding: 16px 20px; border-radius: var(--radius-sm); margin-bottom: 32px; font-size: 0.9rem; color: #78350F;
    }

    .faculty-wrapper { max-width: 900px; margin: 0 auto; }
    .faculty-single-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .faculty-card { text-align: center; padding: 32px 24px; }
    .faculty-avatar-box {
      width: 96px; height: 96px; margin: 0 auto 18px; border-radius: 50%; background: linear-gradient(135deg, #E0E7FF, #FDF4FF); display: flex; align-items: center; justify-content: center; font-size: 2.4rem; color: var(--clay-purple); box-shadow: var(--clay-shadow-card); border: 3px solid #FFF;
    }
    .faculty-name { font-size: 1.28rem; margin-bottom: 4px; }
    .faculty-subj { font-size: 0.88rem; font-weight: 700; color: var(--clay-purple); margin-bottom: 12px; display: block; }
    .faculty-bio { font-size: 0.88rem; line-height: 1.6; }

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
      .faculty-single-grid { grid-template-columns: 1fr; }
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
      .footer-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <!-- Top Announcement Bar -->
  <aside class="announcement-bar" role="complementary" aria-label="Announcement">
    <span class="pulse-dot"></span>
    <span><strong>Admissions Open</strong> — 11th Standard, 12th Standard, MHT-CET, JEE & NEET Batches at Galle Borgaon</span>
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
            Excellence Coaching Classes
            <small>Galle Borgaon, Maharashtra</small>
          </div>
        </a>

        <ul class="nav-links" id="navLinks">
          <li><a href="#about" class="nav-link">About</a></li>
          <li><a href="#courses" class="nav-link">Courses</a></li>
          <li><a href="#leadership" class="nav-link">Leadership</a></li>
          <li><a href="#admissions" class="nav-link">Admissions</a></li>
          <li><a href="#faq" class="nav-link">FAQs</a></li>
          <li><a href="#contact" class="nav-link">Contact</a></li>
        </ul>

        <div class="nav-actions">
          <a href="#admissions" class="clay-btn clay-btn-primary" style="padding: 10px 20px; font-size: 0.88rem;">
            <i class="fa-solid fa-file-signature"></i> Apply Now
          </a>
          <a href="/admin" class="btn-admin-link" title="Administration Portal">
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
            <i class="fa-solid fa-award"></i> Quality Education in Galle Borgaon
          </div>
          <h1>Your Dreams Deserve <span class="gradient-text">Excellence.</span></h1>
          <p class="hero-description">
            Build unshakeable concepts, dedicated study discipline, and academic confidence under the leadership of Prof. Anil Karangle. Coaching programs for 11th Standard, 12th Standard, MHT-CET, JEE, and NEET.
          </p>

          <div class="hero-buttons">
            <a href="#admissions" class="clay-btn clay-btn-coral">
              <i class="fa-solid fa-paper-plane"></i> Apply for Admission
            </a>
            <a href="#courses" class="clay-btn clay-btn-secondary">
              <i class="fa-solid fa-book-open"></i> View All Courses
            </a>
          </div>

          <div class="hero-metrics">
            <div class="metric-card">
              <strong>5 Programs</strong>
              <span>Targeted Offerings</span>
            </div>
            <div class="metric-card">
              <strong>Galle Borgaon</strong>
              <span>Classroom Center</span>
            </div>
            <div class="metric-card">
              <strong>Concept First</strong>
              <span>Dedicated Mentorship</span>
            </div>
          </div>
        </div>

        <div class="hero-visual">
          <div class="clay-sphere">
            <div style="text-align: center; padding: 20px;">
              <i class="fa-solid fa-atom" style="font-size: 5rem; color: var(--clay-purple); margin-bottom: 14px;"></i>
              <h3 style="font-size: 1.3rem;">Learn Today.<br>Lead Tomorrow.</h3>
              <p style="font-size: 0.82rem; margin-top: 6px;">Excellence Coaching Classes</p>
            </div>
            <div class="floating-clay-item float-item-1">
              <i class="fa-solid fa-dna" style="color: var(--clay-purple);"></i>
              <div>NEET & JEE</div>
            </div>
            <div class="floating-clay-item float-item-2">
              <i class="fa-solid fa-chart-line" style="color: var(--clay-mint);"></i>
              <div>MHT-CET</div>
            </div>
            <div class="floating-clay-item float-item-3">
              <i class="fa-solid fa-book" style="color: var(--clay-coral);"></i>
              <div>11th & 12th Standard</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT SECTION -->
    <section id="about" class="section-padding" style="background: rgba(255, 255, 255, 0.5);">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Educational Approach</span>
          <h2>Our Core Learning Philosophy</h2>
          <p>At Excellence Coaching Classes, we focus on fundamental clarity, disciplined practice, and personalized guidance to ensure students achieve their potential.</p>
        </div>

        <div class="about-grid">
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-purple-light); color: var(--clay-purple);">
              <i class="fa-solid fa-brain"></i>
            </div>
            <h3>1. Clarity</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Focusing on deep concept comprehension from fundamentals rather than superficial memorization.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-blue-light); color: var(--clay-blue);">
              <i class="fa-solid fa-pen-ruler"></i>
            </div>
            <h3>2. Practice</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Systematic exercise sets calibrated to match both board standards and competitive examinations.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-coral-light); color: var(--clay-coral);">
              <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <h3>3. Guidance</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Direct classroom attention to address individual learning difficulties and build exam confidence.</p>
          </div>
          <div class="clay-card about-pillar-card">
            <div class="about-icon" style="background: var(--clay-mint-light); color: var(--clay-mint);">
              <i class="fa-solid fa-trophy"></i>
            </div>
            <h3>4. Discipline</h3>
            <p style="font-size: 0.9rem; margin-top: 10px;">Encouraging structured daily study routines essential for academic excellence.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- COURSES SECTION -->
    <section id="courses" class="section-padding">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Academic Offerings</span>
          <h2>Our Confirmed Programs</h2>
          <p>Excellence Coaching Classes offers focused coaching exclusively in the following five categories at Galle Borgaon.</p>
        </div>

        <div class="fee-notice-banner">
          <i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>
          <strong>Fee Structure Notice:</strong> Indicative fee range is <strong>₹20,000 – ₹25,000</strong>. Final fees are decided after an in-person meeting with Prof. Anil Karangle at our coaching center.
        </div>

        <div class="courses-grid" id="coursesList"></div>
      </div>
    </section>

    <!-- LEADERSHIP & FACULTY SECTION -->
    <section id="leadership" class="section-padding" style="background: var(--bg-cream);">
      <div class="container faculty-wrapper">
        <div class="section-title-wrap">
          <span class="badge-pill">Institute Leadership</span>
          <h2>Academic Direction & Faculty</h2>
          <p>Excellence Coaching Classes is guided and managed under the direct leadership of its owner.</p>
        </div>

        <div class="faculty-single-grid">
          <div class="clay-card faculty-card">
            <div class="faculty-avatar-box">
              <i class="fa-solid fa-chalkboard-user"></i>
            </div>
            <h3 class="faculty-name">Prof. Anil Karangle</h3>
            <span class="faculty-subj">Owner & Founder</span>
            <p class="faculty-bio">
              Directs the educational vision, student counseling, and curriculum standards at Excellence Coaching Classes in Galle Borgaon, ensuring rigorous foundational learning for every student.
            </p>
          </div>

          <div class="clay-card faculty-card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; border: 2px dashed #CBD5E1; background: rgba(255, 255, 255, 0.6);">
            <div style="font-size: 2.2rem; color: #94A3B8; margin-bottom: 12px;">
              <i class="fa-solid fa-users"></i>
            </div>
            <h4 style="color: var(--navy); margin-bottom: 8px;">Faculty & Mentorship Team</h4>
            <p style="font-size: 0.88rem; max-width: 320px; line-height: 1.6;">
              Subject-specific faculty credentials and teaching assignments are verified and shared directly at our Galle Borgaon center.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ADMISSION WIZARD -->
    <section id="admissions" class="section-padding">
      <div class="container admission-wrapper">
        <div class="section-title-wrap">
          <span class="badge-pill">Admissions</span>
          <h2>Online Admission Registration</h2>
          <p>Register your interest in our programs. Enquiries are reviewed directly by the institute administration.</p>
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
                  <input type="text" id="studentName" class="clay-input" placeholder="Full name of student" required>
                </div>
                <div class="form-group">
                  <label for="parentName">Parent / Guardian Name *</label>
                  <input type="text" id="parentName" class="clay-input" placeholder="Full name of parent" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="studentEmail">Email Address *</label>
                  <input type="email" id="studentEmail" class="clay-input" placeholder="student@example.com" required>
                </div>
                <div class="form-group">
                  <label for="studentMobile">Student Mobile Number *</label>
                  <input type="tel" id="studentMobile" class="clay-input" placeholder="Contact number" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="parentMobile">Parent Contact Number *</label>
                  <input type="tel" id="parentMobile" class="clay-input" placeholder="Parent contact number" required>
                </div>
                <div class="form-group">
                  <label for="preferredContact">Preferred Contact Method</label>
                  <select id="preferredContact" class="clay-select">
                    <option value="Phone Call">Phone Call</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
              </div>
              <div class="wizard-nav-actions" style="justify-content: flex-end;">
                <button type="button" class="clay-btn clay-btn-primary" onclick="wizardNext(1)">
                  Next: Educational Details <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- STEP 2 -->
            <div class="form-step-content" id="step2">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 2: Educational Background & Address</h3>
              <div class="form-row">
                <div class="form-group">
                  <label for="currentClass">Current Class / Standard *</label>
                  <select id="currentClass" class="clay-select" required>
                    <option value="10th Standard Completed">10th Standard Completed</option>
                    <option value="11th Standard">11th Standard</option>
                    <option value="12th Standard">12th Standard</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="previousPercentage">Previous Exam Percentage (Optional)</label>
                  <input type="number" id="previousPercentage" class="clay-input" placeholder="e.g. 85.0" min="30" max="100" step="0.1">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="city">Town / Village / City *</label>
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
                  Next: Course Selection <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- STEP 3 -->
            <div class="form-step-content" id="step3">
              <h3 style="margin-bottom: 20px; font-size: 1.25rem;">Step 3: Program Selection</h3>
              <div class="form-group">
                <label for="desiredCourse">Selected Program *</label>
                <select id="desiredCourse" class="clay-select" required>
                  <option value="">-- Please select an offered course --</option>
                  <option value="course-11th-standard">11th Standard</option>
                  <option value="course-12th-standard">12th Standard</option>
                  <option value="course-mht-cet">MHT-CET</option>
                  <option value="course-jee">JEE</option>
                  <option value="course-neet">NEET</option>
                </select>
              </div>

              <div class="fee-notice-banner" style="margin-top: 16px;">
                <i class="fa-solid fa-circle-info" style="margin-right: 6px;"></i>
                Indicative fee range: <strong>₹20,000 – ₹25,000</strong>. Final fees are finalized after meeting with Prof. Anil Karangle.
              </div>

              <div class="form-group">
                <label for="admissionMessage">Any Specific Notes or Queries for Prof. Anil Karangle</label>
                <textarea id="admissionMessage" class="clay-textarea" rows="3" placeholder="Optional notes regarding your academic background or queries..."></textarea>
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
              <p style="font-size: 0.88rem; margin-bottom: 16px;">Please review the details entered below. An official ECC registration reference code will be generated upon submission.</p>

              <div class="clay-card" style="padding: 16px; background: #F8FAFC; margin-bottom: 20px;">
                <table class="review-table">
                  <tr><td>Student Name:</td><td id="revName">-</td></tr>
                  <tr><td>Parent Name:</td><td id="revParent">-</td></tr>
                  <tr><td>Contact Numbers:</td><td id="revPhones">-</td></tr>
                  <tr><td>Email Address:</td><td id="revEmail">-</td></tr>
                  <tr><td>Selected Course:</td><td id="revCourse" style="font-weight: 700; color: var(--clay-purple);">-</td></tr>
                  <tr><td>Location:</td><td id="revLocation">-</td></tr>
                  <tr><td>Indicative Fee:</td><td>₹20,000 – ₹25,000 (Finalized with Owner)</td></tr>
                </table>
              </div>

              <div class="consent-box">
                <input type="checkbox" id="consentCheckbox" required style="margin-top: 4px; width: 18px; height: 18px; accent-color: var(--clay-purple);">
                <label for="consentCheckbox">
                  I confirm that the submitted information is accurate. I understand that registration of interest is subject to meeting with Prof. Anil Karangle and seat confirmation by Excellence Coaching Classes.
                </label>
              </div>

              <div class="wizard-nav-actions">
                <button type="button" class="clay-btn clay-btn-secondary" onclick="wizardBack(4)">
                  <i class="fa-solid fa-arrow-left"></i> Edit Details
                </button>
                <button type="submit" class="clay-btn clay-btn-coral" id="submitAdmissionBtn">
                  <i class="fa-solid fa-check"></i> Submit Application
                </button>
              </div>
            </div>
          </form>

          <!-- Success Screen -->
          <div id="admissionSuccessBox" style="display: none; text-align: center; padding: 40px 20px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--clay-mint-light); color: var(--clay-mint); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 24px;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <h3 style="font-size: 1.8rem; margin-bottom: 10px;">Application Successfully Received</h3>
            <p style="max-width: 540px; margin: 0 auto 24px;">Thank you for registering your interest with Excellence Coaching Classes. Your enquiry reference number is:</p>
            
            <div style="display: inline-block; background: #FFFFFF; border: 2px dashed var(--clay-purple); border-radius: var(--radius-md); padding: 16px 36px; margin-bottom: 24px;">
              <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); font-weight: 700;">Reference Code</span>
              <div id="issuedRefNumber" style="font-size: 1.8rem; font-family: var(--font-display); font-weight: 800; color: var(--navy); margin-top: 4px;">ECC-XXXXXX</div>
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 24px;">
              Please retain this reference code for in-person consultation with Prof. Anil Karangle at our Galle Borgaon center.
            </p>

            <button type="button" class="clay-btn clay-btn-primary" onclick="resetAdmissionWizard()">
              <i class="fa-solid fa-rotate-right"></i> Submit Another Enquiry
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ SECTION -->
    <section id="faq" class="section-padding" style="background: rgba(255, 255, 255, 0.4);">
      <div class="container faq-container">
        <div class="section-title-wrap">
          <span class="badge-pill">Information</span>
          <h2>Frequently Asked Questions</h2>
          <p>Common questions regarding courses, admissions, and fee consultation at Excellence Coaching Classes.</p>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            What courses are offered at Excellence Coaching Classes?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Excellence Coaching Classes offers specialized instruction in five programs: 11th Standard, 12th Standard, MHT-CET, JEE, and NEET.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            What is the fee structure for courses?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            The indicative fee range is ₹20,000 – ₹25,000. Final fees are decided after an in-person meeting with Prof. Anil Karangle at our Galle Borgaon center.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            Where is the coaching center located?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Excellence Coaching Classes is situated in Galle Borgaon, Maharashtra, India.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            Who oversees the academic direction at ECC?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            Excellence Coaching Classes is owned and managed by Prof. Anil Karangle.
          </div>
        </div>

        <div class="accordion-item">
          <button class="accordion-header" onclick="toggleFaq(this)">
            How do I contact the institute for enquiries?
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="accordion-body">
            You can submit an enquiry via the online form on this website, email us at excellencecoachingclasses@gmail.com, or visit the center in Galle Borgaon.
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT SECTION -->
    <section id="contact" class="section-padding">
      <div class="container">
        <div class="section-title-wrap">
          <span class="badge-pill">Get in Touch</span>
          <h2>Contact Excellence Coaching Classes</h2>
          <p>Have questions regarding admission or courses? Reach out to us via email or visit our center in Galle Borgaon.</p>
        </div>

        <div class="contact-grid">
          <div class="clay-card">
            <h3 style="margin-bottom: 24px;">Institute Information</h3>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-location-dot"></i></div>
              <div>
                <strong>Location</strong>
                <p style="font-size: 0.9rem;">Galle Borgaon, Maharashtra, India</p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-user-tie"></i></div>
              <div>
                <strong>Founder & Owner</strong>
                <p style="font-size: 0.9rem;">Prof. Anil Karangle</p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-envelope"></i></div>
              <div>
                <strong>Official Email Address</strong>
                <p style="font-size: 0.9rem;"><a href="mailto:excellencecoachingclasses@gmail.com" style="color: var(--clay-purple); font-weight: 600;">excellencecoachingclasses@gmail.com</a></p>
              </div>
            </div>

            <div class="contact-detail-row">
              <div class="contact-clay-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
              <div>
                <strong>Fee Policy</strong>
                <p style="font-size: 0.9rem;">Indicative range ₹20,000 – ₹25,000 (finalized upon meeting with Prof. Anil Karangle)</p>
              </div>
            </div>

            <div style="margin-top: 24px;">
              <a href="mailto:excellencecoachingclasses@gmail.com" class="clay-btn clay-btn-primary" style="width: 100%;">
                <i class="fa-solid fa-envelope"></i> Send Direct Email
              </a>
            </div>
          </div>

          <div class="clay-card">
            <h3 style="margin-bottom: 20px;">Send an Online Message</h3>
            <form id="contactForm" novalidate>
              <div class="form-group">
                <label for="contactName">Your Name *</label>
                <input type="text" id="contactName" class="clay-input" placeholder="Your full name" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="contactEmail">Email Address *</label>
                  <input type="email" id="contactEmail" class="clay-input" placeholder="your.email@example.com" required>
                </div>
                <div class="form-group">
                  <label for="contactPhone">Phone Number (Optional)</label>
                  <input type="tel" id="contactPhone" class="clay-input" placeholder="Your contact number">
                </div>
              </div>
              <div class="form-group">
                <label for="contactSubject">Subject</label>
                <input type="text" id="contactSubject" class="clay-input" placeholder="Course Enquiry / Admission Question">
              </div>
              <div class="form-group">
                <label for="contactMessage">Your Message *</label>
                <textarea id="contactMessage" class="clay-textarea" rows="4" placeholder="How can our administration assist you?" required></textarea>
              </div>
              <button type="submit" class="clay-btn clay-btn-coral" id="contactSubmitBtn">
                <i class="fa-solid fa-paper-plane"></i> Send Message
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
          <span class="badge-pill" id="modalCourseCategory">Category</span>
          <h3 id="modalCourseTitle" style="font-size: 1.5rem; margin-top: 6px;">Course Details</h3>
        </div>
        <button onclick="closeCourseModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
      </div>
      <p id="modalCourseDesc" style="margin-bottom: 20px; line-height: 1.7;"></p>
      
      <div style="background: #F1F5F9; padding: 16px; border-radius: var(--radius-sm); margin-bottom: 24px;">
        <div style="margin-bottom: 8px;">
          <strong style="color: var(--navy); display: block; font-size: 0.95rem;">Indicative Fee: ₹20,000 – ₹25,000</strong>
        </div>
        <p style="font-size: 0.82rem; margin: 0; color: var(--text-muted);">
          Note: Final fees are decided after an in-person meeting with Prof. Anil Karangle.
        </p>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 14px;">
        <button class="clay-btn clay-btn-secondary" onclick="closeCourseModal()">Close</button>
        <button class="clay-btn clay-btn-coral" id="modalApplyBtn">Register Interest</button>
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
            <div>Excellence Coaching Classes<small style="color: #A5B4FC;">Galle Borgaon, Maharashtra</small></div>
          </div>
          <p style="font-size: 0.88rem; color: #94A3B8; margin-bottom: 18px;">
            "Learn Today. Lead Tomorrow." Focused coaching for 11th Standard, 12th Standard, MHT-CET, JEE, and NEET.
          </p>
          <p style="font-size: 0.82rem; color: #64748B;">Founder & Owner: Prof. Anil Karangle</p>
        </div>

        <div>
          <h4>Confirmed Courses</h4>
          <ul class="footer-links">
            <li><a href="#courses">11th Standard</a></li>
            <li><a href="#courses">12th Standard</a></li>
            <li><a href="#courses">MHT-CET</a></li>
            <li><a href="#courses">JEE</a></li>
            <li><a href="#courses">NEET</a></li>
          </ul>
        </div>

        <div>
          <h4>Navigation</h4>
          <ul class="footer-links">
            <li><a href="#about">Learning Method</a></li>
            <li><a href="#leadership">Leadership</a></li>
            <li><a href="#admissions">Admissions</a></li>
            <li><a href="#faq">Frequently Asked Questions</a></li>
            <li><a href="/admin">Admin Portal</a></li>
          </ul>
        </div>

        <div>
          <h4>Center Information</h4>
          <p style="font-size: 0.88rem; margin-bottom: 8px;">Galle Borgaon, Maharashtra, India</p>
          <p style="font-size: 0.88rem; margin-bottom: 14px;">Email: <a href="mailto:excellencecoachingclasses@gmail.com" style="color: #A5B4FC;">excellencecoachingclasses@gmail.com</a></p>
          <p style="font-size: 0.82rem; color: #94A3B8;">Indicative Fees: ₹20,000 – ₹25,000</p>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; <span id="currentYear"></span> Excellence Coaching Classes (ECC). All rights reserved.</p>
        <p style="font-size: 0.8rem; margin-top: 6px; color: #64748B;">
          Galle Borgaon, Maharashtra | Owner: Prof. Anil Karangle
        </p>
      </div>
    </div>
  </footer>

  <script>
    let coursesData = [];
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navLinks = document.getElementById('navLinks');
    if (hamburgerBtn && navLinks) {
      hamburgerBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
      document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => navLinks.classList.remove('active'));
      });
    }

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
      if (!container) return;
      container.innerHTML = courses.map(c => {
        return \`
          <div class="clay-card course-card">
            <div>
              <div class="course-top-bar">
                <span class="badge-pill" style="margin-bottom: 0;">\${c.category}</span>
              </div>
              <h3 class="course-title">\${c.title}</h3>
              <p style="font-size: 0.88rem; line-height: 1.5; margin-bottom: 16px;">\${c.description}</p>
              <div style="font-size: 0.82rem; color: var(--navy); font-weight: 600; margin-bottom: 8px;">
                <i class="fa-solid fa-users-viewfinder" style="color: var(--clay-purple); margin-right: 6px;"></i> \${c.targetAudience}
              </div>
            </div>

            <div class="course-footer">
              <div class="course-price-wrap">
                <small>Indicative Range</small>
                <strong>\${c.indicativeFee}</strong>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="clay-btn clay-btn-secondary" style="padding: 8px 14px; font-size: 0.84rem;" onclick="openCourseModal('\${c.id}')">Details</button>
                <button class="clay-btn clay-btn-coral" style="padding: 8px 14px; font-size: 0.84rem;" onclick="selectCourseAndEnroll('\${c.id}')">Apply</button>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function openCourseModal(courseId) {
      const course = coursesData.find(c => c.id === courseId);
      if (!course) return;

      document.getElementById('modalCourseCategory').textContent = course.category;
      document.getElementById('modalCourseTitle').textContent = course.title;
      document.getElementById('modalCourseDesc').textContent = course.description;

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
      if (selectBox) selectBox.value = courseId;
      const admSec = document.getElementById('admissions');
      if (admSec) admSec.scrollIntoView({ behavior: 'smooth' });
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
          showToast('Please fill out all required contact fields.', 'error');
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
          showToast('Please enter your city and state.', 'error');
          return;
        }
      }

      if (fromStep === 3) {
        const course = document.getElementById('desiredCourse').value;
        if (!course) {
          showToast('Please select your target course.', 'error');
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
      document.getElementById('revLocation').textContent = document.getElementById('city').value + ', ' + document.getElementById('state').value;
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
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

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
          showToast(data.error || 'Submission failed. Please check your entries.', 'error');
        }
      } catch (err) {
        showToast('Could not reach admission server. Please check your connection.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Submit Application';
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
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Message';
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

// Global Centralized Error Handling
app.use((err, req, res, next) => {
  console.error('[ECC Server Error]:', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, error: 'Internal application server error.' });
  }
  res.status(500).send('An unexpected server error occurred. Please refresh the page.');
});

// Local listener (ignored in Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  Excellence Coaching Classes (ECC) Active`);
    console.log(`  Location:    ${INSTITUTE_INFO.location}`);
    console.log(`  Owner:       ${INSTITUTE_INFO.owner}`);
    console.log(`  Email:       ${INSTITUTE_INFO.email}`);
    console.log(`  URL:         http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
