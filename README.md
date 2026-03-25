# Vestia — The Retail Experience Platform (RXM)

**McMaster University — COMPSCI 4ZP6A/B Capstone, Team 27**

Vestia is a smart fitting room platform that connects customers, staff, and store analytics through kiosk interfaces. Customers scan items in fitting rooms, receive AI-powered outfit recommendations, and request different sizes or colours from staff — all in real time.

---

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

| URL | Interface |
|-----|-----------|
| `http://localhost:3000` | Customer kiosk welcome screen |
| `http://localhost:3000/kiosk/session` | Active fitting room session |
| `http://localhost:3000/admin` | Staff request dashboard |
| `http://localhost:3000/analytics` | Store analytics |
| `http://localhost:3000/outfit/{shareCode}` | Shared outfit view (mobile-friendly) |

---

## Repository Structure

```
Vestia_The-Retail-Experience-Platform_RXM/
├── frontend/                  # Next.js 16 + TypeScript customer/staff UI
│   └── src/
│       ├── app/               # Page routes (kiosk, admin, analytics)
│       ├── components/        # Reusable UI components
│       ├── lib/api.ts         # Typed AWS API client (VestiaAPI class)
│       └── utils/             # Helpers (sessionId generation)
│
├── backend/                   # Serverless backend
│   ├── lambdas/               # 12 active AWS Lambda functions (Node.js 22, ESM)
│   ├── scripts/               # One-time data pipeline scripts
│   └── context/               # OpenAPI spec, DynamoDB schema reference
│
└── Documents/                 # SRS, project plan, research PDFs
```

---

## Architecture Overview

### Frontend
- **Framework**: Next.js 16, React 19, TypeScript 5
- **Styling**: Tailwind CSS 4
- **API Client**: `VestiaAPI` class in `src/lib/api.ts` — typed wrappers for all endpoints

### Backend (AWS — `ca-central-1`)
- **API Gateway**: HTTP API v2 (`vestia-api`, id: `993toyh3x5`)
- **Lambda**: 13 active functions, Node.js 22.x ESM modules
- **DynamoDB**: 4 tables — `VestiaSessions`, `ProductCatalog`, `CompatibilityStats`, `CustomerProfiles`
- **S3**: `vestia-product-images` (44k product images), `vestia-product-data-ca` (raw Myntra JSONs)

Full infrastructure details: [AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md)

---

## Key Features

- **Item Scanning** — customer scans SKU at kiosk, session event stored in DynamoDB
- **AI Recommendations** — 8-signal weighted algorithm (article type, colour, pattern, fabric, co-scan affinity, price, customer preferences, live feedback)
- **Request Fulfillment** — customer requests size/colour change → staff notified → QUEUED → CLAIMED → DELIVERED
- **Customer Profiles** — loyalty email links purchase history; `derivedStyle` (topColors, dominantStyle, avgPrice) personalises recommendations
- **In-Session Feedback** — thumbs up/down and colour preference signals adjust recommendations live
- **Session Preferences** — size, colour, style preferences persist within a session
- **Mix & Match** — select multiple scanned items, Lambda scores candidates against all simultaneously and fills in missing outfit categories (top/bottom/shoes/accessory)
- **Save & Share Outfits** — saves complete outfit to DynamoDB, generates a 6-char share code; shareable URL at `/outfit/{shareCode}` renders the full outfit on any device
- **Staff Dashboard** — real-time request queue with claim/deliver workflow
- **Store Analytics** — sessions, scans, requests, fulfillment rate, top items/sizes/colours over 7/30/90-day windows

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend | AWS Lambda (Node.js 22.x ESM), API Gateway HTTP API v2 |
| Database | DynamoDB (single-table event-sourced + product catalog) |
| Storage | S3 (product images + raw product JSONs) |
| Region | `ca-central-1` |

---

## Development

```bash
# Frontend dev server
cd frontend && npm run dev

# TypeScript check
cd frontend && npx tsc --noEmit

# Deploy a Lambda (example)
cd backend/lambdas/vestia-recommend
zip -q function.zip index.mjs
aws lambda update-function-code --function-name vestia-recommend --zip-file fileb://function.zip --region ca-central-1
```

---

*COMPSCI 4ZP6A/B — McMaster University — Team 27*
