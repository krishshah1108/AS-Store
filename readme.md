# AS Store

Wholesale display shop accounts app (Phases 1–4).

## Stack

- **Client:** React (Vite) + Socket.IO client + localStorage offline outbox
- **Server:** Node.js + Express + MongoDB Atlas
- **Auth:** Mobile + password (JWT)

## Phase 1 — Foundation

- User management (Owner only)
- Customers & products CRUD with search
- Shop details stored for bills and overdue days
- Socket.IO live updates (no refresh needed)
- Offline create/update via localStorage outbox + sync on reconnect
- Sidebar navigation (hamburger on mobile)

## Phase 2 — Sales & billing

- Multi-line bills (catalogue pick or manual entry)
- Editable rates, qty, discount
- Auto bill numbers (`AS-YYYY-0001`)
- Cash / UPI / credit (mixed) payments
- Customer balance + ledger posting
- Editable bills with revision history
- Print bill + WhatsApp device share

## Phase 3 — Credit & customer ledger

- Customer outstanding balances + advance balance
- Partial credit recovery (collections)
- Automatic FIFO payment allocation to oldest open bills
- Manual bill allocation override
- Customer-wise ledger screen
- Advance deposits + apply-advance to open bills
- Delete a bill (later collections → advance)
- Product returns (partial/full) with ledger credit
- Refunds: cash, UPI, or credit adjustment

## Phase 4 — Dashboard & reports

- Today’s sales, cash/UPI, credit given & recovered
- Total outstanding + pending / overdue customers
- Customer-wise, product-wise, and staff-wise reports
- Date-to-date summary reports
- CSV export + printable report views

## Quick start

### 1. Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Sign in with the owner account already stored in the database.

Set `MONGODB_URI` in `server/.env` to your MongoDB Atlas connection string.

### 2. Client

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## API health

`GET http://localhost:5000/api/health`
