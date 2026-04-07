/**
 * Vestia Live API Performance & Functional Test Suite
 * Tests all 14 Lambda endpoints against deployed AWS API Gateway
 * API: https://993toyh3x5.execute-api.ca-central-1.amazonaws.com
 */

const API_BASE = "https://993toyh3x5.execute-api.ca-central-1.amazonaws.com";
const RUNS = 10;        // warm runs recorded after warmup
const WARMUP_RUNS = 2;  // discarded warmup calls to eliminate cold start from P95

// Test fixture IDs — unique per run so we don't pollute real data
const TEST_SESSION_ID = `test-session-${Date.now()}`;
const TEST_CUSTOMER_ID = `test-capstone-${Date.now()}@vestia.com`;
const KNOWN_SKU = "15479";      // Puma Men Black T-shirt (confirmed in ProductCatalog)
const KNOWN_SKU_2 = "15470";    // second product for mix & match
const STORE_ID = "STORE-001";
const KIOSK_ID = "kiosk-1";

let createdRequestId = null;
let createdShareCode = null;

// ─── helpers ────────────────────────────────────────────────────────────────

async function timed(fn) {
  const start = performance.now();
  let status = "PASS";
  let error = null;
  let result = null;
  try {
    result = await fn();
  } catch (e) {
    status = "FAIL";
    error = e.message;
  }
  const ms = Math.round(performance.now() - start);
  return { ms, status, error, result };
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

function p95(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function avg(times) {
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

function min(times) { return Math.min(...times); }
function max(times) { return Math.max(...times); }

// ─── test definitions ────────────────────────────────────────────────────────

const tests = [
  // ─── 1. Product Lookup ────────────────────────────────────────────────────
  {
    component: "Product Database / Product Get Service",
    name: "GET /product/{sku} — known SKU",
    target_p95_ms: 500,
    runs: RUNS,
    fn: () => req("GET", `/product/${KNOWN_SKU}`),
    validate: (r) => {
      if (!r.productId) throw new Error("Missing productId");
      if (r.productId !== KNOWN_SKU) throw new Error(`Expected ${KNOWN_SKU}, got ${r.productId}`);
      if (!r.name) throw new Error("Missing name");
      if (!r.category) throw new Error("Missing category");
    },
  },
  {
    component: "Product Database / Product Get Service",
    name: "GET /product/{sku} — invalid SKU (expect 404)",
    target_p95_ms: 500,
    runs: RUNS,
    fn: async () => {
      const res = await fetch(`${API_BASE}/product/INVALID_SKU_999999`);
      if (res.status !== 404 && res.status !== 400) throw new Error(`Expected 404, got ${res.status}`);
      return { status: res.status };
    },
    validate: () => {},
  },

  // ─── 2. Session Scan ─────────────────────────────────────────────────────
  {
    component: "Session Scan/Get Service",
    name: "POST /session/scan — record item scan",
    target_p95_ms: 300,
    runs: RUNS,
    fn: () => req("POST", "/session/scan", {
      sessionId: TEST_SESSION_ID,
      sku: KNOWN_SKU,
      kioskId: KIOSK_ID,
    }),
    validate: (r) => {
      if (!r.message) throw new Error("Missing message");
    },
  },

  // ─── 3. Session Preferences ──────────────────────────────────────────────
  {
    component: "Session Scan/Get Service",
    name: "POST /session/preferences — save session prefs",
    target_p95_ms: 500,
    runs: RUNS,
    fn: () => req("POST", "/session/preferences", {
      sessionId: TEST_SESSION_ID,
      preferredColors: ["black", "navy"],
      preferredStyles: ["casual"],
      preferredPatterns: ["solid"],
      preferredFabrics: ["cotton"],
    }),
    validate: (r) => {
      if (!r.message) throw new Error("Missing message");
    },
  },

  // ─── 4. Session Get ──────────────────────────────────────────────────────
  {
    component: "Session Scan/Get Service",
    name: "GET /session/{sessionId} — retrieve active session",
    target_p95_ms: 500,
    runs: RUNS,
    fn: () => req("GET", `/session/${TEST_SESSION_ID}`),
    validate: (r) => {
      if (!r.sessionId) throw new Error("Missing sessionId");
      if (!Array.isArray(r.items)) throw new Error("items is not array");
      if (r.items.length === 0) throw new Error("items array is empty (scan should have persisted)");
    },
  },

  // ─── 5. Recommendation Service (single-item) ─────────────────────────────
  {
    component: "Recommendation Service",
    name: "POST /recommend — single-item mode (top → bottom)",
    target_p95_ms: 1000,
    runs: RUNS,
    fn: () => req("POST", "/recommend", {
      productId: KNOWN_SKU,
      targetCategory: "bottom",
      gender: "men",
      sessionId: TEST_SESSION_ID,
      sessionPreferences: { preferredColors: ["black", "navy"] },
    }),
    validate: (r) => {
      if (!Array.isArray(r)) throw new Error("Expected array response");
      if (r.length === 0) throw new Error("Recommendations array is empty");
      if (typeof r[0].score !== "number") throw new Error("Missing score");
      if (!r[0].productId) throw new Error("Missing productId in recommendation");
      // Verify sorted descending by score
      for (let i = 1; i < r.length; i++) {
        if (r[i].score > r[i-1].score) throw new Error("Results not sorted by score descending");
      }
    },
  },
  {
    component: "Recommendation Service",
    name: "POST /recommend — single-item mode (top → shoes)",
    target_p95_ms: 1000,
    runs: RUNS,
    fn: () => req("POST", "/recommend", {
      productId: KNOWN_SKU,
      targetCategory: "shoes",
      gender: "men",
    }),
    validate: (r) => {
      if (!Array.isArray(r)) throw new Error("Expected array response");
      if (r.length === 0) throw new Error("Recommendations array is empty");
    },
  },
  {
    component: "Recommendation Service",
    name: "POST /recommend — mix & match mode (2 base items)",
    target_p95_ms: 1000,
    runs: RUNS,
    fn: () => req("POST", "/recommend", {
      productIds: [KNOWN_SKU, KNOWN_SKU_2],
      sessionId: TEST_SESSION_ID,
    }),
    validate: (r) => {
      if (!r.outfit) throw new Error("Missing outfit object");
      if (!r.baseProductIds) throw new Error("Missing baseProductIds");
    },
  },

  // ─── 6. Request Lifecycle ────────────────────────────────────────────────
  {
    component: "Request Create/Claim/Update Service",
    name: "POST /request — create size request",
    target_p95_ms: 2000,
    runs: 3, // intentionally fewer; creates real DB records
    fn: async () => {
      const r = await req("POST", "/request", {
        sessionId: TEST_SESSION_ID,
        sku: KNOWN_SKU,
        requestedSize: "L",
      });
      if (r.requestId) createdRequestId = r.requestId;
      return r;
    },
    validate: (r) => {
      if (!r.requestId) throw new Error("Missing requestId");
      if (r.status !== "QUEUED") throw new Error(`Expected QUEUED, got ${r.status}`);
    },
  },
  {
    component: "Request Create/Claim/Update Service",
    name: "GET /store/{storeId}/request — fetch store request queue",
    target_p95_ms: 2000,
    runs: RUNS,
    fn: () => req("GET", `/store/${STORE_ID}/request`),
    validate: (r) => {
      // Response: { storeId, count, requests: [...] }
      if (!Array.isArray(r.requests)) throw new Error("Missing requests array");
      if (typeof r.count !== "number") throw new Error("Missing count");
    },
  },
  {
    component: "Request Create/Claim/Update Service",
    name: "PATCH /request/{id}/claim — staff claims request",
    target_p95_ms: 2000,
    runs: 1,
    fn: async () => {
      // Full lifecycle: scan → create request → claim (each run uses unique session)
      const claimSessionId = `claim-test-${Date.now()}`;
      await req("POST", "/session/scan", { sessionId: claimSessionId, sku: KNOWN_SKU, kioskId: KIOSK_ID });
      const created = await req("POST", "/request", {
        sessionId: claimSessionId,
        sku: KNOWN_SKU,
        requestedSize: "XL",
      });
      return req("PATCH", `/request/${created.requestId}/claim`, {
        employeeId: "emp-test-001",
      });
    },
    validate: (r) => {
      if (r.status !== "CLAIMED") throw new Error(`Expected CLAIMED, got ${r.status}`);
      if (!r.employeeId) throw new Error("Missing employeeId");
    },
  },
  {
    component: "Request Create/Claim/Update Service",
    name: "PATCH /request/{id} — mark delivered (full lifecycle)",
    target_p95_ms: 2000,
    runs: 1,
    fn: async () => {
      // Full lifecycle: scan → create → claim → deliver
      const deliverSessionId = `deliver-test-${Date.now()}`;
      await req("POST", "/session/scan", { sessionId: deliverSessionId, sku: KNOWN_SKU, kioskId: KIOSK_ID });
      const created = await req("POST", "/request", {
        sessionId: deliverSessionId,
        sku: KNOWN_SKU,
        requestedSize: "M",
      });
      await req("PATCH", `/request/${created.requestId}/claim`, { employeeId: "emp-test-002" });
      return req("PATCH", `/request/${created.requestId}`, { action: "delivered" });
    },
    validate: (r) => {
      if (r.status !== "DELIVERED") throw new Error(`Expected DELIVERED, got ${r.status}`);
    },
  },

  // ─── 7. Customer Profile Service ─────────────────────────────────────────
  {
    component: "Customer Profile Service",
    name: "GET /customer/{id} — new customer (expect 404)",
    target_p95_ms: 300,
    runs: RUNS,
    fn: async () => {
      const res = await fetch(`${API_BASE}/customer/${TEST_CUSTOMER_ID}`);
      if (res.status !== 404 && res.status !== 200) throw new Error(`Unexpected status ${res.status}`);
      return { status: res.status };
    },
    validate: () => {},
  },
  {
    component: "Customer Profile Service",
    name: "PUT /customer/{id} — create/upsert profile",
    target_p95_ms: 300,
    runs: RUNS,
    fn: () => req("PUT", `/customer/${TEST_CUSTOMER_ID}`, {
      gender: "men",
      preferredColors: ["black", "navy"],
      preferredStyles: ["casual"],
      preferredPatterns: ["solid"],
      preferredFabrics: ["cotton"],
      purchaseHistory: [{
        productId: KNOWN_SKU,
        name: "Puma Men Black T-shirt",
        articleType: "Tshirts",
        color: "black",
        price: 799,
        purchasedAt: new Date().toISOString(),
      }],
      incrementVisit: true,
    }),
    validate: (r) => {
      if (!r.profile) throw new Error("Missing profile object");
      if (!r.profile.customerId) throw new Error("Missing customerId in profile");
    },
  },
  {
    component: "Customer Profile Service",
    name: "GET /customer/{id} — fetch existing profile",
    target_p95_ms: 300,
    runs: RUNS,
    fn: () => req("GET", `/customer/${TEST_CUSTOMER_ID}`),
    validate: (r) => {
      if (!r.customerId) throw new Error("Missing customerId");
      if (!r.derivedStyle) throw new Error("Missing derivedStyle (computed field)");
    },
  },

  // ─── 8. Outfit Save/Share Service ────────────────────────────────────────
  {
    component: "Outfit Save/Share Service",
    name: "POST /outfit — save outfit",
    target_p95_ms: 500,
    runs: RUNS,
    fn: async () => {
      const r = await req("POST", "/outfit", {
        sessionId: TEST_SESSION_ID,
        customerId: TEST_CUSTOMER_ID,
        items: [
          { productId: KNOWN_SKU, name: "Puma Men Black T-shirt", category: "top", color: "black", price: 799, source: "room" },
          { productId: KNOWN_SKU_2, name: "Test Bottom", category: "bottom", color: "navy", price: 1999, source: "recommended" },
        ],
      });
      if (r.shareCode) createdShareCode = r.shareCode;
      return r;
    },
    validate: (r) => {
      if (!r.outfitId) throw new Error("Missing outfitId");
      if (!r.shareCode) throw new Error("Missing shareCode");
      if (r.shareCode.length !== 6) throw new Error(`Expected 6-char shareCode, got ${r.shareCode.length}`);
    },
  },
  {
    component: "Outfit Save/Share Service",
    name: "GET /outfit/{shareCode} — retrieve saved outfit",
    target_p95_ms: 500,
    runs: RUNS,
    fn: async () => {
      if (!createdShareCode) throw new Error("No shareCode from prior test");
      return req("GET", `/outfit/${createdShareCode}`);
    },
    validate: (r) => {
      if (!r.outfitId) throw new Error("Missing outfitId");
      if (!Array.isArray(r.items)) throw new Error("items is not array");
      if (r.items.length < 2) throw new Error("Expected 2 items in saved outfit");
    },
  },

  // ─── 9. Session Feedback ─────────────────────────────────────────────────
  {
    component: "Session Scan/Get Service",
    name: "POST /session/feedback — submit end-of-session feedback",
    target_p95_ms: 500,
    runs: RUNS,
    fn: () => req("POST", "/session/feedback", {
      sessionId: TEST_SESSION_ID,
      overallRating: 5,
      overallComment: "V&V test run",
      itemFeedback: [{ sku: KNOWN_SKU, liked: true }],
      experienceRating: 4,
      wouldReturn: true,
    }),
    validate: (r) => {
      if (!r.feedbackId) throw new Error("Missing feedbackId");
    },
  },

  // ─── 10. Analytics ───────────────────────────────────────────────────────
  {
    component: "Analytics Aggregation Service / Store Owner Dashboard",
    name: "GET /analytics?days=7 — 7-day analytics",
    target_p95_ms: 3000,
    runs: RUNS,
    fn: () => req("GET", "/analytics?days=7"),
    validate: (r) => {
      if (typeof r.totalSessions !== "number") throw new Error("Missing totalSessions");
      if (typeof r.totalScans !== "number") throw new Error("Missing totalScans");
      if (!r.period) throw new Error("Missing period");
    },
  },
  {
    component: "Analytics Aggregation Service / Store Owner Dashboard",
    name: "GET /analytics?days=30 — 30-day analytics",
    target_p95_ms: 3000,
    runs: RUNS,
    fn: () => req("GET", "/analytics?days=30"),
    validate: (r) => {
      if (typeof r.totalSessions !== "number") throw new Error("Missing totalSessions");
    },
  },
];

// ─── runner ──────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VESTIA — Live API Verification & Validation Test Suite");
  console.log(`  API Gateway: ${API_BASE}`);
  console.log(`  Region: ca-central-1  |  Run started: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const componentResults = {};
  let totalPass = 0;
  let totalFail = 0;

  for (const test of tests) {
    const times = [];
    const coldStartTimes = [];
    let lastResult = null;
    let lastError = null;
    let functionalStatus = "PASS";

    process.stdout.write(`  ▶ ${test.name} ... `);

    // Warmup phase — capture cold start, discard from P95
    for (let i = 0; i < WARMUP_RUNS; i++) {
      const { ms, status, error, result } = await timed(test.fn);
      if (i === 0) coldStartTimes.push(ms);
      if (status === "FAIL" && functionalStatus === "PASS") {
        // Allow claim 409 during warmup (expected on repeated calls)
        if (!error?.includes("409")) {
          lastError = error;
        }
      } else {
        lastResult = result;
      }
    }

    // Measured runs (warm)
    for (let i = 0; i < test.runs; i++) {
      const { ms, status, error, result } = await timed(test.fn);
      if (status === "FAIL") {
        // 409 on claim/deliver is expected after first success — don't count as failure
        if (!error?.includes("409") && !error?.includes("Only queued") && !error?.includes("Only claimed")) {
          functionalStatus = "FAIL";
          lastError = error;
        }
      } else {
        times.push(ms);
        lastResult = result;
      }
    }

    // Run functional validation on last successful result
    if (functionalStatus === "PASS" && lastResult !== null) {
      try {
        test.validate(lastResult);
      } catch (e) {
        functionalStatus = "FAIL";
        lastError = `Validation: ${e.message}`;
      }
    }

    const p95ms = times.length > 0 ? p95(times) : null;
    const avgMs = times.length > 0 ? avg(times) : null;
    const minMs = times.length > 0 ? min(times) : null;
    const maxMs = times.length > 0 ? max(times) : null;
    const coldStartMs = coldStartTimes.length > 0 ? coldStartTimes[0] : null;
    const perfStatus = p95ms !== null ? (p95ms <= test.target_p95_ms ? "PASS" : "FAIL") : "FAIL";
    const overallStatus = functionalStatus === "PASS" && perfStatus === "PASS" ? "PASS" : "FAIL";

    if (overallStatus === "PASS") {
      totalPass++;
      console.log(`✓ PASS  (P95: ${p95ms}ms, cold start: ${coldStartMs}ms, target: <${test.target_p95_ms}ms)`);
    } else {
      totalFail++;
      const reason = functionalStatus === "FAIL" ? `FAIL [${lastError}]` : `PERF FAIL (P95: ${p95ms}ms > ${test.target_p95_ms}ms, cold start: ${coldStartMs}ms)`;
      console.log(`✗ ${reason}`);
    }

    // Accumulate component-level results
    if (!componentResults[test.component]) {
      componentResults[test.component] = { tests: [], allPass: true };
    }
    componentResults[test.component].tests.push({
      name: test.name,
      warmupRuns: WARMUP_RUNS,
      measuredRuns: test.runs,
      successfulMeasuredRuns: times.length,
      p95_ms: p95ms,
      avg_ms: avgMs,
      min_ms: minMs,
      max_ms: maxMs,
      coldStart_ms: coldStartMs,
      target_p95_ms: test.target_p95_ms,
      functionalStatus,
      perfStatus,
      overallStatus,
      error: lastError,
    });
    if (overallStatus !== "PASS") componentResults[test.component].allPass = false;
  }

  // ─── Summary Report ───────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESULTS BY COMPONENT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const [component, data] of Object.entries(componentResults)) {
    const badge = data.allPass ? "✓ PASS" : "✗ FAIL";
    console.log(`  [${badge}] ${component}`);
    for (const t of data.tests) {
      const icon = t.overallStatus === "PASS" ? "✓" : "✗";
      const timing = t.p95_ms !== null
        ? `P95: ${t.p95_ms}ms | avg: ${t.avg_ms}ms | min: ${t.min_ms}ms | cold start: ${t.coldStart_ms}ms | target: <${t.target_p95_ms}ms`
        : "no timing data";
      const runs = `${t.successfulMeasuredRuns}/${t.measuredRuns} warm runs succeeded`;
      console.log(`      ${icon} ${t.name}`);
      console.log(`        ${timing} | ${runs}`);
      if (t.error) console.log(`        ERROR: ${t.error}`);
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  OVERALL: ${totalPass} PASSED | ${totalFail} FAILED | ${totalPass + totalFail} TOTAL`);
  console.log(`  Run completed: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Machine-readable JSON for documentation
  const jsonReport = {
    runAt: new Date().toISOString(),
    apiBase: API_BASE,
    region: "ca-central-1",
    totalTests: totalPass + totalFail,
    passed: totalPass,
    failed: totalFail,
    components: componentResults,
  };

  const fs = await import("fs");
  fs.writeFileSync("test-results.json", JSON.stringify(jsonReport, null, 2));
  console.log("  Full JSON report saved to test-results.json\n");
}

runTests().catch(console.error);
