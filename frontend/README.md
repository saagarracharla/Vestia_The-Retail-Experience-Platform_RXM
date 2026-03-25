# Vestia Frontend

Next.js 16 + TypeScript frontend for the Vestia smart fitting room platform.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Runtime**: React 19

## Getting Started

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npx tsc --noEmit  # type check
```

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Customer kiosk welcome screen |
| `/kiosk/session` | `app/kiosk/session/page.tsx` | Active fitting room session |
| `/admin` | `app/admin/page.tsx` | Staff request dashboard |
| `/analytics` | `app/analytics/page.tsx` | Store analytics |
| `/analytics/store` | `app/analytics/store/page.tsx` | Store-level analytics breakdown |

## Source Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with Navbar
│   ├── globals.css                 # Global styles
│   ├── page.tsx                    # Welcome / kiosk home
│   ├── kiosk/session/page.tsx      # Main kiosk session page
│   ├── admin/page.tsx              # Staff dashboard
│   └── analytics/
│       ├── page.tsx                # Analytics dashboard
│       └── store/page.tsx          # Store analytics
│
├── components/
│   ├── ColourDot.tsx               # Coloured circle for colour display
│   ├── DonutChart.tsx              # SVG donut chart for analytics
│   ├── EndSessionModal.tsx         # End session + feedback collection
│   ├── ErrorBoundary.tsx           # React error boundary wrapper
│   ├── FutureFeaturesPlaceholder.tsx  # Placeholder for P2 features
│   ├── ItemCard.tsx                # Product card with image + request button
│   ├── LoadingSpinner.tsx          # Loading state indicator
│   ├── Modal.tsx                   # Generic modal wrapper
│   ├── Navbar.tsx                  # Top navigation bar
│   ├── Notification.tsx            # Toast notification
│   ├── SessionTimer.tsx            # Live session duration timer
│   ├── StatCard.tsx                # Metric card for analytics
│   └── WelcomeScreen.tsx           # Kiosk idle welcome screen
│
├── lib/
│   └── api.ts                      # VestiaAPI class — all AWS API calls
│
└── utils/
    └── sessionId.ts                # Session ID generation helper
```

## API Client

All backend communication goes through `src/lib/api.ts` — a typed static class:

```typescript
VestiaAPI.getProduct(sku)
VestiaAPI.getSession(sessionId)
VestiaAPI.scanItem(sessionId, sku, kioskId)
VestiaAPI.getRecommendations(productId, targetCategory, gender?, sessionId?, customerId?, sessionPreferences?)
VestiaAPI.createRequest({ sessionId, sku, requestedSize?, requestedColor? })
VestiaAPI.updateRequest(requestId, { status?, action? })
VestiaAPI.getCustomerProfile(customerId)       // returns null on 404 (new customer)
VestiaAPI.upsertCustomerProfile(customerId, updates)
VestiaAPI.submitSessionFeedback(sessionId, feedback)
VestiaAPI.getAnalytics(days?)
VestiaAPI.getStoreRequests(storeId)
```

**API Base**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`
**Image Base**: `https://vestia-product-images.s3.ca-central-1.amazonaws.com/full/{sku}.jpg`

## Key Session Page Features

The kiosk session page (`/kiosk/session`) is the core of the customer experience:

- **Scan items** — SKU input writes SCAN event to DynamoDB, triggers recommendation fetch
- **Recommendations panel** — shows top-5 outfit suggestions scored by the recommendation algorithm
- **Preferences modal** — auto-triggers after first scan; collects sizes, colours, styles; written as PREF event
- **Customer login modal** — link loyalty email to load purchase history and `derivedStyle`; re-fetches recommendations with customer context
- **Request modal** — customer requests a size/colour change; creates REQUEST event (QUEUED → CLAIMED → DELIVERED)
- **In-session feedback** — thumbs up/down + colour preference on recommendation cards; adjusts live scoring
- **Session timer** — live elapsed time display
- **End session modal** — collects overall and per-item feedback before closing
