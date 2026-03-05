require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');
const helmet = require('helmet');
const path = require('path');
const db = require('./src/db');
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

app.use(session({
  store: new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 900000 }
  }),
  secret: process.env.SESSION_SECRET,
  name: 'polaris.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(cookieParser(process.env.SESSION_SECRET));

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.session && req.session.id,
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
  },
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

// CSRF token endpoint (GET — not protected)
app.get('/api/auth/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// Apply CSRF protection to all non-GET/HEAD/OPTIONS requests
app.use(doubleCsrfProtection);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Polaris One running on http://localhost:${PORT}`);
});
