# AS Store

Wholesale display-shop accounts app for sales, credit (Udhaar), payments, and customer ledgers.

## Stack

- **Client:** React (Vite), React Router, Socket.IO client, Phosphor icons, SheetJS (Excel/CSV import)
- **Server:** Node.js, Express, MongoDB (Mongoose), JWT auth, Socket.IO
- **Auth:** Mobile + password (JWT, 7 days)

## Architecture

```
AS-Store/
├── client/                 # Vite React SPA
│   └── src/
│       ├── components/     # Shared UI
│       ├── context/        # Auth, sync, toasts
│       ├── lib/            # API client, offline storage, bill helpers
│       └── pages/          # Route screens
└── server/
    └── src/
        ├── config/         # Database connection
        ├── controllers/    # Request handlers (business entry points)
        ├── middleware/     # Auth (requireAuth, requireOwner)
        ├── models/         # Mongoose schemas
        ├── routes/         # Thin Express routers → controllers
        ├── services/       # Billing engine, bill activity merge
        ├── lib/            # Shared validation helpers
        ├── utils/          # Audit log writer, Socket.IO emit
        ├── seed/           # data.json sample seed
        ├── seed.js         # Seed CLI
        └── index.js        # App bootstrap
```

**Server flow:** `routes` wire HTTP paths and auth → `controllers` handle requests → `services` / `models` run billing and persistence.

There is no standalone `/api/payments` module. Collections against a bill use `/api/bills/:id/payments`.

## Features

### Users & access

- Owner and employee roles (equal feature access)
- Owner-only user create and activate/deactivate
- Shop settings (name, phone, UPI, overdue days, bill footer)

### Catalogue

- Customers and products CRUD, search, activate/deactivate
- Product import from CSV and Excel
- Offline create/update for customers and products (localStorage outbox, sync on reconnect)

### Billing

- Multi-line bills from the product catalogue
- Bill numbers `AS-YYYY-0001`
- Cash, UPI, and Udhaar (credit) on the bill; mixed allowed
- Later payments recorded on the bill (`/api/bills/:id/payments`)
- Edit open bills (ledger reverse + reapply); later collections are respected
- Product returns (partial/full); surplus goes to customer advance
- Delete final bills (ledger reverse; later collections reclassed to advance)
- Print and WhatsApp share from the device
- Bill activity modal (create/edit/payment/return/delete)

### Ledger & credit

- Customer-wise ledger (search customer, then statement)
- Debit (bills), credit (payments), running balance
- Bill numbers as reference links to the bill
- Outstanding balance and advance balance on the customer

### Dashboard & reports

- Home: today’s sales, cash/UPI, credit given & recovered, outstanding, overdue, 7-day trend
- Reports: date range summary, product-wise, customer-wise, staff-wise
- Live updates over Socket.IO (`data:changed`)

## API surface

| Prefix | Purpose |
| --- | --- |
| `GET /api/health` | Health check |
| `/api/auth` | Login, current user |
| `/api/users` | List / create / activate (owner) |
| `/api/customers` | Customer CRUD |
| `/api/products` | Product CRUD + import |
| `/api/settings` | Shop settings |
| `/api/sync` | Flush offline outbox |
| `/api/bills` | Bills, payments, returns, activity |
| `/api/ledger` | Customer ledger |
| `/api/reports` | Dashboard + period reports |

## Quick start

### 1. Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` in `server/.env`.

Optional seed (users, products, customers from `server/src/seed/data.json`):

```bash
npm run seed
```

Sign in with an owner account already in the database (or one created by seed).

### 2. Client

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## Scripts

| Location | Command | What it does |
| --- | --- | --- |
| `server` | `npm run dev` | API with nodemon |
| `server` | `npm start` | API without reload |
| `server` | `npm run seed` | Import `src/seed/data.json` (does not wipe users that already match seed ids) |
| `client` | `npm run dev` | Vite on port 5173 |
| `client` | `npm run build` | Production build |
| `client` | `npm run lint` | oxlint |

## API health

`GET http://localhost:5000/api/health`
