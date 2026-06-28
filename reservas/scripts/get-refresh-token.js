#!/usr/bin/env node
'use strict';

/**
 * One-time helper to obtain a Google OAuth2 refresh token for the Calendar API.
 *
 * Prereqs (see README):
 *   1. In Google Cloud Console, enable the Google Calendar API.
 *   2. Create an OAuth client of type "Desktop app".
 *   3. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.
 *
 * Run: npm run token
 * It prints a URL — open it, authorize, paste the code back. The printed
 * refresh token goes into GOOGLE_REFRESH_TOKEN in .env.
 */

require('dotenv').config();
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
console.log('\n1. Open this URL and authorize:\n\n' + url + '\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('2. Paste the authorization code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error('\nNo refresh token returned. Revoke access at https://myaccount.google.com/permissions and retry.');
      process.exit(1);
    }
    console.log('\nGOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
    console.log('Paste that line into your .env.');
  } catch (err) {
    console.error('Failed to exchange code:', err.message);
    process.exit(1);
  }
});
