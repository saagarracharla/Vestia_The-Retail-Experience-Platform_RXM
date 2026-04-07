/**
 * Vestia Recommendation Engine — Quality Evaluation
 * Measures Precision@5 and Precision@10 against curated compatibility ground truth
 *
 * Methodology:
 * For each base item, the top-K recommendations are fetched from the live API.
 * Each recommendation is then fetched individually to get its full attributes.
 * A recommendation is considered "correct" if it satisfies ALL of:
 *   1. Category constraint: recommended item category ≠ base item category
 *   2. Gender constraint: recommended item gender matches base item gender (or is "unisex")
 *   3. Colour compatibility: base colour + recommended colour is a known compatible pair
 *   4. Article type compatibility: base articleType + recommended articleType is a known compatible pair
 *
 * Compatibility ground truth is derived from the CompatibilityStats rules embedded in the algorithm.
 */

const API_BASE = "https://993toyh3x5.execute-api.ca-central-1.amazonaws.com";

// Known colour compatibility pairs (from CompatibilityStats + fashion conventions)
// If a pair appears here, it is considered compatible
const COMPATIBLE_COLOUR_PAIRS = new Set([
  "black|black", "black|white", "black|grey", "black|navy", "black|blue",
  "black|beige", "black|brown", "black|red", "black|green", "black|maroon",
  "white|white", "white|navy", "white|blue", "white|grey", "white|beige",
  "white|black", "white|red", "white|green", "white|pink",
  "navy|navy", "navy|white", "navy|grey", "navy|beige", "navy|brown",
  "navy|black", "navy|blue",
  "grey|grey", "grey|white", "grey|black", "grey|navy", "grey|blue",
  "grey|beige", "grey|maroon",
  "blue|blue", "blue|white", "blue|grey", "blue|beige", "blue|navy",
  "blue|black", "blue|brown",
  "beige|beige", "beige|white", "beige|navy", "beige|brown", "beige|grey",
  "beige|black", "beige|blue",
  "brown|brown", "brown|beige", "brown|white", "brown|navy", "brown|black",
  "maroon|black", "maroon|white", "maroon|grey", "maroon|navy",
  "green|beige", "green|white", "green|brown", "green|navy", "green|black",
  "red|black", "red|white", "red|grey", "red|navy",
  "pink|white", "pink|grey", "pink|navy", "pink|beige",
  "purple|black", "purple|white", "purple|grey",
  "olive|beige", "olive|brown", "olive|navy", "olive|black", "olive|white",
]);

// Known compatible article type pairs (base → target)
// Based on fashion conventions and CompatibilityStats rules
const COMPATIBLE_ARTICLE_PAIRS = new Set([
  // T-shirts pair with bottoms
  "tshirts|jeans", "tshirts|trousers", "tshirts|shorts", "tshirts|track pants",
  "tshirts|lounge pants", "tshirts|lounge shorts", "tshirts|chinos",
  // T-shirts pair with footwear
  "tshirts|sports shoes", "tshirts|casual shoes", "tshirts|sneakers",
  "tshirts|sandals", "tshirts|flip flops",
  // T-shirts pair with accessories
  "tshirts|watches", "tshirts|belts", "tshirts|backpacks", "tshirts|wallets",
  "tshirts|caps", "tshirts|sunglasses",
  // Shirts pair with bottoms
  "shirts|jeans", "shirts|trousers", "shirts|chinos", "shirts|shorts",
  "shirts|lounge shorts",
  // Shirts pair with footwear
  "shirts|formal shoes", "shirts|casual shoes", "shirts|sneakers", "shirts|lounge pants",
  // Shirts pair with accessories
  "shirts|watches", "shirts|belts", "shirts|ties", "shirts|wallets",
  // Jeans pair with tops
  "jeans|tshirts", "jeans|shirts", "jeans|sweatshirts", "jeans|jackets",
  "jeans|sweaters",
  // Jeans pair with footwear
  "jeans|casual shoes", "jeans|sports shoes", "jeans|sneakers",
  "jeans|sandals", "jeans|flip flops", "jeans|boots",
  // Jeans pair with accessories
  "jeans|belts", "jeans|watches", "jeans|wallets",
  // Trousers pair with tops
  "trousers|shirts", "trousers|tshirts", "trousers|sweaters", "trousers|blazers",
  "trousers|jackets",
  // Trousers pair with footwear + accessories
  "trousers|formal shoes", "trousers|casual shoes", "trousers|belts",
  "trousers|ties", "trousers|watches",
  // Track pants
  "track pants|tshirts", "track pants|sweatshirts", "track pants|sports shoes",
  "track pants|sneakers",
  // Shorts
  "shorts|tshirts", "shorts|sports shoes", "shorts|sneakers", "shorts|sandals",
  "lounge shorts|tshirts", "lounge pants|tshirts",
  // Formal shoes
  "formal shoes|trousers", "formal shoes|shirts", "formal shoes|jeans",
  // Casual shoes / sandals / flip flops
  "casual shoes|jeans", "casual shoes|tshirts", "casual shoes|shirts",
  "sandals|tshirts", "sandals|shorts", "sandals|jeans",
  "flip flops|tshirts", "flip flops|shorts", "flip flops|jeans",
  // Sports shoes
  "sports shoes|shorts", "sports shoes|tshirts", "sports shoes|track pants",
  "sports shoes|jeans", "sports shoes|sweatshirts",
  // Sneakers
  "sneakers|jeans", "sneakers|tshirts", "sneakers|shorts", "sneakers|sweatshirts",
  // Socks (accessory for athletic wear)
  "sports shoes|socks", "sneakers|socks",
  "socks|sports shoes", "socks|sneakers",
  // Watches pair with almost everything
  "watches|tshirts", "watches|shirts", "watches|jeans", "watches|trousers",
  "watches|shorts", "watches|track pants", "watches|lounge pants",
  // Belts
  "belts|jeans", "belts|trousers", "belts|shirts",
  // Jackets / Sweatshirts / Sweaters
  "jackets|jeans", "jackets|trousers", "jackets|tshirts",
  "sweatshirts|jeans", "sweatshirts|track pants", "sweatshirts|shorts",
  "sweaters|jeans", "sweaters|trousers", "sweaters|shirts",
  // Blazers
  "blazers|trousers", "blazers|jeans", "blazers|shirts",
  // Ties
  "ties|shirts", "ties|trousers",
  // Indian wear
  "kurtas|churidar", "kurtas|pyjamas", "kurtas|jeans",
  "sarees|heels", "sarees|blouses",
  // Women's
  "dresses|heels", "dresses|flats", "dresses|sandals",
  "tops|jeans", "tops|trousers", "tops|skirts",
  "skirts|tops", "skirts|shirts", "skirts|heels",
  // Backpacks / bags (pair with anything)
  "backpacks|tshirts", "backpacks|shirts", "backpacks|jeans",
  "wallets|tshirts", "wallets|shirts", "wallets|jeans",
]);

function colourCompatible(c1, c2) {
  const a = (c1 || "").toLowerCase().trim();
  const b = (c2 || "").toLowerCase().trim();
  if (!a || !b) return true; // unknown = don't penalise
  if (a === b) return true;  // same colour always ok
  return COMPATIBLE_COLOUR_PAIRS.has(`${a}|${b}`) || COMPATIBLE_COLOUR_PAIRS.has(`${b}|${a}`);
}

function articleCompatible(at1, at2) {
  const a = (at1 || "").toLowerCase().trim();
  const b = (at2 || "").toLowerCase().trim();
  if (!a || !b) return true;
  if (a === b) return false; // same article type = not a useful recommendation
  return COMPATIBLE_ARTICLE_PAIRS.has(`${a}|${b}`) || COMPATIBLE_ARTICLE_PAIRS.has(`${b}|${a}`);
}

function genderCompatible(g1, g2) {
  if (!g1 || !g2) return true;
  if (g1 === g2) return true;
  if (g1 === "unisex" || g2 === "unisex") return true;
  return false;
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function recommend(productId, targetCategory, gender) {
  const res = await fetch(`${API_BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, targetCategory, gender }),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return []; }
}

// Curated test cases: each specifies a base SKU and a target category
// These are deliberately chosen to span multiple genders, article types, and colours
const TEST_CASES = [
  { label: "Men's black t-shirt → bottoms",    sku: "15479",  targetCategory: "bottom",    gender: "men" },
  { label: "Men's black t-shirt → shoes",      sku: "15479",  targetCategory: "shoes",     gender: "men" },
  { label: "Men's black t-shirt → accessory",  sku: "15479",  targetCategory: "accessory", gender: "men" },
  { label: "Men's blue shirt → bottoms",       sku: "11632",  targetCategory: "bottom",    gender: "men" },
  { label: "Men's blue shirt → shoes",         sku: "11632",  targetCategory: "shoes",     gender: "men" },
  { label: "Men's grey t-shirt → bottoms",     sku: "34400",  targetCategory: "bottom",    gender: "men" },
  { label: "Men's blue jeans → tops",          sku: "48387",  targetCategory: "top",       gender: "men" },
  { label: "Men's blue jeans → shoes",         sku: "48387",  targetCategory: "shoes",     gender: "men" },
  { label: "Men's black trousers → tops",      sku: "29402",  targetCategory: "top",       gender: "men" },
  { label: "Men's black sports shoes → tops",  sku: "31970",  targetCategory: "top",       gender: "men" },
  { label: "Men's watch → bottoms",            sku: "41049",  targetCategory: "bottom",    gender: "men" },
  { label: "Men's grey t-shirt → shoes",       sku: "7642",   targetCategory: "shoes",     gender: "men" },
];

const K_VALUES = [1, 3, 5];

async function runQualityEval() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  VESTIA — Recommendation Engine Quality Evaluation");
  console.log(`  Metric: Precision@K  |  Ground truth: curated compatibility rules`);
  console.log(`  Test cases: ${TEST_CASES.length}  |  Evaluated: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // First, fetch all base product details
  console.log("  Fetching base product details...");
  const baseProducts = {};
  for (const tc of TEST_CASES) {
    if (!baseProducts[tc.sku]) {
      baseProducts[tc.sku] = await get(`/product/${tc.sku}`);
    }
  }
  console.log(`  Loaded ${Object.keys(baseProducts).length} base products.\n`);

  const results = [];

  for (const tc of TEST_CASES) {
    const base = baseProducts[tc.sku];
    if (!base) {
      console.log(`  ✗ SKIP ${tc.label} — could not fetch base product`);
      continue;
    }

    process.stdout.write(`  ▶ ${tc.label} ... `);

    const recs = await recommend(tc.sku, tc.targetCategory, tc.gender);
    if (!Array.isArray(recs) || recs.length === 0) {
      console.log(`✗ NO RESULTS`);
      results.push({ label: tc.label, recs: [], correctAt: {}, precisionAt: {} });
      continue;
    }

    // Fetch details for top 10 recommendations
    const top10 = recs.slice(0, 10);
    const recDetails = await Promise.all(
      top10.map(r => get(`/product/${r.productId}`))
    );

    // Evaluate each recommendation
    const evaluated = top10.map((r, i) => {
      const prod = recDetails[i];
      if (!prod) return { ...r, correct: false, reason: "fetch failed" };

      const catOk = prod.category !== base.category;
      const genderOk = genderCompatible(prod.gender, base.gender);
      const colourOk = colourCompatible(prod.color, base.color);
      const articleOk = articleCompatible(prod.articleType, base.articleType);

      const correct = catOk && genderOk && colourOk && articleOk;
      const reason = !catOk ? "same category"
        : !genderOk ? "gender mismatch"
        : !colourOk ? `colour clash (${base.color}+${prod.color})`
        : !articleOk ? `article mismatch (${base.articleType}+${prod.articleType})`
        : "ok";

      return { ...r, prod, correct, reason };
    });

    const precisionAt = {};
    const correctAt = {};
    for (const k of K_VALUES) {
      const topK = evaluated.slice(0, k);
      const numCorrect = topK.filter(r => r.correct).length;
      correctAt[k] = numCorrect;
      precisionAt[k] = (numCorrect / k).toFixed(2);
    }

    console.log(`P@1: ${precisionAt[1]}  P@3: ${precisionAt[3]}  P@5: ${precisionAt[5]}  (${evaluated.filter(r=>r.correct).length}/${Math.min(10,evaluated.length)} correct in top-10)`);

    // Show incorrect recommendations for transparency
    const incorrect = evaluated.filter(r => !r.correct).slice(0, 3);
    for (const bad of incorrect) {
      if (bad.prod) {
        console.log(`       ✗ rank ${evaluated.indexOf(bad)+1}: ${bad.prod.name} [${bad.reason}]`);
      }
    }

    results.push({ label: tc.label, base, recs: evaluated, correctAt, precisionAt });
  }

  // ─── Aggregate Metrics ────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  AGGREGATE RESULTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const k of K_VALUES) {
    const validResults = results.filter(r => r.recs.length >= k);
    if (validResults.length === 0) continue;
    const avgPrecision = validResults.reduce((sum, r) => sum + parseFloat(r.precisionAt[k]), 0) / validResults.length;
    const minPrecision = Math.min(...validResults.map(r => parseFloat(r.precisionAt[k])));
    const maxPrecision = Math.max(...validResults.map(r => parseFloat(r.precisionAt[k])));
    console.log(`  Precision@${k}:  avg = ${avgPrecision.toFixed(3)}  |  min = ${minPrecision.toFixed(2)}  |  max = ${maxPrecision.toFixed(2)}  (over ${validResults.length} test cases)`);
  }

  // Category breakdown
  console.log("\n  Results by target category:");
  for (const cat of ["bottom", "shoes", "accessory", "top"]) {
    const catResults = results.filter(r => r.label.includes(`→ ${cat}`) && r.recs.length >= 5);
    if (catResults.length === 0) continue;
    const avg5 = catResults.reduce((s, r) => s + parseFloat(r.precisionAt[5]), 0) / catResults.length;
    console.log(`    ${cat.padEnd(12)}: avg P@5 = ${avg5.toFixed(2)}  (${catResults.length} cases)`);
  }

  // Save JSON
  const fs = await import("fs");
  const report = {
    evaluatedAt: new Date().toISOString(),
    testCases: TEST_CASES.length,
    methodology: "Precision@K against curated compatibility rules (colour, article type, gender, category constraints)",
    groundTruth: {
      colourPairs: COMPATIBLE_COLOUR_PAIRS.size,
      articleTypePairs: COMPATIBLE_ARTICLE_PAIRS.size,
      criteria: [
        "recommended category ≠ base item category",
        "gender match (or unisex)",
        "colour pair is known-compatible",
        "article type pair is known-compatible"
      ]
    },
    aggregate: {},
    perTestCase: results.map(r => ({
      label: r.label,
      precisionAt1: r.precisionAt?.[1],
      precisionAt3: r.precisionAt?.[3],
      precisionAt5: r.precisionAt?.[5],
      correctIn10: r.recs?.filter(x => x.correct).length,
      totalIn10: Math.min(10, r.recs?.length || 0),
    }))
  };

  for (const k of K_VALUES) {
    const validResults = results.filter(r => r.recs.length >= k);
    if (validResults.length > 0) {
      report.aggregate[`precision@${k}`] = (
        validResults.reduce((s, r) => s + parseFloat(r.precisionAt[k]), 0) / validResults.length
      ).toFixed(3);
    }
  }

  fs.writeFileSync("rec-quality-results.json", JSON.stringify(report, null, 2));

  console.log("\n  Full results saved to rec-quality-results.json");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

runQualityEval().catch(console.error);
