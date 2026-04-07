# Vestia — The Retail Experience Platform (RXM)

**McMaster University — COMPSCI 4ZP6A/B Capstone, Team 27**

Vestia is a smart fitting room platform that connects customers, staff, and store analytics through kiosk interfaces. Customers scan items in fitting rooms, receive personalised outfit recommendations scored by a multi-signal algorithm, and request different sizes or colours from staff — all in real time.

---

## Live Deployment (no setup required)

The application is fully deployed on AWS. No installation needed — just open the links below in a browser:

| Interface | URL |
|-----------|-----|
| **Customer Kiosk** | http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/ |
| **Staff / Admin Dashboard** | http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/admin |
| **Store Analytics** | http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/analytics |

---

## TA Evaluation Guide

### Step 1 — Open the Kiosk
Go to: http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/

### Step 2 — Scan an item
Enter SKU **`10005`** in the scan field to add an item to the session. You can scan multiple SKUs.

### Step 3 — Log in with the test account
When prompted, enter `demo@vestia.com` to activate personalized recommendations.

| Field | Value |
|-------|-------|
| Email | `demo@vestia.com` |
| Purchase history | 8 items (t-shirts, jeans, shoes, watch) |
| Preferred sizes | Top: M, Bottom: 32, Shoes: 10 |
| Preferred colours | Black, Navy, Grey |

You can also skip login to explore as a guest — all core features work without an account.

### Step 4 — Explore features
- Click any scanned item to view **outfit recommendations**
- Use **Mix & Match** to build a full outfit from multiple items
- Tap **Request Size/Colour** to send a request to the staff dashboard
- Use **Save Outfit** to generate a shareable link/QR code
- End the session to submit **feedback**

### Step 5 — Check the Staff Dashboard
Open http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/admin in a second tab to see the request appear in real time and claim/deliver it.

### Step 6 — View Analytics
Open http://vestia-alb-260109529.ca-central-1.elb.amazonaws.com/analytics to see store-wide session, scan, and fulfillment metrics.

---

## Run Locally (optional)

**Prerequisites:** [Node.js 18+](https://nodejs.org) and npm

```bash
# 1. Clone the repo
git clone https://github.com/saagarracharla/Vestia_The-Retail-Experience-Platform_RXM.git
cd Vestia_The-Retail-Experience-Platform_RXM

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Start the dev server
npm run dev
```

No environment variables or local backend setup needed — the backend runs on AWS and the frontend connects to it automatically.

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
│   ├── lambdas/               # 14 active AWS Lambda functions (Node.js 22, ESM)
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
- **Lambda**: 14 active functions, Node.js 22.x ESM modules
- **DynamoDB**: 4 tables — `VestiaSessions`, `ProductCatalog`, `CompatibilityStats`, `CustomerProfiles`
- **S3**: `vestia-product-images` (44k product images), `vestia-product-data-ca` (raw Myntra JSONs)

Full infrastructure details: [AWS_ARCHITECTURE.md](./AWS_ARCHITECTURE.md)

---

## Key Features

- **Item Scanning** — customer scans SKU at kiosk, session event stored in DynamoDB
- **Outfit Recommendations** — deterministic 8-signal weighted scoring pipeline (article type compatibility, colour compatibility, pattern compatibility, historical co-occurrence, fabric compatibility, price proximity, customer preference signal, live feedback); preference weight shifts from 5% to 33% when customer profile or in-session preferences are present
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

## Submission Documents

| Document | Location |
|----------|----------|
| Software Requirements Specification (SRS) | `Documents/SRS_Project_plan_requirements.pdf` |
| Design Doc + V&V | `Documents/VestiaDesignAndV&VDoc.pdf` |
| Reflection | `Documents/Group_27_Reflection.pdf` |
| V&V Test Results (live API) | `VnV_Test_Results/VnV_Test_Results.md` |
| V&V Test Runner script | `VnV_Test_Results/test-runner.mjs` |
| V&V Raw JSON results | `VnV_Test_Results/test-results.json` |

---

*COMPSCI 4ZP6A/B — McMaster University — Team 27*
