#!/usr/bin/env node
'use strict';

/**
 * Generate a bcrypt hash for the admin password.
 * Usage: node scripts/hash-password.js "your-password"
 * Paste the output into ADMIN_PASSWORD_HASH in .env.
 */

const bcrypt = require('bcryptjs');

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.js "your-password"');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 10));
