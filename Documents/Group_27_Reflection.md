# Vestia — The Retail Experience Platform (RXM)

**Course:** COMPSCI 4ZP6A/B — Capstone Project, McMaster University, Winter 2026
**Group:** Team 27
**GitHub:** https://github.com/saagarracharla/Vestia_The-Retail-Experience-Platform_RXM

| Member | Role | Email |
|---|---|---|
| Saagar Racharla | Data Engineer & Solutions Architect | racharls@mcmaster.ca |
| Rushit Shah | Software & Platform Engineer | shahr73@mcmaster.ca |
| Manush Patel | Backend Engineer & BI Analytics Lead | patem190@mcmaster.ca |
| Mahdi Mohammad | Machine Learning & AI Engineer | moham52@mcmaster.ca |
| Garv Rastogi | Frontend & UI/UX Engineer | rastogig@mcmaster.ca |
| Partik Singh Dev | Backend & API Developer | devp2@mcmaster.ca |
| Gurmandeep Johal | Frontend & QA Tester | johalg11@mcmaster.ca |

---

## Project Overview

Vestia is a smart fitting room platform deployed as a kiosk inside retail changing rooms. Customers scan clothing items using the kiosk interface, receive real-time outfit recommendations, request alternate sizes or colours from staff, save and share outfits, and provide feedback — all without leaving the fitting room. Staff access a separate dashboard to receive and fulfill requests, while store managers view analytics on session activity, top items, and fulfillment rates. The platform operates entirely on a serverless AWS backend with no local server required.

---

## Why Vestia Is Highly Complex

Vestia is not a CRUD application. It required the integration of multiple non-trivial technical subsystems, each with distinct complexity, coordinated across a seven-person team simultaneously.

**Serverless AWS Architecture at Scale.** The backend comprises 14 AWS Lambda functions written in Node.js 22 ESM, connected through an API Gateway HTTP API v2, backed by four DynamoDB tables and S3. Every function is independently deployed to ca-central-1 with no shared runtime state. Managing cold starts, ESM module resolution, IAM permission boundaries, and environment configuration across 14 independent compute units — while keeping the system consistent — presented significant operational overhead.

**Event-Sourced Data Model.** The `VestiaSessions` table uses an immutable append-only event log with a dual-write pattern to maintain a parallel request queue. Rather than mutating records in place, every action (scan, request, feedback, delivery) is recorded as a new event. Session state is derived by replaying events at query time. This design enables complete audit trails and powers the analytics subsystem, but it requires careful thought about read patterns, projection logic, and eventual consistency.

**Production-Scale Product Catalog.** The `ProductCatalog` table contains 44,446 real clothing products enriched from the Myntra dataset via an S3 ingestion pipeline. Attributes were normalized, cleaned, and enriched before loading. The recommendation engine queries this full catalog at runtime, making query efficiency a genuine engineering constraint rather than a theoretical one.

**Real-Time Request Lifecycle.** Item requests move through a multi-stage lifecycle: `QUEUED → CLAIMED → DELIVERED`, with auto-scan-on-delivery triggered when staff mark a request fulfilled. This required consistent state management across two DynamoDB tables, event propagation to the kiosk UI, and handling edge cases such as concurrent claim conflicts and re-delivery attempts.

**Live Co-Scan Affinity.** One of the recommendation signals computes, at query time, which items have historically appeared together across sessions within a rolling 30-day window. This requires scanning recent session events and aggregating co-occurrence counts dynamically — a non-trivial read pattern against an event-sourced table.

**Pre-Computed Compatibility Index.** The `CompatibilityStats` DynamoDB table contains 1,062+ entries encoding pairwise compatibility across six fashion dimensions: colour pairs, article type pairs, pattern pairs, fabric pairs, fit pairs, and usage pairs. Populating this table required domain research and a data generation pipeline. Without this pre-computation, the recommendation engine would require expensive real-time compatibility lookups.

---

## Algorithmic Innovation: The Recommendation Engine

The Vestia recommendation engine is a deterministic, multi-signal weighted scoring pipeline. Unlike a black-box machine learning model, every recommendation score is fully explainable and reproducible given the same inputs.

**Pipeline Overview.** For a given base item (the item a customer has scanned), the engine fetches the full product catalog and scores each candidate item against eight independent signals. These scores are combined into a weighted composite, re-ranked for diversity, and the top results are returned.

**The Eight Scoring Signals.**

1. *Article Type Compatibility* — Looks up the (base article type, candidate article type) pair in `CompatibilityStats`. Paired types (e.g., jeans + top, kurta + dupatta) score high; incompatible types score near zero.
2. *Colour Compatibility* — Looks up the colour pair in `CompatibilityStats`. Matching or complementary colours score high; clashing combinations are penalized.
3. *Pattern Compatibility* — Scores based on pattern pair compatibility (e.g., solid pairs well with most patterns; two bold prints penalized).
4. *Historical Co-Scan Affinity* — Queries the last 30 days of `VestiaSessions` events to find how frequently the base item and candidate item have co-appeared across sessions. Frequently paired items receive a boosted signal grounded in real customer behaviour.
5. *Fabric Compatibility* — Looks up fabric pair compatibility (e.g., denim + cotton scores well; heavy fabrics against each other are penalized).
6. *Price Proximity* — Scores candidates whose price is within a reasonable range of the base item's price, using a graduated penalty for increasing price distance.
7. *Composite Preference Signal* — A weighted sub-pipeline of seven preference dimensions derived from the customer's profile and/or in-session interactions (detailed below).
8. *Live In-Session Feedback Signal* — If the customer has explicitly liked or disliked items during the current session, those signals are propagated to update candidate scores in real time.

**The Preference Signal Sub-Pipeline.** The composite preference signal is itself a weighted combination of seven sub-signals, each with a hit weight and a miss weight:

| Sub-Signal | Hit Weight | Miss Weight |
|---|---|---|
| Session colour preference | 1.00 | 0.05 |
| Profile-derived colour | 0.75 | 0.05 |
| Style/usage match | 1.00 | 0.10 |
| Pattern preference | 1.00 | 0.10 |
| Fabric preference | 1.00 | 0.10 |
| Article type affinity | 0.85 | 0.35 |
| Price range alignment | 1.00 / 0.60 / 0.20 | — |

Price range alignment uses a three-tier structure: items within ±50% of the customer's average spend score 1.0; items within ±100% score 0.6; items outside that range score 0.2.

**Dynamic Weight Shifting.** The most architecturally interesting design decision is how the engine handles the presence or absence of customer data. When no customer profile and no in-session preferences exist, the composite preference signal is assigned a weight of 5% of the total score — ensuring it does not dominate with sparse data. When a customer profile or in-session preferences are available, the preference signal weight jumps to 33%, becoming the single dominant signal, while all other seven signal weights are proportionally reduced. This dynamic rebalancing means the engine gracefully degrades to compatibility-first behaviour for anonymous users and shifts toward personalization for known customers — without requiring two separate models.

**Diversity Re-Ranking.** After scoring, a post-processing step enforces diversity constraints: at most one recommendation per article type and at most two recommendations per colour. This prevents the engine from returning five blue tops when a customer scans a pair of jeans.

**Mix and Match Mode.** When a customer selects multiple base items (outfit builder), the engine scores all candidates against every selected base item simultaneously, averaging the scores across base items. It then fills all missing outfit categories in a single call, ensuring the returned set completes the outfit rather than duplicating represented categories.

**Verification.** All 20 functional recommendation tests passed against the live deployment. Correctness was verified for score ordering, category constraint enforcement, and diversity rule application.

---

## Requirements Completion

| Requirement | Priority | Completion |
|---|---|---|
| Changeroom Session & Item Identification | P0 | 100% |
| Request Additional Size/Colour (QUEUED → CLAIMED → DELIVERED lifecycle) | P0 | 100% |
| User Feedback & Analytics | P0 | 100% |
| Rule-Based Outfit Recommendation Engine | P1 | 100% |
| Core Retail Analytics (sessions, scans, fulfillment, top items/sizes/colours, 7/30/90d) | P1 | 100% |
| Customer Profile Personalization (purchase history, derivedStyle, loyalty login) | P1 | 100% |
| Save & Share Outfits (6-char share code, public outfit URL) | P1 | 100% |
| Authentication & Identity Service | P1 | 60% |
| Mix & Match Outfit Builder | P2 | 100% |

**Authentication & Identity Service (60%):** Email-based customer lookup is fully implemented. However, JWT token issuance and role-based access control (RBAC) middleware were not completed due to time constraints in the final sprint. Staff and manager access is currently gated at the API level by endpoint separation rather than token-based authorization. This is a known gap and a clear path for future work.

---

## Performance Results

| Endpoint | P95 Latency | Target | Status |
|---|---|---|---|
| Session scan write | 277 ms | < 300 ms | Pass |
| Session retrieval | 98 ms | < 500 ms | Pass |
| Request creation | 277 ms | < 2000 ms | Pass |
| Customer profile fetch | 261 ms | < 300 ms | Pass |
| Analytics load | 97 ms | < 3000 ms | Pass |
| Recommendation engine | 1500 ms | < 1000 ms | Fail |

---

## Highlights

- A fully working, end-to-end retail platform was built and deployed on AWS, serving real requests from a live kiosk interface to a live staff dashboard with no mocked backend.
- The recommendation engine produces genuinely personalized outfit suggestions using a novel multi-signal architecture that transitions gracefully between anonymous and identified customers.
- Event sourcing as a data model proved highly effective: the same event log that powers real-time session state also powers the analytics subsystem and the co-scan affinity signal — no separate analytics pipeline was needed.
- 44,446 real products were enriched and loaded into production DynamoDB, making the platform's catalog representative of a real-world retail deployment.
- All P0 and P1 features (except the authentication gap noted above) are functional and verified against the live deployment.

## Lowlights

- The recommendation engine's P95 latency of 1500 ms exceeds the 1000 ms target. The bottleneck is a full catalog scan at query time. A pre-filtering step using a DynamoDB GSI on category and gender would reduce the candidate set by approximately 90% before scoring begins — this was designed but not implemented due to time.
- Authentication was simplified. JWT token issuance and RBAC middleware were not completed. In a production context, unauthenticated access to staff and manager endpoints would be a security gap.
- Testing was entirely manual: live API calls were made against the deployed environment. No automated test framework (unit, integration, or end-to-end) was established, which created friction when verifying regressions after changes.
- Checkout and payment integration (Stripe) was descoped early in the project. While never a P0 or P1 requirement, it would have been a meaningful addition to the platform's viability.

---

## What We Learned

**Serverless architecture is powerful but operationally demanding.** Lambda cold starts, ESM module loading, and per-function IAM configuration require more careful management than a monolithic server. Understanding the tradeoffs between cold-start latency, per-invocation cost, and isolation was a recurring theme throughout the project.

**Event sourcing is a genuinely useful pattern beyond the textbook.** Representing all session activity as an immutable event log — rather than updating a row in place — gave the platform capabilities that would have required a separate analytics database otherwise. The dual-read pattern (reconstruct state for the kiosk; aggregate events for analytics) emerged naturally from the model.

**Explainable algorithms have real engineering value.** Designing the recommendation engine as a deterministic scoring pipeline, rather than training a model, made debugging and verification tractable. When a recommendation seemed wrong, the score breakdown identified the responsible signal immediately. This approach would not scale to very large catalogs without pre-filtering, but at 44k products it was entirely viable.

**Pre-computing compatibility data is essential for runtime performance.** The decision to build the `CompatibilityStats` table ahead of deployment meant that every compatibility lookup during scoring was a single DynamoDB read rather than a computation. This architectural choice is what made the recommendation engine fast enough to be usable.

**Seven-person coordination requires explicit interface contracts.** With separate teams on frontend, backend, data pipeline, and infrastructure, work could only proceed in parallel when API contracts were agreed and documented before implementation began. Where this discipline slipped, integration work created delays that compressed the final sprint.

**Scoping is a technical skill.** The decision to descope checkout, to defer GSI-based pre-filtering, and to accept the authentication gap were not failures — they were deliberate tradeoffs that allowed the core platform to ship fully functional. Learning to make those tradeoffs explicitly and document them honestly is as important as the implementation itself.
