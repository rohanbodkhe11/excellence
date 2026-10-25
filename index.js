/**
 * EXCELLENCE COACHING CLASSES, GALLE BORGAON, MAHARASHTRA
 * Master Application Server (Node.js 24 + Express + Native MongoDB Driver)
 */

const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

// Import the Admin Router Module
const adminRouter = require('./admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Centralized Institute Configuration
const INSTITUTE = {
  name: "Excellence Coaching Classes",
  tagline: "Learn Today. Lead Tomorrow.",
  location: "Galle Borgaon, Maharashtra, India",
  address: "Main Highway Road, Opposite State Bus Station, Galle Borgaon, Chhatrapati Sambhajinagar District, Maharashtra 431102",
  phone: "+91 90000 12345",
  rawPhone: "919000012345",
  email: "admissions@excellence-galleborgaon.in",
  workingHours: "Monday–Saturday: 7:00 AM – 8:00 PM | Sunday: 8:00 AM – 1:00 PM",
  academicSession: "2026–2027",
  currency: "₹"
};

// Security Constants
const JWT_SECRET = process.env.SESSION_SECRET || 'ecc-galle-borgaon-ultra-secure-token-2026';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'excellence_coaching_db';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@excellence.edu').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Excellence@2026';

// Middleware Setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://images.pexels.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://maps.google.com", "https://www.google.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serverless-Optimized MongoDB Connection Pool Cache
let cachedClient = null;
let cachedDb = null;

async function getDatabase() {
  if (cachedDb && cachedClient) return cachedDb;
  if (!MONGODB_URI) {
    console.warn('⚠️ MONGODB_URI is not set. Database features will run in mock mode.');
    return null;
  }
  try {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });
    await client.connect();
    const db = client.db(MONGODB_DB);
    cachedClient = client;
    cachedDb = db;
    await bootstrapDatabase(db);
    return db;
  } catch (err) {
    console.error('❌ MongoDB Connection Failure:', err.message);
    return null;
  }
}

// Bootstrap Seed (Safe & Idempotent)
async function bootstrapDatabase(db) {
  try {
    // 1. Ensure Administrator Account
    const adminExists = await db.collection('users').findOne({ email: ADMIN_EMAIL });
    if (!adminExists) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await db.collection('users').insertOne({
        fullName: 'Director / Academic Head',
        email: ADMIN_EMAIL,
        phone: '9000012345',
        passwordHash,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Master Administrator profile initialized.');
    }

    // 2. Ensure Core Science Courses
    const coursesCount = await db.collection('courses').countDocuments();
    if (coursesCount === 0) {
      await db.collection('courses').insertMany([
        {
          title: "Class 11 Science (PCMB) Foundation",
          description: "Rigorous concept mastery in Mechanics, Chemical Bonding, Cell Biology, and Coordinate Geometry. Built for State Board & CBSE.",
          subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
          targetClass: "Class 11th",
          duration: "1 Year",
          fee: 38000,
          imageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80",
          isPublished: true,
          createdAt: new Date()
        },
        {
          title: "Class 12 Science Board Target Batch",
          description: "Strict syllabus completion by October, followed by extensive subjective answer-writing practice and state board test series.",
          subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
          targetClass: "Class 12th",
          duration: "1 Year",
          fee: 45000,
          imageUrl: "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80",
          isPublished: true,
          createdAt: new Date()
        },
        {
          title: "MHT-CET Guaranteed Rank Booster",
          description: "Shortcuts, high-yield formula drills, previous 20 years chapter-wise questions, and computerized speed tests.",
          subjects: ["Physics", "Chemistry", "Mathematics", "Biology"],
          targetClass: "12th & Repeaters",
          duration: "9 Months",
          fee: 32000,
          imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80",
          isPublished: true,
          createdAt: new Date()
        },
        {
          title: "NEET-UG Medical Masterclass",
          description: "Intensive NCERT line-by-line decoding, complete diagram practice, rapid-fire quizzes, and OMR simulation.",
          subjects: ["Physics", "Chemistry", "Botany", "Zoology"],
          targetClass: "11th, 12th & Repeaters",
          duration: "2 Years",
          fee: 68000,
          imageUrl: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
          isPublished: true,
          createdAt: new Date()
        },
        {
          title: "JEE Main & Advanced Integrated",
          description: "Deep analytical problem-solving, advanced multi-concept questions, timed speed rounds, and regular doubt resolution.",
          subjects: ["Physics", "Chemistry", "Mathematics"],
          targetClass: "11th & 12th",
          duration: "2 Years",
          fee: 65000,
          imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
          isPublished: true,
          createdAt: new Date()
        }
      ]);
    }

    // 3. Ensure Online MCQ Tests with Negative Marking Support
    const testsCount = await db.collection('tests').countDocuments();
    if (testsCount === 0) {
      await db.collection('tests').insertOne({
        title: "MHT-CET Science Diagnostic Assessment",
        course: "MHT-CET Guaranteed Rank Booster",
        subject: "Physics & Chemistry",
        durationMinutes: 15,
        isPublished: true,
        enableNegativeMarking: true,
        questions: [
          {
            id: "q_01",
            text: "The dimensional formula of Surface Tension is identical to that of:",
            options: ["Spring constant", "Force per unit area", "Angular momentum", "Work done"],
            correctAnswerIndex: 0,
            explanation: "Surface Tension = Force/Length (MT^-2). Spring Constant k = F/x (MT^-2)."
          },
          {
            id: "q_02",
            text: "Which of the following compounds exhibits optical isomerism?",
            options: ["Lactic acid", "Acetic acid", "Formic acid", "Oxalic acid"],
            correctAnswerIndex: 0,
            explanation: "Lactic acid has a chiral carbon attached to -H, -OH, -CH3, and -COOH."
          },
          {
            id: "q_03",
            text: "When light travels from glass to air, which parameter remains strictly unchanged?",
            options: ["Frequency", "Wavelength", "Velocity", "Amplitude"],
            correctAnswerIndex: 0,
            explanation: "Frequency depends only on the source of radiation and never changes across media."
          },
          {
            id: "q_04",
            text: "The bond angle in the water molecule (H2O) is approximately:",
            options: ["104.5°", "109.5°", "120°", "180°"],
            correctAnswerIndex: 0,
            explanation: "Due to repulsion between the two lone pairs of electrons on Oxygen, the tetrahedral angle reduces to 104.5°."
          }
        ],
        createdAt: new Date()
      });
    }

    // 4. Ensure Announcements
    const annCount = await db.collection('announcements').countDocuments();
    if (annCount === 0) {
      await db.collection('announcements').insertMany([
        {
          title: "Admissions Open for 2026-27 Academic Batches",
          category: "Admissions",
          description: "Early-bird registrations for 11th Science and MHT-CET batches now open at our Galle Borgaon campus.",
          isPublished: true,
          createdAt: new Date()
        },
        {
          title: "Sunday Special Full-Length Board Simulation Test",
          category: "Exams",
          description: "Class 12th Board Model Test (Physics & Chemistry) will be held this Sunday at 8:30 AM sharp.",
          isPublished: true,
          createdAt: new Date()
        }
      ]);
    }
  } catch (err) {
    console.error('Seeder warning:', err);
  }
}

// Authentication Middleware
function extractUserToken(req, res, next) {
  const token = req.cookies.ecc_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Please sign in to proceed.' });
  }
  next();
}

function requireAdminRole(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Unauthorized. Staff administrator access required.' });
  }
  next();
}

app.use(extractUserToken);

// Mount Dedicated Admin Router (File 4) on /admin
app.use('/admin', adminRouter);

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    institute: INSTITUTE.name,
    campus: INSTITUTE.location
  });
});

// Auth: Register (Student)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, phone, email, password } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Full name, 10-digit phone number, and password are required.' });
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number.' });
    }
    const cleanEmail = (email && email.trim()) ? email.trim().toLowerCase() : `${cleanPhone}@student.excellence.local`;

    const db = await getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'Database connection offline.' });

    const existing = await db.collection('users').findOne({
      $or: [{ phone: cleanPhone }, { email: cleanEmail }]
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this mobile number or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newStudent = {
      fullName: fullName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      passwordHash,
      role: 'student',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newStudent);
    const token = jwt.sign(
      { userId: result.insertedId.toString(), name: newStudent.fullName, email: cleanEmail, role: 'student' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('ecc_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      message: 'Student account created successfully!',
      user: { id: result.insertedId, fullName: newStudent.fullName, phone: cleanPhone, email: cleanEmail }
    });
  } catch (err) {
    console.error('Registration failed:', err);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// Auth: Login (Student & Admin)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide your mobile/email and password.' });
    }
    const cleanIdent = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/[^0-9]/g, '');

    const db = await getDatabase();
    if (!db) {
      // Direct Master Fallback in offline state
      if (cleanIdent === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        const token = jwt.sign({ userId: 'master-admin-01', name: 'Master Administrator', email: ADMIN_EMAIL, role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
        res.cookie('ecc_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        return res.json({ success: true, user: { fullName: 'Master Administrator', role: 'admin', email: ADMIN_EMAIL } });
      }
      return res.status(503).json({ success: false, message: 'Database offline.' });
    }

    const user = await db.collection('users').findOne({
      $or: [
        { email: cleanIdent },
        { phone: cleanPhone.length >= 10 ? cleanPhone : 'INVALID' }
      ]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), name: user.fullName, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('ecc_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Sign in successful.',
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server login error.' });
  }
});

// Auth: Current State
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: req.user });
});

// Auth: Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('ecc_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Public: Admission Enquiry Submission
app.post('/api/enquiries', async (req, res) => {
  try {
    const { studentName, parentName, phone, email, currentClass, desiredCourse, preferredBatch, message } = req.body;
    if (!studentName || !phone || !desiredCourse) {
      return res.status(400).json({ success: false, message: 'Student Name, Phone Number, and Desired Course are mandatory.' });
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit phone number.' });
    }

    const refNum = `ECC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const enquiryDoc = {
      referenceNumber: refNum,
      studentName: studentName.trim(),
      parentName: (parentName || '').trim(),
      phone: cleanPhone,
      email: (email || '').trim().toLowerCase(),
      currentClass: currentClass || '11th/12th',
      desiredCourse,
      preferredBatch: preferredBatch || 'Morning Batch',
      message: (message || '').trim(),
      status: 'New',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const db = await getDatabase();
    if (db) {
      await db.collection('enquiries').insertOne(enquiryDoc);
    }

    res.status(201).json({
      success: true,
      message: 'Admission enquiry recorded successfully!',
      referenceNumber: refNum
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to record admission enquiry.' });
  }
});

// Public: Courses
app.get('/api/courses', async (req, res) => {
  try {
    const db = await getDatabase();
    const courses = db ? await db.collection('courses').find({ isPublished: true }).toArray() : [];
    res.json({ success: true, courses });
  } catch (err) {
    res.status(500).json({ success: false, courses: [] });
  }
});

// Public: Announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const db = await getDatabase();
    const announcements = db ? await db.collection('announcements').find({ isPublished: true }).sort({ createdAt: -1 }).toArray() : [];
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, announcements: [] });
  }
});

// Public: Resources
app.get('/api/resources', async (req, res) => {
  try {
    const db = await getDatabase();
    const resources = db ? await db.collection('resources').find({}).sort({ createdAt: -1 }).toArray() : [];
    res.json({ success: true, resources });
  } catch (err) {
    res.status(500).json({ success: false, resources: [] });
  }
});

// Public: Tests Listing (Answer keys explicitly projected out!)
app.get('/api/tests', async (req, res) => {
  try {
    const db = await getDatabase();
    if (!db) return res.json({ success: true, tests: [] });
    const tests = await db.collection('tests').find({ isPublished: true }).project({
      title: 1,
      course: 1,
      subject: 1,
      durationMinutes: 1,
      enableNegativeMarking: 1,
      "questions.id": 1,
      "questions.text": 1,
      "questions.options": 1
    }).toArray();
    res.json({ success: true, tests });
  } catch (err) {
    res.status(500).json({ success: false, tests: [] });
  }
});

// Student Protected: Submit MCQ Test Attempt with Server-Side Scoring & Explanations
app.post('/api/tests/:testId/submit', requireAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body; // { "q_01": 0, "q_02": 2 }
    const db = await getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'Database unavailable' });

    let qId;
    try { qId = new ObjectId(testId); } catch(e) { qId = testId; }

    const test = await db.collection('tests').findOne({ _id: qId });
    if (!test) return res.status(404).json({ success: false, message: 'Assessment not found.' });

    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;
    const review = [];

    test.questions.forEach((q) => {
      const selectedIndex = answers ? answers[q.id] : undefined;
      const isAttempted = selectedIndex !== undefined && selectedIndex !== null;
      const isCorrect = isAttempted && Number(selectedIndex) === Number(q.correctAnswerIndex);

      if (!isAttempted) {
        unattemptedCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }

      review.push({
        id: q.id,
        text: q.text,
        options: q.options,
        userSelected: isAttempted ? Number(selectedIndex) : null,
        correctAnswer: q.correctAnswerIndex,
        explanation: q.explanation || 'Refer standard syllabus textbook.',
        isCorrect
      });
    });

    const totalQuestions = test.questions.length;
    // Calculate final score with optional -0.25 negative marking
    const rawScore = test.enableNegativeMarking 
      ? Math.max(0, (correctCount * 1) - (incorrectCount * 0.25))
      : correctCount;
    const percentage = totalQuestions > 0 ? Math.round((rawScore / totalQuestions) * 100) : 0;

    const attemptDoc = {
      userId: req.user.userId,
      studentName: req.user.name,
      testId: test._id.toString(),
      testTitle: test.title,
      subject: test.subject,
      totalQuestions,
      correctCount,
      incorrectCount,
      unattemptedCount,
      score: rawScore,
      percentage,
      submittedAt: new Date()
    };

    await db.collection('testAttempts').insertOne(attemptDoc);

    res.json({
      success: true,
      message: 'Test evaluated successfully.',
      result: {
        title: test.title,
        totalQuestions,
        correctCount,
        incorrectCount,
        unattemptedCount,
        score: rawScore,
        percentage,
        review
      }
    });
  } catch (err) {
    console.error('Test evaluation error:', err);
    res.status(500).json({ success: false, message: 'Test scoring failure' });
  }
});

// ==========================================
// ADMIN DATA ENDPOINTS
// ==========================================
app.get('/api/admin/metrics', requireAdminRole, async (req, res) => {
  try {
    const db = await getDatabase();
    if (!db) return res.status(503).json({ success: false, message: 'Database offline' });

    const [enquiriesCount, studentsCount, coursesCount, testsCount, attemptsCount] = await Promise.all([
      db.collection('enquiries').countDocuments({}),
      db.collection('users').countDocuments({ role: 'student' }),
      db.collection('courses').countDocuments({}),
      db.collection('tests').countDocuments({}),
      db.collection('testAttempts').countDocuments({})
    ]);

    const recentEnquiries = await db.collection('enquiries').find({}).sort({ createdAt: -1 }).limit(8).toArray();

    res.json({
      success: true,
      metrics: {
        enquiries: enquiriesCount,
        students: studentsCount,
        courses: coursesCount,
        tests: testsCount,
        attempts: attemptsCount
      },
      recentEnquiries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve admin metrics' });
  }
});

app.get('/api/admin/enquiries', requireAdminRole, async (req, res) => {
  try {
    const db = await getDatabase();
    const list = db ? await db.collection('enquiries').find({}).sort({ createdAt: -1 }).toArray() : [];
    res.json({ success: true, enquiries: list });
  } catch (err) {
    res.status(500).json({ success: false, enquiries: [] });
  }
});

app.patch('/api/admin/enquiries/:id', requireAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    let queryId;
    try { queryId = new ObjectId(id); } catch(e) { queryId = id; }
    const db = await getDatabase();
    await db.collection('enquiries').updateOne({ _id: queryId }, { $set: { status, notes, updatedAt: new Date() } });
    res.json({ success: true, message: 'Enquiry updated' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.get('/api/admin/export/enquiries', requireAdminRole, async (req, res) => {
  try {
    const db = await getDatabase();
    const list = db ? await db.collection('enquiries').find({}).sort({ createdAt: -1 }).toArray() : [];
    let csv = "Reference,Student,Parent,Phone,Email,Class,Course,Batch,Status,Date\n";
    list.forEach(item => {
      csv += `"${item.referenceNumber}","${item.studentName}","${item.parentName || ''}","${item.phone}","${item.email || ''}","${item.currentClass}","${item.desiredCourse}","${item.preferredBatch}","${item.status}","${new Date(item.createdAt).toISOString()}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ECC_GalleBorgaon_Admissions.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).send("CSV Export failure");
  }
});

app.post('/api/admin/courses', requireAdminRole, async (req, res) => {
  try {
    const { title, targetClass, fee, duration, description } = req.body;
    const db = await getDatabase();
    await db.collection('courses').insertOne({
      title: title.trim(),
      targetClass: targetClass || 'Science',
      fee: Number(fee) || 0,
      duration: duration || '1 Year',
      description: description || '',
      isPublished: true,
      createdAt: new Date()
    });
    res.status(201).json({ success: true, message: 'Course added' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete('/api/admin/courses/:id', requireAdminRole, async (req, res) => {
  try {
    let queryId;
    try { queryId = new ObjectId(req.params.id); } catch(e) { queryId = req.params.id; }
    const db = await getDatabase();
    await db.collection('courses').deleteOne({ _id: queryId });
    res.json({ success: true, message: 'Course deleted' });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ==========================================
// PUBLIC PORTAL (Claymorphic Single-Page App)
// ==========================================
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${INSTITUTE.name} — Galle Borgaon | NEET, JEE, MHT-CET, 11th & 12th Science</title>
  <meta name="description" content="Premier science coaching institute in Galle Borgaon, Maharashtra. Exceptional classroom teaching, rigorous practice tests, and dedicated mentorship for Class 11th, 12th, MHT-CET, JEE, and NEET.">
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
      --sunshine-light: #FEF3C7;
      --navy: #1E293B;
      --text-muted: #64748B;
      --bg: #F8FAFC;
      --white: #FFFFFF;
      --radius-sm: 16px;
      --radius-md: 24px;
      --radius-lg: 32px;

      /* Double Inset & Inflated Clay Shadow Palette */
      --clay-box: 
        10px 10px 22px rgba(167, 139, 250, 0.15),
        -8px -8px 20px #FFFFFF,
        inset 3px 3px 6px rgba(255, 255, 255, 0.9),
        inset -3px -3px 6px rgba(167, 139, 250, 0.12);

      --clay-btn-purple:
        6px 6px 14px rgba(139, 92, 246, 0.35),
        -4px -4px 10px #FFFFFF,
        inset 2px 2px 4px rgba(255, 255, 255, 0.6),
        inset -2px -2px 4px rgba(109, 40, 217, 0.3);

      --clay-btn-coral:
        6px 6px 14px rgba(244, 63, 94, 0.35),
        -4px -4px 10px #FFFFFF,
        inset 2px 2px 4px rgba(255, 255, 255, 0.6),
        inset -2px -2px 4px rgba(190, 18, 60, 0.3);

      --clay-input:
        inset 4px 4px 8px rgba(167, 139, 250, 0.15),
        inset -4px -4px 8px #FFFFFF;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Nunito', sans-serif; }
    body { background-color: var(--bg); color: var(--navy); overflow-x: hidden; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: 'Poppins', sans-serif; font-weight: 700; color: var(--navy); }
    a { text-decoration: none; color: inherit; }

    .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    
    /* Clay Primitives */
    .clay-card {
      background: var(--white);
      border-radius: var(--radius-md);
      box-shadow: var(--clay-box);
      border: 2px solid rgba(255, 255, 255, 0.85);
      transition: transform 0.25s ease;
    }
    .clay-card:hover { transform: translateY(-4px); }

    .clay-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 800;
      padding: 12px 26px;
      border-radius: 30px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.95rem;
    }
    .clay-btn:active { transform: scale(0.97) translateY(2px); }
    .btn-purple { background: linear-gradient(135deg, #A78BFA, #8B5CF6); color: white; box-shadow: var(--clay-btn-purple); }
    .btn-coral { background: linear-gradient(135deg, #FB7185, #F43F5E); color: white; box-shadow: var(--clay-btn-coral); }
    .btn-white { background: #FFFFFF; color: var(--navy); box-shadow: 6px 6px 14px rgba(167, 139, 250, 0.15), -4px -4px 10px #FFFFFF; }

    /* Top Banner */
    .top-strip {
      background: linear-gradient(90deg, #7C3AED, #EC4899);
      color: white;
      padding: 8px 16px;
      font-size: 0.84rem;
      text-align: center;
      font-weight: 800;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
    }

    /* Navbar */
    .navbar { position: sticky; top: 16px; z-index: 100; padding: 8px 24px; }
    .nav-wrap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(14px);
      border-radius: var(--radius-lg);
      box-shadow: var(--clay-box);
      border: 2px solid rgba(255, 255, 255, 0.9);
    }
    .brand-logo {
      width: 44px; height: 44px; border-radius: 16px;
      background: linear-gradient(135deg, var(--lavender), var(--sky-blue));
      display: flex; align-items: center; justify-content: center;
      color: white; box-shadow: var(--clay-btn-purple);
    }
    .nav-links { display: flex; align-items: center; gap: 22px; list-style: none; }
    .nav-links a { font-weight: 700; font-size: 0.92rem; color: var(--navy); transition: color 0.2s; }
    .nav-links a:hover { color: #8B5CF6; }

    /* Hero */
    .hero { padding: 48px 0 60px; }
    .hero-grid { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 40px; align-items: center; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px; background: var(--lavender-light);
      color: #6D28D9; font-weight: 800; font-size: 0.82rem;
      border-radius: 20px; margin-bottom: 18px;
    }
    .hero-title { font-size: 3.2rem; line-height: 1.15; margin-bottom: 20px; }
    .hero-title span { background: linear-gradient(135deg, #7C3AED, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

    /* Sections */
    .section-head { text-align: center; max-width: 650px; margin: 0 auto 44px; }
    .section-pill {
      display: inline-block; padding: 6px 16px;
      background: var(--sky-light); color: #0369A1;
      font-weight: 800; font-size: 0.8rem; border-radius: 20px;
      margin-bottom: 12px; text-transform: uppercase;
    }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 28px; }

    /* Test Runner */
    .test-box { max-width: 860px; margin: 0 auto 50px; padding: 36px; }
    .palette-btn {
      width: 40px; height: 40px; border-radius: 12px; border: none;
      font-weight: 800; cursor: pointer; background: #E2E8F0;
      color: var(--navy); transition: all 0.2s;
    }
    .palette-btn.active { background: var(--lavender); color: white; box-shadow: var(--clay-btn-purple); }
    .palette-btn.answered { background: var(--mint); color: #065F46; }

    /* Form */
    .clay-input {
      width: 100%; padding: 14px 18px; border-radius: var(--radius-sm);
      border: 2px solid transparent; background: #F8FAFC;
      box-shadow: var(--clay-input); font-size: 0.95rem; font-weight: 600;
      outline: none; transition: border-color 0.2s;
    }
    .clay-input:focus { border-color: var(--lavender); background: white; }

    /* Modal */
    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(6px);
      display: none; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px;
    }
    .modal-card { background: white; border-radius: var(--radius-lg); padding: 36px; max-width: 460px; width: 100%; position: relative; }

    @media (max-width: 900px) {
      .hero-grid { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .hero-title { font-size: 2.3rem; }
    }
  </style>
</head>
<body>

  <!-- Top Strip -->
  <div class="top-strip">
    <span><i data-lucide="bell" style="width: 14px;"></i> Admissions Open ${INSTITUTE.academicSession}</span>
    <span>•</span>
    <span><i data-lucide="map-pin" style="width: 14px;"></i> Galle Borgaon, Maharashtra</span>
    <span>•</span>
    <span><i data-lucide="phone-call" style="width: 14px;"></i> ${INSTITUTE.phone}</span>
  </div>

  <!-- Navbar -->
  <header class="navbar container">
    <div class="nav-wrap">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="brand-logo"><i data-lucide="graduation-cap"></i></div>
        <div>
          <div style="font-weight: 800; font-size: 1.15rem;">EXCELLENCE</div>
          <div style="font-size: 0.7rem; font-weight: 800; color: #8B5CF6; letter-spacing: 1px;">COACHING CLASSES</div>
        </div>
      </div>

      <ul class="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#courses">Courses</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#tests">Online Tests</a></li>
        <li><a href="#faculty">Faculty</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>

      <div style="display: flex; gap: 12px; align-items: center;">
        <button id="authBtn" class="clay-btn btn-white" onclick="handleAuthClick()">
          <i data-lucide="user"></i> <span id="authLabel">Student Login</span>
        </button>
        <a href="#enquiry" class="clay-btn btn-coral">
          <i data-lucide="sparkles"></i> Enquire Now
        </a>
      </div>
    </div>
  </header>

  <main>
    <!-- HERO -->
    <section id="home" class="hero container">
      
      <div class="hero-content">
        <span class="eyebrow">🎓 Excellence Coaching Classes</span>
        <h1>Learn Today.<br /><span>Lead Tomorrow.</span></h1>
        <p>
          Build strong concepts, improve your confidence, and prepare for
          academic success with expert guidance and personal attention.
        </p>

        <div class="hero-actions">
          <a href="#admission" class="btn btn-primary">Apply for Admission ↗</a>
          <a href="#courses" class="btn btn-secondary">Explore Courses</a>
        </div>

        <div class="hero-stats">
          <div><strong>11th–12th</strong><span>Academic Classes</span></div>
          <div><strong>JEE / NEET</strong><span>Entrance Preparation</span></div>
          <div><strong>Personal</strong><span>Student Guidance</span></div>
        </div>
      </div>

      <div class="hero-visual">
        <div class="hero-card">
          <div class="hero-card-top">
            <span class="hero-icon">📚</span>
            <span class="status-pill">Your Future Starts Here</span>
          </div>
          <h3>Make Learning<br />Your Superpower.</h3>
          <p>Understand concepts. Practise regularly. Achieve your goals.</p>
          <div class="progress-item">
            <div><span>Concept Building</span><b>100%</b></div>
            <div class="progress-bar"><span style="width:100%"></span></div>
          </div>
          <div class="progress-item">
            <div><span>Practice & Revision</span><b>Consistent</b></div>
            <div class="progress-bar"><span style="width:85%"></span></div>
          </div>
          <div class="floating-note">✨ Small steps, big achievements</div>
        </div>
        <div class="hero-decoration decoration-one">✦</div>
        <div class="hero-decoration decoration-two">✧</div>
      </div>
    </section>

    <!-- COURSES -->
    <section id="courses" class="section container">
      <div class="section-heading">
        <span class="eyebrow">OUR COURSES</span>
        <h2>Choose Your Path to <span>Success</span></h2>
        <p>Focused learning for school academics and competitive examinations.</p>
      </div>

      <div class="course-grid">
        <article class="course-card">
          <div class="course-icon icon-orange">📘</div>
          <span class="course-tag">Higher Secondary</span>
          <h3>Class 11th</h3>
          <p>Build a strong foundation with concept-focused teaching and regular practice.</p>
          <a href="#admission">Enquire now ↗</a>
        </article>

        <article class="course-card featured-course">
          <div class="course-icon icon-purple">🎯</div>
          <span class="course-tag">Board Preparation</span>
          <h3>Class 12th</h3>
          <p>Prepare for board examinations with revision, practice, and doubt-solving.</p>
          <a href="#admission">Enquire now ↗</a>
        </article>

        <article class="course-card">
          <div class="course-icon icon-green">🚀</div>
          <span class="course-tag">Competitive Exams</span>
          <h3>JEE Preparation</h3>
          <p>Strengthen problem-solving skills and practise examination-style questions.</p>
          <a href="#admission">Enquire now ↗</a>
        </article>

        <article class="course-card">
          <div class="course-icon icon-blue">🧬</div>
          <span class="course-tag">Competitive Exams</span>
          <h3>NEET Preparation</h3>
          <p>Develop subject understanding with structured learning and regular revision.</p>
          <a href="#admission">Enquire now ↗</a>
        </article>

        <article class="course-card">
          <div class="course-icon icon-yellow">📝</div>
          <span class="course-tag">Entrance Exam</span>
          <h3>MHT-CET</h3>
          <p>Practise important concepts and improve speed, accuracy, and confidence.</p>
          <a href="#admission">Enquire now ↗</a>
        </article>
      </div>
    </section>

    <!-- ABOUT -->
    <section id="about" class="section about-section">
      <div class="container about-grid">
        <div class="about-visual">
          <div class="about-illustration">
            <div class="book-stack">📚</div>
            <div class="lightbulb">💡</div>
            <div class="about-sticker">Learn • Practise • Grow</div>
          </div>
        </div>

        <div class="about-content">
          <span class="eyebrow">ABOUT US</span>
          <h2>Every Student Can <span>Excel.</span></h2>
          <p>
            Excellence Coaching Classes focuses on building clear concepts,
            developing disciplined study habits, and helping students work
            towards their academic goals.
          </p>

          <div class="feature-list">
            <div class="feature-item">
              <span>✓</span>
              <div><h4>Concept-Based Learning</h4><p>Understand the subject instead of simply memorising it.</p></div>
            </div>
            <div class="feature-item">
              <span>✓</span>
              <div><h4>Regular Practice</h4><p>Strengthen preparation through revision and practice questions.</p></div>
            </div>
            <div class="feature-item">
              <span>✓</span>
              <div><h4>Doubt-Solving Support</h4><p>Get help identifying and understanding difficult topics.</p></div>
            </div>
          </div>
          <a href="#admission" class="btn btn-primary">Start Your Journey ↗</a>
        </div>
      </div>
    </section>

    <!-- STUDY RESOURCES -->
    <section id="resources" class="section container">
      <div class="section-heading">
        <span class="eyebrow">STUDY SMARTER</span>
        <h2>Your Learning <span>Toolkit</span></h2>
        <p>Use these resources to support your preparation.</p>
      </div>

      <div class="resource-grid">
        <article class="resource-card">
          <span class="resource-icon">📒</span>
          <h3>Study Notes</h3>
          <p>Organise important concepts and revision material.</p>
          <a href="#admission">Ask for Notes ↗</a>
        </article>
        <article class="resource-card">
          <span class="resource-icon">✍️</span>
          <h3>Practice Questions</h3>
          <p>Test your understanding with topic-based practice.</p>
          <a href="#quiz">Try a Quick Quiz ↗</a>
        </article>
        <article class="resource-card">
          <span class="resource-icon">🗓️</span>
          <h3>Study Planning</h3>
          <p>Build a consistent schedule for learning and revision.</p>
          <a href="#admission">Get Guidance ↗</a>
        </article>
      </div>
    </section>

    <!-- QUIZ -->
    <section id="quiz" class="section quiz-section">
      <div class="container quiz-layout">
        <div class="quiz-intro">
          <span class="eyebrow">QUICK KNOWLEDGE CHECK</span>
          <h2>Ready to Test <span>Yourself?</span></h2>
          <p>Answer a few sample questions and practise your concepts.</p>
          <div class="quiz-benefit">⚡ Quick practice</div>
          <div class="quiz-benefit">🧠 Think through each answer</div>
          <div class="quiz-benefit">📈 Review your score at the end</div>
        </div>

        <div class="quiz-box">
          <div class="quiz-header">
            <span id="quiz-label">PRACTICE QUIZ</span>
            <span id="quiz-counter">Question 1 of 5</span>
          </div>
          <div class="quiz-progress"><span id="quiz-progress-bar"></span></div>
          <h3 id="question-text">Loading question...</h3>
          <div id="answer-options" class="answer-options"></div>
          <p id="quiz-feedback" class="quiz-feedback" aria-live="polite"></p>
          <div class="quiz-footer">
            <span id="quiz-score">Score: 0</span>
            <button id="next-question" class="btn btn-primary" type="button" disabled>Next Question →</button>
          </div>
          <div id="quiz-result" class="quiz-result" hidden>
            <h3>Quiz Completed! 🎉</h3>
            <p id="result-message"></p>
            <button id="restart-quiz" class="btn btn-primary" type="button">Try Again ↻</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ADMISSION FORM -->
    <section id="admission" class="section container">
      <div class="admission-grid">
        <div class="admission-content">
          <span class="eyebrow">ADMISSIONS OPEN</span>
          <h2>Take the First Step Towards <span>Excellence.</span></h2>
          <p>Share your details and the course you're interested in. Our team can contact you to discuss the next steps.</p>
          <div class="contact-detail"><span>📍</span><div><b>Location</b><p>Galle Borgaon, Maharashtra</p></div></div>
          <div class="contact-detail"><span>🎓</span><div><b>Courses</b><p>11th, 12th, JEE, NEET & MHT-CET</p></div></div>
          <div class="contact-detail"><span>💬</span><div><b>Have a question?</b><p>Submit the enquiry form to get started.</p></div></div>
        </div>

        <form id="admission-form" class="admission-form">
          <h3>Enquiry Form</h3>
          <p>Fill in your details below.</p>

          <label for="student-name">Student Name</label>
          <input id="student-name" name="studentName" type="text" placeholder="Enter your full name" required />

          <label for="student-phone">Mobile Number</label>
          <input id="student-phone" name="phone" type="tel" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile number" required />

          <label for="student-class">Class / Course</label>
          <select id="student-class" name="course" required>
            <option value="">Select your course</option>
            <option>Class 11th</option>
            <option>Class 12th</option>
            <option>JEE Preparation</option>
            <option>NEET Preparation</option>
            <option>MHT-CET Preparation</option>
          </select>

          <label for="student-message">Message (Optional)</label>
          <textarea id="student-message" name="message" rows="3" placeholder="Any question or preferred time to contact?"></textarea>

          <button type="submit" class="btn btn-primary form-submit">Submit Enquiry ↗</button>
          <p id="form-message" class="form-message" aria-live="polite"></p>
          <small>This demo form does not send or save your details to a server.</small>
        </form>
      </div>
    </section>

    <!-- CONTACT -->
    <section id="contact" class="contact-section">
      <div class="container contact-inner">
        <div>
          <span class="eyebrow">LET'S CONNECT</span>
          <h2>Have Questions? <span>Let's Talk.</span></h2>
          <p>Contact Excellence Coaching Classes for information about courses and admissions.</p>
        </div>
        <a href="#admission" class="btn btn-light">Enquire Now ↗</a>
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="#home" class="brand">
          <span class="brand-mark">E</span>
          <span class="brand-text">Excellence <small>COACHING CLASSES</small></span>
        </a>
        <p>Learn Today. Lead Tomorrow.</p>
      </div>
      <div>
        <h4>Explore</h4>
        <a href="#home">Home</a>
        <a href="#courses">Courses</a>
        <a href="#about">About Us</a>
      </div>
      <div>
        <h4>Student Zone</h4>
        <a href="#resources">Study Resources</a>
        <a href="#quiz">Practice Quiz</a>
        <a href="#admission">Admissions</a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="#admission">Enquiry Form</a>
        <a href="#contact">Contact Details</a>
        <p class="footer-location">Galle Borgaon, Maharashtra</p>
      </div>
    </div>
    <div class="container footer-bottom">
      <p>© <span id="current-year"></span> Excellence Coaching Classes. All rights reserved.</p>
      <a href="#home">Back to top ↑</a>
    </div>
  </footer>

  <script>
    // Sample quiz questions. Replace these with questions for your syllabus.
    const quizQuestions = [
      {
        question: "What is the value of 5 × 6?",
        options: ["11", "30", "56", "25"],
        answer: 1,
        explanation: "5 multiplied by 6 equals 30."
      },
      {
        question: "Which planet is known as the Red Planet?",
        options: ["Earth", "Venus", "Mars", "Jupiter"],
        answer: 2,
        explanation: "Mars is called the Red Planet because of iron oxide on its surface."
      },
      {
        question: "What is the chemical formula of water?",
        options: ["CO₂", "O₂", "H₂O", "NaCl"],
        answer: 2,
        explanation: "A water molecule contains two hydrogen atoms and one oxygen atom."
      },
      {
        question: "Which part of a plant usually absorbs water from the soil?",
        options: ["Flower", "Roots", "Leaves", "Fruit"],
        answer: 1,
        explanation: "Roots absorb water and minerals from the soil."
      },
      {
        question: "What is the unit of electric current?",
        options: ["Volt", "Watt", "Ohm", "Ampere"],
        answer: 3,
        explanation: "Electric current is measured in amperes."
      }
    ];

    let currentQuestion = 0;
    let score = 0;
    let answered = false;

    const questionText = document.getElementById("question-text");
    const answerOptions = document.getElementById("answer-options");
    const quizCounter = document.getElementById("quiz-counter");
    const quizScore = document.getElementById("quiz-score");
    const quizFeedback = document.getElementById("quiz-feedback");
    const quizProgressBar = document.getElementById("quiz-progress-bar");
    const nextQuestionButton = document.getElementById("next-question");
    const quizResult = document.getElementById("quiz-result");
    const resultMessage = document.getElementById("result-message");

    function renderQuestion() {
      const question = quizQuestions[currentQuestion];
      answered = false;

      questionText.textContent = question.question;
      quizCounter.textContent = `Question ${currentQuestion + 1} of ${quizQuestions.length}`;
      quizScore.textContent = `Score: ${score}`;
      quizProgressBar.style.width = `${(currentQuestion / quizQuestions.length) * 100}%`;
      quizFeedback.textContent = "";
      nextQuestionButton.disabled = true;
      nextQuestionButton.hidden = false;
      quizResult.hidden = true;
      answerOptions.innerHTML = "";

      question.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-option";
        button.textContent = option;
        button.addEventListener("click", () => selectAnswer(index));
        answerOptions.appendChild(button);
      });
    }

    function selectAnswer(selectedIndex) {
      if (answered) return;
      answered = true;

      const question = quizQuestions[currentQuestion];
      const buttons = answerOptions.querySelectorAll(".answer-option");

      buttons.forEach((button, index) => {
        button.disabled = true;
        if (index === question.answer) button.classList.add("correct");
        if (index === selectedIndex && selectedIndex !== question.answer) {
          button.classList.add("incorrect");
        }
      });

      if (selectedIndex === question.answer) {
        score++;
        quizFeedback.textContent = `Correct! ${question.explanation}`;
      } else {
        quizFeedback.textContent = `Not quite. ${question.explanation}`;
      }

      quizScore.textContent = `Score: ${score}`;
      nextQuestionButton.disabled = false;
      quizProgressBar.style.width = `${((currentQuestion + 1) / quizQuestions.length) * 100}%`;
    }

    function finishQuiz() {
      questionText.textContent = "You've completed the practice quiz!";
      answerOptions.innerHTML = "";
      quizFeedback.textContent = "";
      nextQuestionButton.hidden = true;
      quizResult.hidden = false;
      quizCounter.textContent = "Quiz completed";
      quizProgressBar.style.width = "100%";

      resultMessage.textContent =
        `You scored ${score} out of ${quizQuestions.length}. ` +
        (score === quizQuestions.length
          ? "Excellent work!"
          : score >= 3
          ? "Good effort! Keep practising."
          : "Keep learning and try again.");
    }

    nextQuestionButton.addEventListener("click", () => {
      if (!answered) return;

      if (currentQuestion < quizQuestions.length - 1) {
        currentQuestion++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    });

    document.getElementById("restart-quiz").addEventListener("click", () => {
      currentQuestion = 0;
      score = 0;
      renderQuestion();
    });

    // Demo-only form handling: validates the fields but does not send or store them.
    document.getElementById("admission-form").addEventListener("submit", (event) => {
      event.preventDefault();
      document.getElementById("form-message").textContent =
        "Thank you! This demo form is working, but it is not connected to a server yet.";
    });

    document.getElementById("current-year").textContent = new Date().getFullYear();

    renderQuestion();
  </script>
</body>
</html>');
});
module.exports = app;
