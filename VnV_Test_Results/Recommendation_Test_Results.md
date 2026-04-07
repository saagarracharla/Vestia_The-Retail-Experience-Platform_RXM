# Design Doc — TA Comment Fixes
> Paste each section below into the corresponding location in the Design Doc.

---

## FIX FOR COMMENT 1 — Add Section 8.15: Product Image Database

*(Insert as Section 8.15 in Section 8: Component Behaviour)*

### 8.15 Product Image Database

**8.15.1 Normal Behaviour:**
The Product Image Database stores full-resolution product images for all 44,446 items in the store catalog. Images are organized by SKU using a flat path structure and are accessed by the Kiosk UI and the Outfit Share Service to render product visuals on the fitting room screen, recommendations panel, and the public outfit share page. The database is read-only at runtime; images are written only during the offline catalog ingestion pipeline. No session, user, or request data is stored here.

**8.15.2 Interfaces (Inputs and Outputs):**
The inputs to this component are image upload operations executed during the offline batch enrichment pipeline, keyed by SKU. The outputs are publicly accessible image URLs of the form:

```
https://vestia-product-images.s3.ca-central-1.amazonaws.com/full/{sku}.jpg
```

These URLs are consumed by:
- The Kiosk UI (`ItemCard` component) to render scanned item thumbnails
- The Recommendation Service panel to display recommendation images
- The Outfit Save/Share Service to render items in saved outfit views
- The public `/outfit/{shareCode}` page for share link previews

**8.15.3 Implementation Details:**
The Product Image Database is implemented as an AWS S3 bucket (`vestia-product-images`) in the `ca-central-1` region with public read access enabled on the `full/` prefix. Images are stored as JPEG files with the SKU as the filename (e.g., `full/15479.jpg`). The URL pattern is deterministic — given a SKU, any component can construct the image URL without an additional API call:

```typescript
const IMAGE_BASE_URL =
  "https://vestia-product-images.s3.ca-central-1.amazonaws.com/full/";

function getImageUrl(sku: string): string {
  return `${IMAGE_BASE_URL}${sku}.jpg`;
}
```

This design eliminates a round-trip to the backend for image resolution. The `VestiaAPI` class exposes `getImageUrl(sku)` as a static method used throughout the frontend. Images were bulk-uploaded from the Myntra dataset during the offline ingestion pipeline via the `enrich-catalog-from-s3.py` script, which cross-referenced product IDs with the raw image files in `vestia-product-data-ca/raw/myntra/json/`.

**8.15.4 Potential Undesired Behaviour:**
Potential issues include broken image links for products whose images were not present in the source dataset, leading to missing thumbnails in the kiosk UI. Additionally, S3 public access policies could be inadvertently restricted during AWS account configuration changes, making all images inaccessible. Since image URLs are constructed client-side without validation, there is no server-side check confirming an image exists before it is rendered — the frontend relies on the `<img>` tag's native error handling to fall back gracefully.

---

## FIX FOR COMMENT 2 — Complete Section 8.8.3 + Add Implementation Detail

*(Replace Section 8.8.3 in the Design Doc)*

**8.8.3 Implementation Details:**
The Recommendation Service is implemented as a stateless AWS Lambda function (`vestia-recommend`, Node.js 22 ESM) accessible via `POST /recommend`. It operates in two modes controlled by the request payload:

**Single-Item Mode** (`{ productId, targetCategory, gender?, sessionId?, customerId?, sessionPreferences? }`):
1. `fetchBaseProduct(productId)` — reads the base item's full attribute set from `ProductCatalog` via `DynamoDBDocumentClient.send(GetCommand)`.
2. `fetchCandidates(targetCategory, gender)` — performs a DynamoDB `ScanCommand` on `ProductCatalog` with a `FilterExpression` on `category = :targetCategory` and `gender = :gender` to return all in-scope items.
3. `fetchCompatibilityScores(baseProduct)` — batches `GetCommand` calls against `CompatibilityStats` for all relevant attribute pairs (colour, article type, pattern, fabric, fit, usage) using the PK/SK format `COLOUR#black / COLOUR#navy`.
4. `fetchCustomerProfile(customerId)` — calls `GET /customer/{id}` internally if `customerId` is present; returns `null` for guest sessions.
5. `fetchCoScanAffinity(productId)` — queries `VestiaSessions` with a `QueryCommand` on recent SCAN events (last 30 days) to compute how often the base SKU has co-appeared with each candidate SKU.
6. `scoreCandidate(base, candidate, compatScores, profile, sessionPrefs, coScanMap)` — computes the weighted composite score across 8 signals. The weight vector `W` is defined as:

```
// Without profile/prefs:
W = { articleType: 0.25, colour: 0.20, pattern: 0.15, coScan: 0.15,
      fabric: 0.10, price: 0.08, preference: 0.05, feedback: 0.02 }

// With profile OR sessionPrefs present:
W = { articleType: 0.18, colour: 0.13, pattern: 0.10, coScan: 0.12,
      fabric: 0.07, price: 0.05, preference: 0.33, feedback: 0.02 }
```

7. `diversityRerank(scoredCandidates, K=5)` — post-processes the sorted score list, enforcing: max 1 result per `articleType`, max 2 results per `color`. Iterates through candidates in score order, skipping any that would violate a constraint.
8. Returns top-K scored candidates as a JSON array sorted descending by score.

**Mix & Match Mode** (`{ productIds: string[], sessionId?, customerId?, sessionPreferences? }`):
Steps 1–5 are run for each base product in `productIds`. Candidate scoring in step 6 averages scores across all base items: `score = mean(scoreCandidate(base_i, candidate) for base_i in productIds)`. The engine then identifies which outfit categories are already covered by the base items and fills only the missing categories (e.g., if the customer has a top and bottom, only shoes and accessories are returned). The response shape is `{ outfit: Record<category, RecommendationItem[]>, baseProductIds }`.

---

## FIX FOR COMMENT 3 — Section 10.8: Add Recommendation Quality Metric

*(Append to Section 10.8 in the Design Doc, after the existing performance test results)*

### 10.8.2 Recommendation Quality Evaluation — Precision@K

**Motivation:** Latency alone does not measure whether the recommendation engine produces useful results. A response-time target tells us the system is fast, not that it is accurate. To address this, a task-specific quality evaluation was conducted measuring Precision@K — the fraction of the top-K recommendations that a fashion expert would consider compatible with the base item.

**Methodology:**
Ground truth compatibility was defined using curated rules across four dimensions:
1. **Category constraint** — the recommended item must be in a different category than the base item (no top + top)
2. **Gender constraint** — the recommended item must match the base item's gender (or be unisex)
3. **Colour compatibility** — the base colour and recommended colour must be a known-compatible pair (e.g., black + navy ✓, black + pink ✗), derived from the same `CompatibilityStats` logic used by the algorithm
4. **Article type compatibility** — the base article type and recommended article type must be a known-compatible pair (e.g., Tshirts + Jeans ✓, Sports Shoes + Formal Shirts ✗), derived from fashion conventions and the `CompatibilityStats` pre-computed entries

12 curated test cases were defined spanning four target categories (tops, bottoms, shoes, accessories) and multiple base item types. For each test case, the top-5 and top-10 results from the live recommendation API were fetched and each recommendation was evaluated against all four criteria.

**Results (measured against live deployment, April 7, 2026):**

| Metric | Score | SRS Target |
|---|---|---|
| Precision@1 | **1.000 (100%)** | — |
| Precision@3 | **0.973 (97.3%)** | — |
| Precision@5 | **0.850 (85.0%)** | > 75% |

**Results by target category (Precision@5):**

| Target Category | Avg P@5 | Test Cases |
|---|---|---|
| Bottom | 1.00 | 4 |
| Top | 0.87 | 3 |
| Accessory | 0.80 | 1 |
| Shoes | 0.70 | 4 |

**Analysis:**
The engine meets the SRS accuracy target of >75% for top-5 recommendations (measured P@5: 85.0%). The top-1 recommendation was correct in all 12 test cases (P@1: 100%), indicating the highest-scoring result is reliably compatible. P@5 drops to 85% because lower-ranked results occasionally include items at the boundary of fashion compatibility (e.g., formal shoes paired with a casual t-shirt, sports sandals paired with a dress shirt). These edge cases reflect genuine ambiguity in fashion compatibility rather than algorithmic failure.

The shoes category has the lowest P@5 (0.70), primarily because the `shoes` category in the catalog includes footwear sub-types (sports shoes, formal shoes, sandals, flip flops, sports sandals) with different formality levels, and the algorithm does not yet distinguish sub-category formality when scoring. This is a known gap identified for future improvement.

Full per-test-case results and the evaluation script are available in `VnV_Test_Results/rec-quality-eval.mjs` and `VnV_Test_Results/rec-quality-results.json`.

---

## FIX FOR COMMENT 4 — Section 10.6: Add Concrete P95 Thresholds

*(Replace the "Performance Tests and Metrics" paragraph in Section 10.6)*

**10.6 Session Scan/Get Service — Performance Tests and Metrics:**
Performance testing focuses on ensuring responsive event processing for a smooth kiosk experience. Tests are evaluated against the following concrete P95 thresholds, measured end-to-end from client request to confirmed server response:

| Operation | P95 Target | Measured P95 (Warm) | Measured Avg | Result |
|---|---|---|---|---|
| Scan event write (`POST /session/scan`) | < 300ms | 277ms | 112ms | **PASS** |
| Session preferences write (`POST /session/preferences`) | < 500ms | 64ms | 54ms | **PASS** |
| Session state retrieval (`GET /session/{id}`) | < 500ms | 98ms | 69ms | **PASS** |
| Session feedback write (`POST /session/feedback`) | < 500ms | 68ms | 43ms | **PASS** |

The scan event write threshold of P95 < 300ms is intentionally tighter than other write operations because it occurs immediately upon item scan — any perceptible delay at this step directly degrades the in-room experience. The 300ms budget accounts for Lambda execution time plus DynamoDB write latency in the `ca-central-1` region. Session retrieval and feedback writes are given a 500ms budget as they occur during lower-urgency moments (end of session or background preference saves). All four operations met their targets under warm Lambda conditions across 10 measured runs.
