const express = require('express');
const argon2 = require('argon2');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { sendVerificationEmail } = require('../email');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many accounts created. Please try again later.' }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function validatePasswordComplexity(password) {
  const errors = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('a special character');
  return errors;
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const complexityErrors = validatePasswordComplexity(password);
    if (complexityErrors.length > 0) {
      return res.status(400).json({
        error: 'Password must contain ' + complexityErrors.join(', ') + '.'
      });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const verificationToken = generateVerificationToken();
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = db.prepare(
      `INSERT INTO users (first_name, last_name, email, password_hash, email_verified, verification_token, verification_expires)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).run(firstName.trim(), lastName.trim(), email.toLowerCase().trim(), passwordHash, tokenHash, expires);

    req.session.userId = result.lastInsertRowid;

    // Send verification email (don't block signup on failure)
    sendVerificationEmail(email.toLowerCase().trim(), verificationToken, getBaseUrl(req))
      .catch(err => console.error('Failed to send verification email:', err));

    req.session.save(() => {
      res.status(201).json({
        user: {
          id: result.lastInsertRowid,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          emailVerified: false
        }
      });
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account lockout
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockedUntil - new Date()) / 60000);
        return res.status(423).json({
          error: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
        });
      }
      // Lockout expired — reset
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
        return res.status(423).json({
          error: `Account locked due to too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`
        });
      }
      db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Successful login — reset lockout counters
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    req.session.userId = user.id;
    req.session.save(() => {
      res.json({
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          emailVerified: !!user.email_verified
        }
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('polaris.sid');
    res.json({ message: 'Logged out' });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ user: null });
  }

  const user = db.prepare('SELECT id, first_name, last_name, email, email_verified FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ user: null });
  }

  res.json({
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      emailVerified: !!user.email_verified
    }
  });
});

// Email verification
router.get('/verify', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = db.prepare('SELECT id, verification_expires FROM users WHERE verification_token = ?').get(tokenHash);

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired verification link.' });
  }

  if (new Date(user.verification_expires) < new Date()) {
    return res.status(400).json({ error: 'Verification link has expired. Please request a new one.' });
  }

  db.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?').run(user.id);
  res.json({ message: 'Email verified successfully.' });
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const user = db.prepare('SELECT id, email, email_verified FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  if (user.email_verified) {
    return res.json({ message: 'Email is already verified.' });
  }

  const verificationToken = generateVerificationToken();
  const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare('UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?').run(tokenHash, expires, user.id);

  try {
    await sendVerificationEmail(user.email, verificationToken, getBaseUrl(req));
    res.json({ message: 'Verification email sent. Check your inbox.' });
  } catch (err) {
    console.error('Failed to resend verification email:', err);
    res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
});

module.exports = router;
