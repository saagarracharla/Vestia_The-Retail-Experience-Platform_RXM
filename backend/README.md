# Vestia Backend

Serverless backend for Vestia — 13 AWS Lambda functions (Node.js 22.x ESM) behind API Gateway HTTP API v2.

**Region**: `ca-central-1`
**API ID**: `993toyh3x5`
**Base URL**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`

## Structure

```
backend/
├── lambdas/                        # AWS Lambda functions
│   ├── vestia-analytics-get/       # GET /analytics
│   ├── vestia-customer-profile/    # GET + PUT /customer/{id}
│   ├── vestia-product-get/         # GET /product/{sku}
│   ├── vestia-outfit/              # POST /outfit + GET /outfit/{shareCode}
│   ├── vestia-recommend/           # POST /recommend
│   ├── vestia-request-claim/       # PATCH /request/{id}/claim
│   ├── vestia-request-get/         # GET /store/{id}/request
│   ├── vestia-request-post/        # POST /request
│   ├── vestia-request-update/      # PATCH /request/{id}
│   ├── vestia-session-feedback/    # POST /session/feedback
│   ├── vestia-session-get/         # GET /session/{id}
│   ├── vestia-session-preferences/ # POST /session/preferences
│   └── vestia-session-scan/        # POST /session/scan
│
├── scripts/                        # One-time data pipeline scripts
│   ├── enrich-catalog-from-s3.py   # Enriches ProductCatalog from S3 JSONs
│   └── populate-compatibility-stats.mjs  # Seeds CompatibilityStats table
│
└── context/                        # Reference data and schemas
    ├── OAS30_993toyh3x5_$latest_with_apig_ext.json  # Full OpenAPI spec
    ├── CompatibilityStats.json     # Sample CompatibilityStats entries
    ├── ProductCatalog.json         # Sample ProductCatalog entries
    ├── VestiaSessions.json         # Sample VestiaSessions entries
    └── product-jsaon-schema.md     # Product schema documentation
```

## Lambda Functions

Each Lambda is a single `index.mjs` file with no external dependencies — uses the AWS SDK available in the Lambda runtime.

### Session

**`vestia-session-scan`** — `POST /session/scan`
Writes a `SCAN` event to `VestiaSessions` under `SESSION#{sessionId}` / `SCAN#{timestamp}`.

**`vestia-session-get`** — `GET /session/{sessionId}`
Queries all events for a session (`SESSION#{sessionId}`) and returns them normalised.

**`vestia-session-feedback`** — `POST /session/feedback`
Writes a `FEEDBACK` event with `itemFeedback[]` (sku, liked, preferredColor) to the session.

**`vestia-session-preferences`** — `POST /session/preferences`
Writes a `PREF` event with `preferredColors`, `preferredStyles`, `preferredPatterns`, `preferredFabrics` to the session. These are passed directly into the scoring pipeline on subsequent recommendation calls.

### Requests

**`vestia-request-post`** — `POST /request`
Creates a REQUEST with status `QUEUED`. Writes the same record to two DynamoDB partitions:
- `SESSION#{sessionId}` → kiosk can query its own requests
- `STORE#{storeId}` → staff dashboard queries all store requests

**`vestia-request-update`** — `PATCH /request/{requestId}`
Updates status on both partitions (SESSION + STORE). When `action = "delivered"` is passed, also auto-creates a `SCAN` event with `source: "staff"` so the delivered item appears in the customer's session.

**`vestia-request-claim`** — `PATCH /request/{requestId}/claim`
Staff claims a QUEUED request — sets status to `CLAIMED` and records `employeeId`.

**`vestia-request-get`** — `GET /store/{storeId}/request`
Queries the `STORE#STORE-001` partition to return all requests for the staff dashboard.

### Product & Recommendations

**`vestia-product-get`** — `GET /product/{sku}`
Returns a single product from `ProductCatalog` including all S3-enriched attributes (pattern, fit, fabric, etc.).

**`vestia-recommend`** — `POST /recommend`
Multi-signal scoring pipeline — not an AI model. Candidates are ranked by a deterministic weighted composite score across 8 independent signals. Weights shift dynamically based on available context.

**Single-item mode**: `{ productId, targetCategory, gender?, sessionId?, customerId?, sessionPreferences? }`
Returns top-5 scored candidates for one target category with diversity re-ranking applied after scoring.

**Mix & Match (outfit) mode**: `{ productIds: string[], sessionId?, customerId?, sessionPreferences? }`
Scores candidates against all selected base items simultaneously (score averaged across base items), fills all missing outfit categories (top/bottom/shoes/accessory), returns `{ outfit: Record<category, RecommendationItem[]>, baseProductIds }`.

**Scoring signals (8 total):**

| Signal | Source table | Default weight | With context |
|---|---|---|---|
| Article type compatibility | `CompatibilityStats` | 25% | 18% |
| Colour compatibility | `CompatibilityStats` | 20% | 13% |
| Pattern compatibility | `CompatibilityStats` | 15% | 10% |
| Historical co-occurrence | `VestiaSessions` (30-day scan pairs) | 15% | 12% |
| Fabric compatibility | `CompatibilityStats` | 10% | 7% |
| Price proximity | `ProductCatalog` | 8% | 5% |
| Preference signal (composite) | Customer profile + session prefs | 5% | 33% |
| Session feedback signal | `VestiaSessions` (FEEDBACK events) | 2% | 2% |

**Preference signal sub-components** (computed independently, averaged into prefScore):
- Session colours — explicit in-session pick, 1.0 match / 0.05 miss
- Profile derived colours — from purchase history, 0.75 match / 0.05 miss (separate signal, does not cancel session colours)
- Style / usage — session style + dominant style from `derivedStyle`
- Pattern preference — maps to the pattern compatibility dimension
- Fabric preference — maps to the fabric compatibility dimension
- Article type affinity — 0.85 if candidate article type appears in purchase history
- Price range alignment — 1.0 if candidate price is within ±50% of customer's average spend

When any preference or profile context is present, `hasPrefs = true` and the preference signal weight rises from 5% to 33% with other weights reduced proportionally.

**`vestia-outfit`** — `POST /outfit` + `GET /outfit/{shareCode}`
- POST: saves a complete outfit to `VestiaSessions` under `PK: OUTFIT#{shareCode}`, `SK: META`. Generates a 6-char unambiguous share code (no 0/O/1/I). Returns `{ outfitId, shareCode }`.
- GET: fetches a saved outfit by share code.

### Customer & Analytics

**`vestia-customer-profile`** — `GET /customer/{id}` + `PUT /customer/{id}`
- GET: returns profile + computes `derivedStyle` from purchase history on the fly
- PUT: merges purchase history (keeps last 50), increments `visitCount` if `incrementVisit: true`

**`vestia-analytics-get`** — `GET /analytics?days=30`
Scans `SESSION#` partition of `VestiaSessions` and computes: session count, scan count, request count, avg session duration, fulfillment rate, top items/sizes/colours, request status breakdown.

## Deploying a Lambda

```bash
cd backend/lambdas/<function-name>
zip -q function.zip index.mjs
aws lambda update-function-code \
  --function-name <function-name> \
  --zip-file fileb://function.zip \
  --region ca-central-1
```

## Scripts

### `enrich-catalog-from-s3.py`

One-time script that reads every product's raw Myntra JSON from S3 and writes rich attributes back to `ProductCatalog`.

```bash
pip3 install boto3
python3 enrich-catalog-from-s3.py
```

- Reads `vestia-product-data-ca/raw/myntra/json/{productId}.json` for all 44,426 products
- Extracts: `pattern`, `fit`, `fabric`, `occasion`, `idealFor`, `sleeveLength`, `neckType`, `baseColour`, `availableSizes`
- 60 concurrent workers, runs in ~4 minutes

### `populate-compatibility-stats.mjs`

Seeds the `CompatibilityStats` DynamoDB table with fashion compatibility rules across 6 dimensions: COLOR, ARTICLE, USAGE, PATTERN, FABRIC, FIT.

## IAM

All Lambdas share `vestia-shared-lambda-role` with the `VestiaDynamoDBAccess` policy granting read/write to:
- `VestiaSessions`
- `ProductCatalog`
- `CompatibilityStats`
- `CustomerProfiles`
