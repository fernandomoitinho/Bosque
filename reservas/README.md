# Bosque Reservas

Reservation + quoting system for the Bosque website. A small, self-contained
Node.js app that:

- serves the existing static Bosque site at `/`;
- offers a **live booking flow** at `/reservas` where customers pick a segment,
  date and a slot that is **actually free** (checked against Google Calendar);
- sends an **automatic acknowledgement email** (auto-reply) on each request, and
  alerts the owner;
- tracks every reservation as a **Google Calendar** event (tentative → confirmed
  → cancelled);
- gives the owner a private **admin panel** at `/reservas/admin` to build a quote
  from a request, **tweak line items, apply discounts**, and **send the quote by
  email** with a public link the customer can **accept or decline**.

No frontend framework — vanilla HTML/CSS/JS reusing the site's `css/bosque.css`
design tokens.

---

## Stack

- **Node 18+**, Express
- **better-sqlite3** — file DB at `data/bosque.db`
- **googleapis** — Google Calendar (free/busy + events)
- **nodemailer** — Gmail (auto-reply, owner alert, quote, confirmation)
- **express-session** + **bcryptjs** — single-owner admin auth

---

## Setup

```bash
cd reservas
npm install
cp .env.example .env      # then fill in the values below
npm start                 # http://localhost:3000
```

Visit:
- Site: `http://localhost:3000/`
- Booking: `http://localhost:3000/reservas`
- Admin: `http://localhost:3000/reservas/admin`

### Try it without credentials (DRY_RUN)

Set `DRY_RUN=1` in `.env` (it's also implied when Google/Gmail creds are missing).
Calendar and email calls are then **logged to the console instead of sent**, so
you can click through the whole flow locally. The app treats every slot as free
in DRY_RUN (no calendar to query) but still enforces DB-held slots.

---

## Configuration (`.env`)

| Variable | What it is |
|---|---|
| `PORT` / `BASE_URL` | Server port and the public URL used in emails/quote links. |
| `SESSION_SECRET` | Long random string for the admin session cookie. |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (see below). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail account + **App Password** to send from. |
| `OWNER_NOTIFY_EMAIL` | Where new-request alerts go (defaults to `GMAIL_USER`). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client (Desktop app). |
| `GOOGLE_REFRESH_TOKEN` | Obtained once via `npm run token` (see below). |
| `GOOGLE_CALENDAR_ID` | The "Bosque Reservas" calendar ID. |
| `DRY_RUN` | `1` to log instead of calling Google/Gmail. |

### Admin password

```bash
node scripts/hash-password.js "the-password-you-want"
# paste the printed hash into ADMIN_PASSWORD_HASH
```

### Gmail App Password

Emails are sent from `GMAIL_USER` via Gmail. Use a Google **App Password**
(not your normal password): enable 2-Step Verification, then create one at
<https://myaccount.google.com/apppasswords> and put it in `GMAIL_APP_PASSWORD`.

### Google Calendar

1. In Google Cloud Console: create a project, **enable the Google Calendar API**.
2. Create an **OAuth client ID** of type **Desktop app**. Put the client id/secret
   in `.env`.
3. Create a dedicated calendar named **"Bosque Reservas"** in Google Calendar.
   Copy its **Calendar ID** (Settings → *Integrate calendar*) into
   `GOOGLE_CALENDAR_ID`.
4. Run the one-time token helper and follow the prompts:
   ```bash
   npm run token
   ```
   Paste the printed `GOOGLE_REFRESH_TOKEN=...` line into `.env`.

---

## How it works

### Booking (customer)
`/reservas` → pick segment → pick package → pick date → the page calls
`GET /reservas/api/availability` which runs **free/busy** on the calendar and
subtracts busy intervals (plus any held reservations) from that segment's slot
templates, returning only free slots. Submitting `POST /reservas/api/requests`:
- stores the reservation (`status=new`, with UTM capture),
- creates a **tentative** calendar event to hold the slot,
- sends the customer the **auto-reply** and the owner an alert.

### Quoting (owner)
`/reservas/admin` (password) → open a request → the quote builder pre-fills a
line item from the chosen package and offers its add-ons. Edit labels/qty/prices,
choose a **percent or fixed discount**, set a validity date and a note. Totals are
computed server-side by `src/quotes.js`. **Send** emails the customer a branded
quote with a link to `/reservas/q/:token` (a one-tap WhatsApp link is also shown
for manual sending).

### Response (customer)
`/reservas/q/:token` shows the quote with **Aceitar / Recusar**:
- accept → reservation `confirmed`, the calendar event is promoted to confirmed,
  confirmation emails go to customer + owner;
- decline → reservation `declined`, the held event is deleted (slot freed).

### Prices / packages — `data/pricing.json`
All segments, packages, slot templates, add-ons and prices live in this one file
(CMS-lite). **The prices are placeholders — confirm them before launch.** Edit and
restart; no code changes needed.

---

## Data model (SQLite)

- `reservations` — one row per request (status: new → quoted → confirmed/declined).
- `quotes` — one current quote per reservation (subtotal, discount, total, token).
- `quote_items` — line items for a quote.

---

## Tests

```bash
npm test
```

`test/quotes.test.js` covers the quote math (subtotal, percent/fixed discount,
clamping, rounding); `test/slots.test.js` covers availability (busy intervals
block the right slots, overlapping templates conflict). Both run with plain Node
— no network or credentials.

---

## Deployment notes

- Run behind HTTPS (the session cookie is `secure` when `NODE_ENV=production`).
- `data/bosque.db` and `.env` are gitignored — back up the DB; it holds your
  reservations and quotes.
- The app serves the whole site, so it's the single process to run. Point the
  domain at it (or put it behind a reverse proxy) and keep `/` serving the static
  pages and `/reservas*` the app.
