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
| `/outfit/{shareCode}` | `app/outfit/[shareCode]/page.tsx` | Shared outfit view (mobile-friendly) |

## Source Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout with Navbar
│   ├── globals.css                 # Global styles
│   ├── page.tsx                    # Welcome / kiosk home
│   ├── kiosk/session/page.tsx      # Main kiosk session page
│   ├── admin/page.tsx              # Staff dashboard
│   ├── analytics/
│   │   └── page.tsx                # Analytics dashboard
│   └── outfit/
│       └── [shareCode]/page.tsx    # Public shared outfit view
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
VestiaAPI.getOutfitRecommendations(productIds[], sessionId?, customerId?, sessionPreferences?)
VestiaAPI.saveOutfit({ sessionId?, customerId?, items })
VestiaAPI.getOutfit(shareCode)
```

**API Base**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`
**Image Base**: `https://vestia-product-images.s3.ca-central-1.amazonaws.com/full/{sku}.jpg`

## Key Session Page Features

The kiosk session page (`/kiosk/session`) is the core of the customer experience:

- **Scan items** — SKU input writes a SCAN event to DynamoDB and immediately triggers the scoring pipeline
- **Recommendation panel** — shows top-5 ranked outfit suggestions; see [Scoring Pipeline](#scoring-pipeline) below
- **In-session preferences modal** — customer picks preferred colours, styles, patterns, and fabrics; updates live scoring with a 33% signal weight when set
- **Customer login modal** — link a loyalty email to load full purchase history and derived style profile; shifts recommendation rankings toward historically preferred items
- **Request modal** — customer requests a different size or colour; creates a REQUEST event (QUEUED → CLAIMED → DELIVERED)
- **Mix & Match mode** — select multiple scanned items, calls `/recommend` with `productIds[]`, fills all missing outfit categories (top/bottom/shoes/accessory) simultaneously
- **Save & Share outfit** — saves a built outfit to DynamoDB via POST `/outfit`, returns a 6-char share code; `/outfit/{shareCode}` renders the full look on any device without authentication
- **Session timer** — live elapsed time display
- **End session modal** — collects overall and per-item feedback before closing

## Scoring Pipeline

Recommendations are not AI-generated — they are produced by a deterministic multi-signal scoring function in `vestia-recommend`. Each candidate item receives a weighted composite score across up to 8 independent signals:

| Signal | Default weight | With prefs/profile |
|---|---|---|
| Article type compatibility | 25% | 18% |
| Colour compatibility | 20% | 13% |
| Pattern compatibility | 15% | 10% |
| Historical co-occurrence | 15% | 12% |
| Fabric compatibility | 10% | 7% |
| Price proximity | 8% | 5% |
| Preference signal (see below) | 5% | 33% |
| Session feedback signal | 2% | 2% |

The **preference signal** is itself a composite of up to 6 sub-signals, each computed independently so they compete rather than cancel:

1. **Session colours** (explicit, high-confidence) — customer-selected colours score 1.0; misses score 0.05
2. **Profile derived colours** (learned, medium-confidence) — colours from purchase history score 0.75; misses score 0.05
3. **Style / usage** — session style preference + dominant style from purchase history
4. **Pattern preference** — solid, striped, checked, printed, etc.; maps directly to the pattern compatibility dimension
5. **Fabric preference** — cotton, denim, synthetic, etc.; maps directly to the fabric compatibility dimension
6. **Article type affinity** — article types the customer has bought before get a 0.85 boost; others 0.35
7. **Price range alignment** — candidates within ±50% of the customer's average historical spend score 1.0

When any preference or profile context is present, the preference signal weight rises from 5% to 33% and the base catalog signals are reduced proportionally. This means a guest and a returning customer scanning the same item receive meaningfully different rankings, and the list updates immediately when preferences are changed mid-session.
