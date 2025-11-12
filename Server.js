// server.js
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ====== CONFIG - عدّل هذه القيم قبل التشغيل ======
const JWT_SECRET = process.env.JWT_SECRET || 'replace_with_a_strong_secret';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER || 'liumexcode@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'your_smtp_app_password';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'liumexcode@gmail.com';

// المحفظة التي يستقبل عليها الدفع (ضع هنا عنوانك)
const CRYPTO_CURRENCY = process.env.CRYPTO_CURRENCY || 'USDT-TRC20';
const CRYPTO_ADDRESS = process.env.CRYPTO_ADDRESS || 'ضع_عنوان_المحفظة_هنا';
// ==================================================

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

// ====== DB setup ======
const db = new sqlite3.Database('./db.sqlite');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    passwordHash TEXT,
    balance REAL DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT,
    price REAL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    serviceId INTEGER,
    details TEXT,
    price REAL,
    txid TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  // seed services if empty
  db.get("SELECT COUNT(*) as c FROM services", (e, r) => {
    if (!r || r.c === 0) {
      const ins = db.prepare("INSERT INTO services (slug,title,price) VALUES (?,?,?)");
      ins.run('samsung','فتح أجهزة سامسونج',16.00);
      ins.run('honor','إزالة FRP لهواتف هونر',10.00);
      ins.run('icloud','فتح iCloud',15.00);
      ins.run('support','الدعم الفني',0.00);
      ins.finalize();
    }
  });
});

// ====== helper auth ======
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ====== API - Auth ======
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  const hash = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username,email,passwordHash) VALUES (?,?,?)`, [username, email||'', hash], function(err) {
    if (err) return res.status(400).json({ error: 'User exists or DB error' });
    const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [username, username], async (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, balance: row.balance });
  });
});

// جلب الخدمات
app.get('/api/services', (req, res) => {
  db.all(`SELECT * FROM services ORDER BY id`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// انشاء طلب + إرسال إيميل للمدير + إظهار بيانات الدفع (QR)
// هذا المسار يقوم بتخزين الطلب ويعطي العميل تفاصيل الدفع (عنوان المحفظة، قيمة)
app.post('/api/create-order', authMiddleware, async (req, res) => {
  const { serviceId, details } = req.body;
  if (!serviceId) return res.status(400).json({ error: 'Missing serviceId' });

  db.get(`SELECT * FROM services WHERE id = ?`, [serviceId], (err, service) => {
    if (err || !service) return res.status(400).json({ error: 'Service not found' });

    // price from service
    const price = service.price;

    // insert order with txid null for now
    const stmt = db.prepare("INSERT INTO orders (userId,serviceId,details,price,status) VALUES (?,?,?,?, 'pending')");
    stmt.run([req.user.id, serviceId, JSON.stringify(details||{}), price], function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      const orderId = this.lastID;

      // send email to admin with order summary (txid pending)
      const mailOptions = {
        from: `"Liumex" <${SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: `طلب جديد #${orderId} — ${service.title}`,
        text: `يوجد طلب جديد\n\nOrder ID: ${orderId}\nService: ${service.title}\nPrice: ${price}\nDetails: ${JSON.stringify(details||{})}\nStatus: pending\n\nPayment: ${CRYPTO_CURRENCY} to ${CRYPTO_ADDRESS}`
      };
      transporter.sendMail(mailOptions, (mErr, info) => {
        if (mErr) console.error('Mail error:', mErr);
      });

      // generate a crypto payment URI (simple) and QR
      const payUri = `${CRYPTO_CURRENCY}:${CRYPTO_ADDRESS}?amount=${price}`;
      // for QR we can encode payUri (some wallets understand it), else encode address only
      QRCode.toDataURL(payUri).then(qrData => {
        res.json({
          orderId,
          price,
          currency: CRYPTO_CURRENCY,
          address: CRYPTO_ADDRESS,
          payUri,
          qrData
        });
      }).catch(e => {
        res.json({
          orderId,
          price,
          currency: CRYPTO_CURRENCY,
          address: CRYPTO_ADDRESS,
          payUri,
          qrData: null
        });
      });
    });
    stmt.finalize();
  });
});

// العميل يؤكد الدفع بوضع TXID
app.post('/api/confirm-payment', authMiddleware, (req, res) => {
  const { orderId, txid } = req.body;
  if (!orderId || !txid) return res.status(400).json({ error: 'Missing fields' });

  // update order with txid and keep pending, admin will verify
  db.run(`UPDATE orders SET txid = ?, status = 'pending' WHERE id = ? AND userId = ?`, [txid, orderId, req.user.id], function(err) {
    if (err || this.changes === 0) return res.status(500).json({ error: 'Order not found or DB error' });

    // notify admin about txid
    const mailOptions = {
      from: `"Liumex" <${SMTP_USER}>`,
      to: ADMIN_EMAIL,
      subject: `تأكيد دفع — Order #${orderId}`,
      text: `تم تأكيد الدفع للطلب #${orderId}\nTXID: ${txid}\nالرجاء التحقق من الشبكة وتحديث حالة الطلب.`
    };
    transporter.sendMail(mailOptions, (mErr, info) => {
      if (mErr) console.error('Mail error:', mErr);
    });

    res.json({ success: true, message: 'تم إضافة TXID — سيقوم المشرف بالتحقق قريبا.' });
  });
});

// جلب طلبات المستخدم
app.get('/api/my-orders', authMiddleware, (req, res) => {
  db.all(`SELECT o.*, s.title as serviceTitle FROM orders o LEFT JOIN services s ON s.id=o.serviceId WHERE o.userId = ? ORDER BY o.created_at DESC`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// لوحة ادمين بسيطة (حماية بسيطة عبر TOKEN ADMIN) - for demo only
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admintoken123';
app.get('/api/admin/orders', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  db.all(`SELECT o.*, s.title as serviceTitle, u.username, u.email FROM orders o
          LEFT JOIN services s ON s.id=o.serviceId
          LEFT JOIN users u ON u.id=o.userId
          ORDER BY o.created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// admin update order status
app.post('/api/admin/update-order', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  const { orderId, status } = req.body;
  if (!orderId || !status) return res.status(400).json({ error: 'Missing fields' });
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ success: true });
  });
});

// serve front
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));
