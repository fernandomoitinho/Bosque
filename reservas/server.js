'use strict';

/**
 * Bosque Reservas — Express entry point.
 *
 * Serves:
 *   - the existing static Bosque site at /            (repo root, ../)
 *   - the booking UI + APIs at /reservas
 *   - the owner dashboard at /reservas/admin
 *
 * Run: `npm start` (after `npm install` and copying .env.example -> .env).
 */

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const calendar = require('./src/calendar');
const mailer = require('./src/mailer');
const { configured: authConfigured } = require('./src/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const REPO_ROOT = path.join(__dirname, '..');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'bosque-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8h
    },
  })
);

// Static assets for the booking/admin/quote front-ends.
app.use('/reservas/assets', express.static(path.join(__dirname, 'public')));

// Routers (admin before public so /reservas/admin/* resolves first).
app.use('/reservas/admin', adminRoutes);
app.use('/reservas', publicRoutes);

// Guard: never let the static root serve the app's own source (reservas/*.js,
// .env, db, etc.). Anything under /reservas not handled above is a 404.
app.use('/reservas', (_req, res) => res.status(404).send('Not found'));

// Existing static Bosque site (index.html, css/, segment pages, images...).
app.use(express.static(REPO_ROOT, { extensions: ['html'] }));

app.use((_req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`\n  Bosque Reservas a correr em http://localhost:${PORT}`);
  console.log(`  • Site:    http://localhost:${PORT}/`);
  console.log(`  • Reservas: http://localhost:${PORT}/reservas`);
  console.log(`  • Painel:  http://localhost:${PORT}/reservas/admin`);
  const flags = [];
  if (calendar.DRY_RUN) flags.push('Calendar=DRY_RUN');
  if (mailer.DRY_RUN) flags.push('Email=DRY_RUN');
  if (!authConfigured) flags.push('ADMIN_PASSWORD_HASH não definido (login bloqueado)');
  if (flags.length) console.log(`  ⚠  ${flags.join('  |  ')}`);
  console.log('');
});

module.exports = app;
