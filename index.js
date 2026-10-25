'use strict';
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken'), crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const ADMIN_PAGE = require('./admin');
const E = process.env, PROD = E.NODE_ENV === 'production';

/* ---------- Centralised, replaceable demo info ---------- */
const INST = {
  name: 'Excellence Coaching Classes', tagline: 'Learn Today. Lead Tomorrow.',
  phone: '+91 90000 12345', email: 'excellence.classes@example.com',
  address: 'Main Road, Near Bus Stand, Galle Borgaon, Maharashtra, India',
  hours: 'Monday–Saturday, 7:00 AM–8:00 PM', session: '2026–2027'
};

/* ---------- Database (cached across serverless invocations) ---------- */
let cached;
async function db() {
  const miss = ['MONGODB_URI', 'MONGODB_DB', 'SESSION_SECRET'].filter(k => !E[k]);
  if (miss.length) throw Object.assign(new Error('Missing environment variables: ' + miss.join(', ')), { status: 503, expose: true });
  if (!cached) cached = (async () => {
    const c = await new MongoClient(E.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 }).connect();
    const d = c.db(E.MONGODB_DB);
    await Promise.all([
      d.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
      d.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true }),
      d.collection('enquiries').createIndex({ referenceNumber: 1 }, { unique: true }),
      d.collection('enquiries').createIndex({ status: 1, createdAt: -1 }),
      d.collection('courses').createIndex({ isPublished: 1 })
    ]);
    // Idempotent bootstrap: creates the first admin only if absent; never overwrites.
    if (E.ADMIN_EMAIL && E.ADMIN_PASSWORD) {
      const email = E.ADMIN_EMAIL.trim().toLowerCase();
      if (!(await d.collection('users').findOne({ email }))) {
        await d.collection('users').insertOne({
          fullName: 'Administrator', email, passwordHash: await bcrypt.hash(E.ADMIN_PASSWORD, 12),
          role: 'admin', isActive: true, createdAt: new Date(), updatedAt: new Date()
        });
      }
    }
    return d;
  })().catch(e => { cached = null; throw e; });
  return cached;
}

/* ---------- Helpers ---------- */
const h = f => (req, res, next) => f(req, res).catch(next);
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oid = v => (typeof v === 'string' && ObjectId.isValid(v) && String(new ObjectId(v)) === v ? new ObjectId(v) : null);
const normPhone = v => str(v, 20).replace(/[\s\-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
const validPhone = p => /^[6-9]\d{9}$/.test(p);
const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e);
const fail = (status, message, fields) => Object.assign(new Error(message), { status, expose: true, fields });
const esc = s => String(s ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const csvCell = v => { let s = v instanceof Date ? v.toISOString() : String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
const publicUser = u => ({ id: u._id, fullName: u.fullName, email: u.email, phone: u.phone, role: u.role });
const setCookie = (res, u) => res.cookie('sid', jwt.sign({ id: String(u._id), role: u.role }, E.SESSION_SECRET, { expiresIn: '7d' }), {
  httpOnly: true, secure: PROD, sameSite: 'strict', maxAge: 7 * 864e5, path: '/'
});

function pickCourse(b) {
  const o = {};
  const title = str(b.title, 120), description = str(b.description, 600);
  if (!title) throw fail(400, 'Title is required', { title: 'Required' });
  o.title = title; o.description = description;
  o.subjects = (Array.isArray(b.subjects) ? b.subjects : str(b.subjects, 300).split(',')).map(x => str(x, 40)).filter(Boolean).slice(0, 10);
  o.targetClass = str(b.targetClass, 60); o.duration = str(b.duration, 60);
  const fee = Number(b.fee); o.fee = Number.isFinite(fee) && fee >= 0 && fee < 1e7 ? fee : 0;
  const img = str(b.imageUrl, 500); o.imageUrl = /^https:\/\//.test(img) ? img : '';
  o.isPublished = b.isPublished === true || b.isPublished === 'true';
  return o;
}

/* ---------- App & security middleware ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => { res.locals.nonce = crypto.randomBytes(16).toString('base64'); next(); });
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", (q, r) => "'nonce-" + r.locals.nonce + "'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'https:'], connectSrc: ["'self'"], frameSrc: ['https://www.google.com'], objectSrc: ["'none'"], frameAncestors: ["'none'"]
  } }
}));
app.use(express.json({ limit: '20kb' }));
// CSRF: SameSite=Strict cookie + custom header required on state-changing requests (cannot be sent by cross-site forms).
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'fetch') return res.status(403).json({ error: 'Invalid request' });
  next();
});
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const lim = (max, mins) => rateLimit({ windowMs: mins * 60000, max, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again later.' } });
const authLimit = lim(10, 15), formLimit = lim(10, 60);

const auth = role => h(async (req, res) => {
  const tok = (req.get('cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith('sid='));
  let p; try { p = jwt.verify(decodeURIComponent((tok || '').slice(4)), E.SESSION_SECRET); } catch { throw fail(401, 'Authentication required'); }
  const d = await db(); const u = await d.collection('users').findOne({ _id: oid(p.id) }, { projection: { passwordHash: 0 } });
  if (!u || !u.isActive) throw fail(401, 'Authentication required');
  if (role && u.role !== role) throw fail(403, 'Forbidden');
  req.user = u;
});
const guard = role => (req, res, next) => auth(role)(req, res, next);

/* ---------- Public API ---------- */
app.get('/api/health', h(async (req, res) => { await (await db()).command({ ping: 1 }); res.json({ ok: true }); }));
app.get('/api/config', (req, res) => res.json(INST));
app.get('/api/courses', h(async (req, res) => {
  const d = await db();
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await d.collection('courses').find({ isPublished: true }).sort({ title: 1 }).limit(50).toArray());
}));

app.post('/api/enquiries', formLimit, h(async (req, res) => {
  const b = req.body || {}, f = {};
  const studentName = str(b.studentName, 100), parentName = str(b.parentName, 100), phone = normPhone(b.phone);
  const email = str(b.email, 200).toLowerCase(), currentClass = str(b.currentClass, 40);
  if (studentName.length < 2) f.studentName = 'Enter the student name';
  if (parentName.length < 2) f.parentName = 'Enter the parent or guardian name';
  if (!validPhone(phone)) f.phone = 'Enter a valid 10-digit Indian mobile number';
  if (email && !validEmail(email)) f.email = 'Enter a valid email';
  if (!currentClass) f.currentClass = 'Select the current class';
  if (b.consent !== true) f.consent = 'Consent is required';
  let courseId = null;
  if (b.courseId) { courseId = oid(b.courseId); if (!courseId) f.courseId = 'Invalid course'; }
  if (Object.keys(f).length) throw fail(400, 'Please correct the highlighted fields', f);
  const d = await db();
  if (courseId && !(await d.collection('courses').findOne({ _id: courseId, isPublished: true }, { projection: { _id: 1 } }))) throw fail(400, 'Invalid course', { courseId: 'Course not available' });
  const referenceNumber = 'EXC-' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
  const now = new Date();
  await d.collection('enquiries').insertOne({ referenceNumber, studentName, parentName, phone, email, currentClass, courseId,
    preferredBatch: str(b.preferredBatch, 60), message: str(b.message, 1000), status: 'new', internalNotes: '', followUpAt: null, createdAt: now, updatedAt: now });
  res.status(201).json({ referenceNumber });
}));

/* ---------- Student auth ---------- */
app.post('/api/auth/register', authLimit, h(async (req, res) => {
  const b = req.body || {}, fullName = str(b.fullName, 100), email = str(b.email, 200).toLowerCase(), phone = normPhone(b.phone), pw = typeof b.password === 'string' ? b.password : '';
  const f = {};
  if (fullName.length < 2) f.fullName = 'Enter your name';
  if (!email && !phone) f.email = 'Email or mobile number is required';
  if (email && !validEmail(email)) f.email = 'Invalid email';
  if (phone && !validPhone(phone)) f.phone = 'Invalid mobile number';
  if (pw.length < 8 || pw.length > 72) f.password = 'Use 8–72 characters';
  if (Object.keys(f).length) throw fail(400, 'Please correct the highlighted fields', f);
  const doc = { fullName, role: 'student', isActive: true, passwordHash: await bcrypt.hash(pw, 12), createdAt: new Date(), updatedAt: new Date() };
  if (email) doc.email = email; if (phone) doc.phone = phone;
  const d = await db();
  try { const r = await d.collection('users').insertOne(doc); doc._id = r.insertedId; }
  catch (e) { if (e.code === 11000) throw fail(409, 'Unable to register with these details. Try signing in instead.'); throw e; }
  setCookie(res, doc); res.status(201).json({ user: publicUser(doc) });
}));
async function login(req, res, role) {
  const b = req.body || {}, id = str(b.identifier, 200).toLowerCase(), pw = typeof b.password === 'string' ? b.password : '';
  const d = await db();
  const u = await d.collection('users').findOne({ $or: [{ email: id }, { phone: normPhone(id) }], ...(role ? { role } : {}) });
  const ok = u && u.isActive && await bcrypt.compare(pw, u.passwordHash);
  if (!ok) throw fail(401, 'Invalid credentials');
  setCookie(res, u); res.json({ user: publicUser(u) });
}
app.post('/api/auth/login', authLimit, h((req, res) => login(req, res, 'student')));
app.post('/api/admin/login', authLimit, h((req, res) => login(req, res, 'admin')));
const logout = (req, res) => { res.clearCookie('sid', { path: '/' }); res.json({ ok: true }); };
app.post('/api/auth/logout', logout); app.post('/api/admin/logout', logout);
app.get('/api/auth/me', guard(), (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/admin/me', guard('admin'), (req, res) => res.json({ user: publicUser(req.user) }));

/* ---------- Admin API ---------- */
app.get('/api/admin/dashboard', guard('admin'), h(async (req, res) => {
  const d = await db(), c = n => d.collection(n);
  const [students, newEnq, pending, courses, recent] = await Promise.all([
    c('users').countDocuments({ role: 'student' }), c('enquiries').countDocuments({ status: 'new' }),
    c('enquiries').countDocuments({ status: { $in: ['new', 'contacted'] } }), c('courses').countDocuments({ isPublished: true }),
    c('enquiries').find({}, { projection: { studentName: 1, referenceNumber: 1, status: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(5).toArray()
  ]);
  res.json({ students, newEnquiries: newEnq, pendingApplications: pending, publishedCourses: courses, recentEnquiries: recent });
}));

app.get('/api/admin/enquiries', guard('admin'), h(async (req, res) => {
  const d = await db(), page = Math.max(1, parseInt(req.query.page) || 1), q = str(req.query.q, 60), status = str(req.query.status, 20);
  const filter = {};
  if (['new', 'contacted', 'admitted', 'closed'].includes(status)) filter.status = status;
  if (q) { const r = new RegExp(esc(q), 'i'); filter.$or = [{ studentName: r }, { phone: r }, { referenceNumber: r }]; }
  const [items, total] = await Promise.all([
    d.collection('enquiries').find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).toArray(),
    d.collection('enquiries').countDocuments(filter)]);
  res.json({ items, total, page, pages: Math.ceil(total / 20) });
}));
app.patch('/api/admin/enquiries/:id', guard('admin'), h(async (req, res) => {
  const id = oid(req.params.id); if (!id) throw fail(400, 'Invalid id');
  const b = req.body || {}, set = { updatedAt: new Date() };
  if (b.status !== undefined) { if (!['new', 'contacted', 'admitted', 'closed'].includes(b.status)) throw fail(400, 'Invalid status'); set.status = b.status; }
  if (b.internalNotes !== undefined) set.internalNotes = str(b.internalNotes, 2000);
  if (b.followUpAt !== undefined) { const t = b.followUpAt ? new Date(b.followUpAt) : null; if (t && isNaN(t)) throw fail(400, 'Invalid date'); set.followUpAt = t; }
  const r = await (await db()).collection('enquiries').findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: 'after' });
  if (!r) throw fail(404, 'Not found'); res.json(r);
}));

app.get('/api/admin/courses', guard('admin'), h(async (req, res) => res.json(await (await db()).collection('courses').find({}).sort({ createdAt: -1 }).limit(100).toArray())));
app.post('/api/admin/courses', guard('admin'), h(async (req, res) => {
  const doc = { ...pickCourse(req.body || {}), createdAt: new Date(), updatedAt: new Date() };
  doc._id = (await (await db()).collection('courses').insertOne(doc)).insertedId; res.status(201).json(doc);
}));
app.patch('/api/admin/courses/:id', guard('admin'), h(async (req, res) => {
  const id = oid(req.params.id); if (!id) throw fail(400, 'Invalid id');
  const r = await (await db()).collection('courses').findOneAndUpdate({ _id: id }, { $set: { ...pickCourse(req.body || {}), updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!r) throw fail(404, 'Not found'); res.json(r);
}));
app.delete('/api/admin/courses/:id', guard('admin'), h(async (req, res) => {
  const id = oid(req.params.id); if (!id) throw fail(400, 'Invalid id'); const d = await db();
  if (await d.collection('enquiries').countDocuments({ courseId: id }, { limit: 1 })) throw fail(409, 'Course has linked enquiries. Unpublish it instead.');
  const r = await d.collection('courses').deleteOne({ _id: id }); if (!r.deletedCount) throw fail(404, 'Not found'); res.json({ ok: true });
}));
app.get('/api/admin/export/enquiries', guard('admin'), h(async (req, res) => {
  const rows = await (await db()).collection('enquiries').find({}).sort({ createdAt: -1 }).limit(5000).toArray();
  const cols = ['referenceNumber', 'studentName', 'parentName', 'phone', 'email', 'currentClass', 'preferredBatch', 'status', 'internalNotes', 'createdAt'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="enquiries.csv"' });
  res.send(cols.join(',') + '\n' + rows.map(r => cols.map(c => csvCell(r[c])).join(',')).join('\n'));
}));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ---------- Pages ---------- */
const page = (res, html) => res.set('Cache-Control', 'no-store').type('html').send(html.replace(/__N__/g, res.locals.nonce));
app.get('/admin', (req, res) => page(res, ADMIN_PAGE));
app.get('/', (req, res) => page(res, PUBLIC.replace('__INST__', JSON.stringify(INST).replace(/</g, '\\u003c'))));
app.use((req, res) => res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font-family:sans-serif;text-align:center;padding:4rem"><h1>404</h1><p>Page not found.</p><a href="/">Back to home</a>'));
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('Server error:', err.message);
  res.status(status).json({ error: err.expose ? err.message : 'Something went wrong', fields: err.fields });
});

/* ---------- Public page (inline CSS + JS) ---------- */
const PUBLIC = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Excellence Coaching Classes – Galle Borgaon</title>
<meta name="description" content="Coaching for Class 11, 12, MHT-CET, JEE and NEET aspirants in Galle Borgaon, Maharashtra.">
<meta property="og:title" content="Excellence Coaching Classes"><meta property="og:description" content="Learn Today. Lead Tomorrow.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' rx='2' fill='%23A78BFA'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>
:root{--lav:#A78BFA;--sky:#60A5FA;--mint:#6EE7B7;--coral:#FB7185;--sun:#FCD34D;--navy:#202A44;--bg:#F7F5FF}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Nunito,system-ui,sans-serif;background:var(--bg);color:var(--navy);overflow-x:hidden}
.clay{background:linear-gradient(145deg,#fff,#efeaff);border-radius:28px;box-shadow:12px 12px 24px rgba(167,139,250,.25),-8px -8px 18px #fff,inset 3px 3px 8px #fff,inset -4px -4px 10px rgba(167,139,250,.15)}
.btn{border:0;border-radius:999px;padding:.8rem 1.5rem;font:800 1rem Nunito,sans-serif;color:#fff;cursor:pointer;background:linear-gradient(145deg,#b9a3ff,#8b6cf0);box-shadow:6px 6px 14px rgba(139,108,240,.4),inset 2px 2px 6px rgba(255,255,255,.5);transition:transform .15s,box-shadow .15s;text-decoration:none;display:inline-block}
.btn:hover{transform:translateY(-2px)}.btn:active{transform:translateY(2px);box-shadow:2px 2px 6px rgba(139,108,240,.4)}.btn.alt{background:linear-gradient(145deg,#ff9fb0,#fb7185)}.btn:disabled{opacity:.6;cursor:wait}
:focus-visible{outline:3px solid var(--navy);outline-offset:2px}
header{position:sticky;top:0;z-index:10;margin:.7rem;padding:.6rem 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem}
header b{font-size:1.1rem}nav{display:flex;gap:1.2rem;align-items:center}nav a{color:var(--navy);text-decoration:none;font-weight:700}nav a:hover{color:var(--lav)}
#burger{display:none;background:none;border:0;font-size:1.6rem;cursor:pointer}
section{max-width:1100px;margin:0 auto;padding:3rem 1.2rem}
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:2rem;align-items:center}.hero h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.1;margin:.2rem 0}
.blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.5;animation:fl 8s ease-in-out infinite;z-index:-1}
@keyframes fl{50%{transform:translateY(-20px)}}
.chips{display:grid;gap:1rem}.chips div{padding:1.1rem 1.4rem;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.4rem}.card{padding:1.4rem;transition:transform .2s}.card:hover{transform:translateY(-6px)}
.tag{display:inline-block;background:var(--sun);border-radius:999px;padding:.15rem .7rem;font-size:.8rem;font-weight:800;margin:.1rem}
form{padding:1.6rem;display:grid;gap:.9rem}label{font-weight:800;display:grid;gap:.3rem}
input,select,textarea{font:inherit;padding:.7rem 1rem;border:2px solid transparent;border-radius:16px;background:#f3f0ff;box-shadow:inset 3px 3px 7px rgba(167,139,250,.25),inset -3px -3px 7px #fff;width:100%}
.err{color:#be123c;font-size:.85rem;min-height:1em}.note{font-size:.85rem;opacity:.8}
.rev{opacity:0;transform:translateY(24px);transition:.6s}.rev.in{opacity:1;transform:none}
#toast{position:fixed;bottom:1rem;left:50%;transform:translateX(-50%);padding:1rem 1.4rem;z-index:50;max-width:90%;display:none}
footer{text-align:center;padding:2rem 1rem}
@media(max-width:760px){.hero{grid-template-columns:1fr}#burger{display:block}nav{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;padding:1rem;background:#fff;border-radius:24px;margin-top:.5rem}nav.open{display:flex}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}.rev{opacity:1;transform:none}}
</style></head><body>
<header class="clay"><b>🎓 Excellence Coaching Classes</b>
<button id="burger" aria-label="Toggle menu" aria-expanded="false">☰</button>
<nav id="nav"><a href="#home">Home</a><a href="#about">About</a><a href="#courses">Courses</a><a href="#faculty">Faculty</a><a href="#contact">Contact</a><a class="btn alt" href="#enquire">Enquire Now</a></nav></header>
<main>
<section id="home" class="hero" style="position:relative"><div class="blob" style="background:var(--lav);width:240px;height:240px;top:0;left:-60px"></div><div class="blob" style="background:var(--mint);width:200px;height:200px;bottom:0;right:0"></div>
<div><span class="tag">Session 2026–2027</span><h1>Your Journey to Academic Excellence Starts Here.</h1>
<p>Structured guidance for Class 11, Class 12, MHT-CET, JEE and NEET aspirants in Galle Borgaon — with regular practice, revision and doubt-solving.</p>
<a class="btn" href="#courses">Explore Courses</a> <a class="btn alt" href="#enquire">Apply for Admission</a></div>
<div class="chips"><div class="clay">🧑‍🏫 Expert guidance</div><div class="clay">📝 Practice tests</div><div class="clay">📚 Structured learning</div></div></section>
<section id="about"><h2>About the institute</h2><div class="grid">
<div class="clay card rev"><h3>🎯 Teaching philosophy</h3><p>Concept clarity first, speed and accuracy next.</p></div>
<div class="clay card rev"><h3>🔁 Practice &amp; revision</h3><p>Regular tests and revision cycles for every batch.</p></div>
<div class="clay card rev"><h3>💬 Doubt solving</h3><p>Dedicated sessions to resolve questions.</p></div>
<div class="clay card rev"><h3>🧭 Career guidance</h3><p>Examination and stream guidance for students and parents.</p></div></div></section>
<section id="courses"><h2>Courses &amp; programs</h2><p class="note">Fees shown are indicative only.</p><div id="courseGrid" class="grid"><div class="clay card">Loading courses…</div></div></section>
<section id="faculty"><h2>Faculty</h2><p class="note">Sample demonstration profiles — replace with verified faculty details.</p><div class="grid">
<div class="clay card rev"><h3>Sample Instructor A</h3><span class="tag">Physics</span><p>Placeholder qualification. Short teaching introduction goes here.</p></div>
<div class="clay card rev"><h3>Sample Instructor B</h3><span class="tag">Chemistry</span><p>Placeholder qualification. Short teaching introduction goes here.</p></div>
<div class="clay card rev"><h3>Sample Instructor C</h3><span class="tag">Mathematics / Biology</span><p>Placeholder qualification. Short teaching introduction goes here.</p></div></div></section>
<section id="enquire"><h2>Admission enquiry</h2>
<form id="enqForm" class="clay" novalidate>
<label>Student full name<input name="studentName" required autocomplete="name"><span class="err" data-f="studentName"></span></label>
<label>Parent / guardian name<input name="parentName" required><span class="err" data-f="parentName"></span></label>
<label>Mobile number<input name="phone" inputmode="tel" required placeholder="10-digit number"><span class="err" data-f="phone"></span></label>
<label>Email (optional)<input name="email" type="email"><span class="err" data-f="email"></span></label>
<label>Current class<select name="currentClass" required><option value="">Select</option><option>10th</option><option>11th</option><option>12th</option><option>Repeater</option></select><span class="err" data-f="currentClass"></span></label>
<label>Desired course<select name="courseId" id="courseSel"><option value="">Not sure yet</option></select><span class="err" data-f="courseId"></span></label>
<label>Preferred batch<select name="preferredBatch"><option value="">No preference</option><option>Morning</option><option>Evening</option></select></label>
<label>Message<textarea name="message" rows="3" maxlength="1000"></textarea></label>
<label style="display:flex;gap:.6rem;align-items:flex-start"><input type="checkbox" name="consent" style="width:auto"><span>I consent to the institute collecting and using this information to respond to my admission enquiry.</span></label><span class="err" data-f="consent"></span>
<p class="note">Privacy: details are used only to contact you about admissions and are visible to institute staff.</p>
<button class="btn" id="enqBtn">Submit enquiry</button></form></section>
<section id="contact"><h2>Contact</h2><div class="clay card" id="contactCard"></div></section>
</main><footer class="note">Demonstration content. Sample address, faculty, and fees are placeholders.</footer>
<div id="toast" class="clay" role="status" aria-live="polite"></div>
<script nonce="__N__">
const INST=__INST__;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>t.style.display='none',5000)}
$('#burger').onclick=function(){const o=$('#nav').classList.toggle('open');this.setAttribute('aria-expanded',o)};
$('#nav').onclick=e=>{if(e.target.tagName==='A')$('#nav').classList.remove('open')};
$('#contactCard').innerHTML='<p>📍 '+esc(INST.address)+'</p><p>🕒 '+esc(INST.hours)+'</p><p>📞 <a href="tel:'+esc(INST.phone.replace(/\\s/g,''))+'">'+esc(INST.phone)+'</a></p><p>✉️ <a href="mailto:'+esc(INST.email)+'">'+esc(INST.email)+'</a></p><p>💬 <a href="https://wa.me/'+esc(INST.phone.replace(/\\D/g,''))+'">WhatsApp us</a></p><p class="note">Sample address, not verified.</p>';
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.1});
function watch(){document.querySelectorAll('.rev:not(.in)').forEach(n=>io.observe(n))}watch();
fetch('/api/courses').then(r=>r.ok?r.json():Promise.reject()).then(cs=>{
  $('#courseGrid').innerHTML=cs.length?cs.map(c=>'<article class="clay card rev"><h3>'+esc(c.title)+'</h3><p>'+esc(c.description)+'</p>'+(c.subjects||[]).map(s=>'<span class="tag">'+esc(s)+'</span>').join('')+'<p class="note">'+esc(c.targetClass)+(c.duration?' · '+esc(c.duration):'')+'</p><p><b>₹'+Number(c.fee||0).toLocaleString('en-IN')+'</b> <span class="note">(indicative)</span></p><a class="btn alt" href="#enquire" data-c="'+esc(c._id)+'">Enquire Now</a></article>').join(''):'<div class="clay card">No courses published yet.</div>';
  $('#courseSel').innerHTML+=cs.map(c=>'<option value="'+esc(c._id)+'">'+esc(c.title)+'</option>').join('');watch();
}).catch(()=>{$('#courseGrid').innerHTML='<div class="clay card">Courses are unavailable right now.</div>'});
$('#courseGrid').onclick=e=>{const c=e.target.dataset&&e.target.dataset.c;if(c)$('#courseSel').value=c};
$('#enqForm').onsubmit=async e=>{
  e.preventDefault();const f=e.target,b=$('#enqBtn');
  document.querySelectorAll('.err').forEach(x=>x.textContent='');
  const body=Object.fromEntries(new FormData(f));body.consent=f.consent.checked;
  b.disabled=true;b.textContent='Submitting…';
  try{
    const r=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'fetch'},body:JSON.stringify(body)});
    const j=await r.json();
    if(!r.ok){Object.entries(j.fields||{}).forEach(([k,v])=>{const s=document.querySelector('[data-f="'+k+'"]');if(s)s.textContent=v});toast(j.error||'Submission failed');}
    else{toast('Enquiry saved. Your reference: '+j.referenceNumber);f.reset()}
  }catch(x){toast('Network error. Please try again.')}
  b.disabled=false;b.textContent='Submit enquiry';
};
</script></body></html>`;

module.exports = app;
if (require.main === module) app.listen(E.PORT || 3000, () => console.log('Listening locally'));
