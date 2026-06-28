'use strict';

/**
 * Single-owner admin auth: one password (bcrypt hash in ADMIN_PASSWORD_HASH),
 * session cookie via express-session. Good enough for one operator behind HTTPS.
 */

const bcrypt = require('bcryptjs');

const HASH = process.env.ADMIN_PASSWORD_HASH || '';

/** Verify a plaintext password against the configured hash. */
function checkPassword(password) {
  if (!HASH) return false;
  try {
    return bcrypt.compareSync(String(password || ''), HASH);
  } catch {
    return false;
  }
}

/** Middleware: block non-authenticated access to admin routes. */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return res.redirect('/reservas/admin/login');
}

module.exports = { checkPassword, requireAuth, configured: Boolean(HASH) };
