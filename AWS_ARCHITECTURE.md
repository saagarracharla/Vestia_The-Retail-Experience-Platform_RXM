# Vestia — AWS Architecture

**Region**: `ca-central-1`
**Account**: `125667709386`
**API Gateway Base URL**: `https://993toyh3x5.execute-api.ca-central-1.amazonaws.com`

---

## API Endpoints

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/session/scan` | `vestia-session-scan` | Record item scan |
| GET | `/session/{sessionId}` | `vestia-session-get` | Fetch session events |
| POST | `/session/feedback` | `vestia-session-feedback` | Submit in-session feedback |
| POST | `/session/preferences` | `vestia-session-preferences` | Save size/colour/style preferences |
| POST | `/request` | `vestia-request-post` | Create staff request (double-write) |
| PATCH | `/request/{requestId}` | `vestia-request-update` | Update request status |
| PATCH | `/request/{requestId}/claim` | `vestia-request-claim` | Staff claims a request |
| GET | `/store/{storeId}/request` | `vestia-request-get` | Fetch all store requests |
| GET | `/product/{sku}` | `vestia-product-get` | Fetch product metadata |
| POST | `/recommend` | `vestia-recommend` | Get outfit recommendations |
| GET | `/analytics` | `vestia-analytics-get` | Store analytics (supports `?days=7|30|90`) |
| GET | `/customer/{customerId}` | `vestia-customer-profile` | Fetch customer profile + derivedStyle |
| PUT | `/customer/{customerId}` | `vestia-customer-profile` | Create or update customer profile |

---

## DynamoDB Tables

### VestiaSessions

Event-sourced single table storing all session activity.

**Partition Key**: `PK` (string)
**Sort Key**: `SK` (string)

#### Access Patterns

| PK | SK | Used By |
|----|-----|---------|
| `SESSION#{sessionId}` | `SCAN#{timestamp}` | Kiosk item list |
| `SESSION#{sessionId}` | `REQUEST#{requestId}` | Kiosk request status |
| `SESSION#{sessionId}` | `FEEDBACK#{timestamp}` | Recommendation engine |
| `SESSION#{sessionId}` | `PREF#{timestamp}` | Recommendation engine |
| `STORE#{storeId}` | `REQUEST#{requestId}` | Staff dashboard |

#### Entity Schemas

**SCAN**
```json
{
  "PK": "SESSION#abc123",
  "SK": "SCAN#2026-03-24T12:00:00Z",
  "entityType": "SCAN",
  "sessionId": "abc123",
  "sku": "15479",
  "kioskId": "kiosk-1",
  "source": "kiosk | staff",
  "createdAt": "2026-03-24T12:00:00Z"
}
```

**REQUEST** (written to both `SESSION#` and `STORE#` partitions)
```json
{
  "PK": "SESSION#abc123",
  "SK": "REQUEST#REQ-1234567890-abc",
  "entityType": "REQUEST",
  "requestId": "REQ-1234567890-abc",
  "sessionId": "abc123",
  "storeId": "STORE-001",
  "kioskId": "kiosk-1",
  "sku": "15479",
  "requestType": "size_change | color_change | size_color_change | general",
  "requestedSize": "L",
  "requestedColor": null,
  "status": "QUEUED | CLAIMED | DELIVERED | CANCELLED",
  "createdAt": "2026-03-24T12:00:00Z",
  "updatedAt": "2026-03-24T12:05:00Z"
}
```

**FEEDBACK**
```json
{
  "PK": "SESSION#abc123",
  "SK": "FEEDBACK#2026-03-24T12:02:00Z",
  "entityType": "FEEDBACK",
  "sessionId": "abc123",
  "itemFeedback": [
    { "sku": "15479", "liked": true, "preferredColor": "black" }
  ]
}
```

**PREF**
```json
{
  "PK": "SESSION#abc123",
  "SK": "PREF#2026-03-24T12:01:00Z",
  "sessionId": "abc123",
  "preferredSizes": { "top": "M", "bottom": "32" },
  "preferredColors": ["black", "navy"],
  "preferredStyles": ["casual"]
}
```

---

### ProductCatalog

44,446 products from the Myntra dataset, enriched with S3 JSON attributes.

**Primary Key**: `productId` (string)

```json
{
  "productId": "15479",
  "name": "Puma Men Black T-shirt",
  "category": "top",
  "articleType": "Tshirts",
  "color": "black",
  "price": 799,
  "gender": "men",
  "usage": "Sports",
  "season": "Summer",
  "pattern": "Solid",
  "fit": "Regular",
  "fabric": "Cotton",
  "occasion": "Casual",
  "baseColour": "Black",
  "availableSizes": ["S", "M", "L", "XL"],
  "sleeveLength": "Short Sleeve"
}
```

> `pattern`, `fit`, `fabric`, `occasion`, `baseColour`, `availableSizes`, `sleeveLength` were added by `backend/scripts/enrich-catalog-from-s3.py` reading 44,446 S3 JSONs from `vestia-product-data-ca/raw/myntra/json/{productId}.json`.

---

### CompatibilityStats

Pre-computed fashion compatibility scores used by the recommendation engine. 1,062+ entries.

**Primary Key**: `PK` (string)
**Sort Key**: `SK` (string)
**Attribute**: `score` (number, 0.0–1.0)

#### Entry Types

| PK Format | SK Format | Example |
|-----------|-----------|---------|
| `COLOR#black` | `COLOR#navy` | Black pairs with navy: 0.85 |
| `ARTICLE#tshirts` | `ARTICLE#jeans` | T-shirts pair with jeans: 0.90 |
| `USAGE#sports` | `USAGE#sports` | Same usage: 0.95 |
| `PATTERN#solid` | `PATTERN#striped` | Solid top + striped bottom: 0.85 |
| `FABRIC#cotton` | `FABRIC#denim` | Cotton + denim: 0.80 |
| `FIT#regular` | `FIT#slim` | Regular + slim: 0.75 |

---

### CustomerProfiles

Loyalty customer data with purchase history and derived style insights.

**Primary Key**: `customerId` (string, email address)

```json
{
  "customerId": "demo@vestia.com",
  "gender": "men",
  "preferredSizes": { "top": "M", "bottom": "32", "shoes": "10" },
  "preferredColors": ["black", "navy"],
  "preferredStyles": ["casual"],
  "purchaseHistory": [
    {
      "productId": "15479",
      "name": "Puma Men Black T-shirt",
      "articleType": "Tshirts",
      "color": "black",
      "price": 799,
      "purchasedAt": "2025-12-15T10:00:00Z"
    }
  ],
  "visitCount": 3,
  "lastVisitAt": "2026-03-24T20:00:00Z",
  "createdAt": "2025-11-01T00:00:00Z",
  "updatedAt": "2026-03-24T20:00:00Z"
}
```

> `derivedStyle` is **not stored** — it is computed on every GET by `deriveStyle()` in the Lambda and returned in the response:
> ```json
> { "topColors": ["black","navy"], "topArticles": ["tshirts","jeans"], "avgPrice": 1200, "dominantStyle": "casual" }
> ```

---

## Lambda Functions

**Runtime**: Node.js 22.x (ESM)
**IAM Role**: `vestia-shared-lambda-role` with `VestiaDynamoDBAccess` policy

| Function | Trigger | Tables Accessed |
|----------|---------|-----------------|
| `vestia-session-scan` | POST /session/scan | VestiaSessions (write) |
| `vestia-session-get` | GET /session/{id} | VestiaSessions (read) |
| `vestia-session-feedback` | POST /session/feedback | VestiaSessions (write) |
| `vestia-session-preferences` | POST /session/preferences | VestiaSessions (write) |
| `vestia-request-post` | POST /request | VestiaSessions (double-write) |
| `vestia-request-update` | PATCH /request/{id} | VestiaSessions (update + optional scan write) |
| `vestia-request-claim` | PATCH /request/{id}/claim | VestiaSessions (update) |
| `vestia-request-get` | GET /store/{id}/request | VestiaSessions (read STORE# partition) |
| `vestia-product-get` | GET /product/{sku} | ProductCatalog (read) |
| `vestia-recommend` | POST /recommend | ProductCatalog, CompatibilityStats, VestiaSessions, CustomerProfiles |
| `vestia-analytics-get` | GET /analytics | VestiaSessions (read SESSION# partition) |
| `vestia-customer-profile` | GET+PUT /customer/{id} | CustomerProfiles |

> `vestia-session-handler` and `vestia-storeMetrics` are unused placeholders.

---

## Recommendation Algorithm

`vestia-recommend` implements a full weighted scoring pipeline:

```
POST /recommend { productId, targetCategory, gender?, sessionId?, customerId?, sessionPreferences? }
```

### Scoring Weights

| Signal | Weight | Source |
|--------|--------|--------|
| Article type compatibility | 25% | CompatibilityStats `ARTICLE#` |
| Colour compatibility | 20% | CompatibilityStats `COLOR#` |
| Pattern compatibility | 15% | CompatibilityStats `PATTERN#` (S3-enriched) |
| Historical co-scan affinity | 15% | VestiaSessions 30-day window |
| Fabric compatibility | 10% | CompatibilityStats `FABRIC#` (S3-enriched) |
| Price proximity | 8% | ProductCatalog price field |
| Customer preferences | 5% | CustomerProfiles + session PREF events |
| In-session feedback | 2% | VestiaSessions FEEDBACK events |

### Pipeline Steps

1. Fetch base product from `ProductCatalog`
2. Fetch 6 CompatibilityStats in parallel (COLOR, ARTICLE, USAGE, PATTERN, FABRIC, FIT)
3. Read session SCAN events → exclude already-scanned SKUs
4. Read session FEEDBACK events → build live feedback signals
5. Read session PREF events → merge with inline `sessionPreferences`
6. Full-table scan `VestiaSessions` (30-day) → compute co-scan affinity map
7. Load `CustomerProfiles` if `customerId` provided → merge `derivedStyle`
8. Scan `ProductCatalog` filtered by gender
9. Filter by target category (top / bottom / shoes / accessory)
10. Score all candidates using weighted formula
11. Diversity re-rank: max 1 per article type, max 2 per colour in top-5
12. Return top-5 per category

---

## S3 Buckets

| Bucket | Purpose |
|--------|---------|
| `vestia-product-images` | 44k product images at `full/{sku}.jpg` |
| `vestia-product-data-ca` | Raw Myntra JSONs at `raw/myntra/json/{productId}.json` |

---

## Key Design Patterns

**Event Sourcing** — `VestiaSessions` stores immutable timestamped events. No state is mutated; history is always queryable.

**Dual-Write for Dual Read Patterns** — REQUEST events are written to both `SESSION#{id}` (kiosk view) and `STORE#{id}` (staff view) simultaneously. Updates touch both copies.

**Auto-Scan on Delivery** — when a REQUEST is marked DELIVERED, `vestia-request-update` automatically creates a new `SCAN` event with `source: "staff"`, making the delivered item appear in the customer's session without a manual re-scan.

**S3 Pre-enrichment** — rather than fetching S3 JSONs at query time (too slow at 44k products), `backend/scripts/enrich-catalog-from-s3.py` ran once to write all rich attributes into `ProductCatalog`. The Lambda reads enriched DynamoDB attributes directly at recommendation time.

**Co-Scan Affinity (Live)** — co-occurrence is computed live from `VestiaSessions` on every recommendation request (30-day rolling window). No separate co-occurrence table; the event log is the source of truth.
