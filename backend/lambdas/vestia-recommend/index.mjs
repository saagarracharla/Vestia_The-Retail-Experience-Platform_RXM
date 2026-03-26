/**
 * vestia-recommend Lambda — Full algorithm matching diagram:
 *
 * 1.  Fetch base product metadata
 * 2.  Fetch Compatibility Scores (COLOR + ARTICLE + USAGE from CompatibilityStats)
 * 3.  Active Session Context — exclude already-scanned SKUs
 * 4.  Store Inventory & Availability — filter unavailable items
 * 5.  Fetch Historical Co-occurrence Stats (co-scan affinity, 30-day window)
 * 6.  Filter Out Unavailable Items
 * 7.  Apply Category Constraints
 * 8.  Apply Size & Colour Constraints (from session prefs + customer profile)
 * 9.  Customer Profile (if customerId provided) → fetch preferences
 * 10. Base Compatibility Score (colour + article rules)
 * 11. Boost Common Pairings (co-scan affinity)
 * 12. Adjust by Customer Preferences
 * 13. Adjust by Live In-Session Feedback
 * 14. Combine Weighted Scores
 * 15. Rank Items by Final Score
 * 16. Return Ranked Recommendations (Grouped by Category)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CATEGORY_COMPLEMENTS = {
  top:       ["bottom", "shoes", "accessory"],
  bottom:    ["top", "shoes", "accessory"],
  shoes:     ["top", "bottom"],
  accessory: ["top", "bottom", "shoes"],
};

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      productId,
      productIds,        // outfit mode — array of SKUs already in room
      targetCategory,
      gender,
      sessionId,
      customerId,        // optional — load customer profile
      sessionPreferences, // optional — inline prefs: { preferredSizes, preferredColors, preferredStyles }
    } = body;

    // ── OUTFIT MODE: score candidates against multiple base items ─────────────
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      return await handleOutfitMode({ productIds, gender, sessionId, customerId, sessionPreferences });
    }

    if (!productId) {
      return res(400, { error: "productId is required" });
    }

    // ── 1. Fetch base product ──────────────────────────────────────────────────
    const baseProduct = await getProduct(productId);
    if (!baseProduct) return res(404, { error: "Product not found" });

    const baseColor    = (baseProduct.color       || "").toLowerCase().trim();
    const baseArticle  = (baseProduct.articleType || "").toLowerCase().trim();
    const baseUsage    = (baseProduct.usage        || "casual").toLowerCase().trim();
    const baseCategory = (baseProduct.category    || "top").toLowerCase().trim();
    // Rich S3-enriched attributes
    const basePattern  = (baseProduct.pattern     || "").toLowerCase().trim();
    const baseFabric   = (baseProduct.fabric       || "").toLowerCase().trim();
    const baseFit      = (baseProduct.fit          || "").toLowerCase().trim();

    // ── 2. Fetch compatibility scores (including S3-derived dimensions) ────────
    const [colorCompat, articleCompat, usageCompat, patternCompat, fabricCompat, fitCompat] = await Promise.all([
      baseColor   ? getCompatScores(`COLOR#${baseColor}`)     : {},
      baseArticle ? getCompatScores(`ARTICLE#${baseArticle}`) : {},
      baseUsage   ? getCompatScores(`USAGE#${baseUsage}`)     : {},
      basePattern ? getCompatScores(`PATTERN#${basePattern}`) : {},
      baseFabric  ? getCompatScores(`FABRIC#${baseFabric}`)   : {},
      baseFit     ? getCompatScores(`FIT#${baseFit}`)         : {},
    ]);

    // ── 3. Active session context + in-session feedback ───────────────────────
    const excludeSkus = new Set([productId]);
    let sessionFeedback = {}; // sku → { liked: bool, preferredColor, preferredSize }

    if (sessionId) {
      const [scannedSkus, feedbackEvents, prefEvents] = await Promise.all([
        getSessionScannedSkus(sessionId),
        getSessionFeedbackSignals(sessionId),
        getSessionPreferences(sessionId),
      ]);
      scannedSkus.forEach(sku => excludeSkus.add(sku));
      sessionFeedback = feedbackEvents;

      // Merge session prefs stored in DB with inline prefs (inline wins)
      if (!sessionPreferences && prefEvents) {
        Object.assign(sessionPreferences ?? {}, prefEvents);
      }
    }

    // ── 5. Historical co-scan affinity ────────────────────────────────────────
    const coScanAffinity = await buildCoScanAffinity(productId);

    // ── 9. Customer profile ───────────────────────────────────────────────────
    let customerProfile = null;
    if (customerId) {
      customerProfile = await getCustomerProfile(customerId);
    }

    // Merge preferences: sessionPreferences override profile
    const prefs = mergePreferences(customerProfile, sessionPreferences);

    // ── 7. Determine target categories ───────────────────────────────────────
    const targetCategories = targetCategory
      ? [targetCategory]
      : (CATEGORY_COMPLEMENTS[baseCategory] || ["bottom", "shoes", "accessory"]);

    // ── Fetch all candidates ──────────────────────────────────────────────────
    const candidates = await getCandidates(gender || customerProfile?.gender, excludeSkus);

    // ── Score and group by category ───────────────────────────────────────────
    const grouped = {};
    for (const cat of targetCategories) {
      // ── 7. Apply category constraint ────────────────────────────────────────
      const catCandidates = candidates.filter(c =>
        (c.category || "").toLowerCase() === cat
      );

      // ── 8. Score all candidates ──────────────────────────────────────────────
      const scored = catCandidates.map(c => {
        const s = computeScore(c, baseProduct, {
          colorCompat,
          articleCompat,
          usageCompat,
          patternCompat,
          fabricCompat,
          fitCompat,
          coScanAffinity,
          sessionFeedback,
          prefs,
        });
        return {
          productId: c.productId,
          name: c.name,
          category: c.category,
          articleType: c.articleType,
          color: c.color,
          price: c.price,
          usage: c.usage,
          score: Math.round(s * 1000) / 1000,
        };
      }).sort((a, b) => b.score - a.score);

      // ── Diversity re-ranking: spread across article types AND colours ────────
      // Prevents 5 track pants or 5 white items dominating the results.
      const selected = [];
      const articleTypeCount = {};
      const colorCount = {};
      const MAX_PER_ARTICLE = 1;
      const MAX_PER_COLOR   = 2;

      for (const item of scored) {
        const art   = (item.articleType || "other").toLowerCase();
        const color = (item.color       || "other").toLowerCase();
        const artCount   = articleTypeCount[art]   || 0;
        const clrCount   = colorCount[color]       || 0;
        if (artCount < MAX_PER_ARTICLE && clrCount < MAX_PER_COLOR) {
          selected.push(item);
          articleTypeCount[art]   = artCount   + 1;
          colorCount[color]       = clrCount   + 1;
        }
        if (selected.length >= 5) break;
      }

      // Backfill if diversity constraints left < 5 results
      if (selected.length < 5) {
        const selectedIds = new Set(selected.map(i => i.productId));
        for (const item of scored) {
          if (!selectedIds.has(item.productId)) {
            selected.push(item);
            if (selected.length >= 5) break;
          }
        }
      }

      grouped[cat] = selected;
    }

    // ── 16. Return grouped + flat top-5 (backwards compat) ───────────────────
    const allScored = Object.values(grouped).flat().sort((a, b) => b.score - a.score);
    const topOverall = allScored.slice(0, 5);

    return res(200, topOverall.length > 0 ? topOverall : allScored);
  } catch (err) {
    console.error("Recommend error:", err);
    return res(500, { error: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DynamoDB helpers
// ─────────────────────────────────────────────────────────────────────────────

function res(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

async function getProduct(productId) {
  const r = await docClient.send(new GetCommand({ TableName: "ProductCatalog", Key: { productId } }));
  return r.Item || null;
}

async function getCompatScores(pk) {
  const r = await docClient.send(new QueryCommand({
    TableName: "CompatibilityStats",
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: { ":pk": pk },
    ProjectionExpression: "SK, score",
  }));
  const map = {};
  for (const item of r.Items || []) {
    const key = (item.SK.includes("#") ? item.SK.split("#")[1] : item.SK).toLowerCase().trim();
    const val = Number(item.score);
    // Take max in case of duplicate keys from old/new format entries
    if (!(key in map) || val > map[key]) map[key] = val;
  }
  return map;
}

async function getSessionScannedSkus(sessionId) {
  const r = await docClient.send(new QueryCommand({
    TableName: "VestiaSessions",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":sk": "SCAN#" },
    ProjectionExpression: "sku",
  }));
  return (r.Items || []).map(i => i.sku).filter(Boolean);
}

/**
 * Read FEEDBACK events from session and build a signal map.
 * Feedback entityType = "FEEDBACK", itemFeedback = [{ sku, rating, liked }]
 * Returns: { [sku]: { score: -1|0|1, preferredColor, preferredSize } }
 */
async function getSessionFeedbackSignals(sessionId) {
  const r = await docClient.send(new QueryCommand({
    TableName: "VestiaSessions",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":sk": "FEEDBACK#" },
    ProjectionExpression: "itemFeedback",
  }));

  const signals = {};
  for (const item of r.Items || []) {
    for (const fb of item.itemFeedback || []) {
      if (!fb.sku) continue;
      signals[fb.sku] = {
        signal: fb.liked === true ? 1 : fb.liked === false ? -1 : 0,
        preferredColor: fb.preferredColor || null,
        preferredSize:  fb.preferredSize  || null,
      };
    }
  }
  return signals;
}

/**
 * Read SESSION_PREF events for style/size/color preferences set during the session.
 */
async function getSessionPreferences(sessionId) {
  const r = await docClient.send(new QueryCommand({
    TableName: "VestiaSessions",
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}`, ":sk": "PREF#" },
  }));
  if (!r.Items?.length) return null;
  // Merge all pref records (latest wins for same field)
  const merged = {};
  for (const item of r.Items) {
    if (item.preferredSizes)  merged.preferredSizes  = { ...merged.preferredSizes,  ...item.preferredSizes };
    if (item.preferredColors) merged.preferredColors = item.preferredColors;
    if (item.preferredStyles) merged.preferredStyles = item.preferredStyles;
  }
  return merged;
}

async function getCustomerProfile(customerId) {
  const r = await docClient.send(new GetCommand({ TableName: "CustomerProfiles", Key: { customerId } }));
  return r.Item || null;
}

/**
 * Build co-scan affinity map: productId → 0–1 score.
 * Items frequently scanned alongside targetProductId get higher scores.
 */
async function buildCoScanAffinity(targetProductId) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let allScans = [];
  let ExclusiveStartKey;

  do {
    const r = await docClient.send(new ScanCommand({
      TableName: "VestiaSessions",
      FilterExpression: "entityType = :type AND createdAt > :cutoff AND begins_with(PK, :prefix)",
      ExpressionAttributeValues: { ":type": "SCAN", ":cutoff": cutoff, ":prefix": "SESSION#" },
      ProjectionExpression: "sessionId, sku",
      ExclusiveStartKey,
    }));
    allScans = allScans.concat(r.Items || []);
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  const bySession = {};
  for (const { sessionId, sku } of allScans) {
    if (!bySession[sessionId]) bySession[sessionId] = [];
    bySession[sessionId].push(sku);
  }

  const coCount = {};
  for (const skus of Object.values(bySession)) {
    if (skus.includes(targetProductId)) {
      for (const sku of skus) {
        if (sku !== targetProductId) coCount[sku] = (coCount[sku] || 0) + 1;
      }
    }
  }

  const max = Math.max(...Object.values(coCount), 1);
  const normalized = {};
  for (const [sku, count] of Object.entries(coCount)) normalized[sku] = count / max;
  return normalized;
}

async function getCandidates(gender, excludeSkus) {
  let items = [];
  let ExclusiveStartKey;
  const params = {
    TableName: "ProductCatalog",
    ...(gender ? {
      FilterExpression: "#g = :g OR #g = :u",
      ExpressionAttributeNames: { "#g": "gender" },
      ExpressionAttributeValues: { ":g": gender.toLowerCase(), ":u": "unisex" },
    } : {}),
  };
  do {
    const r = await docClient.send(new ScanCommand({ ...params, ExclusiveStartKey }));
    items = items.concat(r.Items || []);
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items.filter(i => i.productId && !excludeSkus.has(i.productId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Preferences merge helper
// ─────────────────────────────────────────────────────────────────────────────

function mergePreferences(profile, sessionPrefs) {
  // Session prefs take priority over customer profile
  return {
    preferredSizes:    { ...(profile?.preferredSizes  || {}), ...(sessionPrefs?.preferredSizes  || {}) },
    preferredColors:   sessionPrefs?.preferredColors   || profile?.preferredColors   || [],
    preferredStyles:   sessionPrefs?.preferredStyles   || profile?.preferredStyles   || [],
    preferredPatterns: sessionPrefs?.preferredPatterns || profile?.preferredPatterns || [],
    preferredFabrics:  sessionPrefs?.preferredFabrics  || profile?.preferredFabrics  || [],
    purchaseHistory:   profile?.purchaseHistory || [],
    derivedStyle:      profile?.derivedStyle    || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full weighted scoring using all available signals including S3-enriched attributes:
 *
 * Article type compatibility  25%  (CompatibilityStats ARTICLE#)
 * Color compatibility         20%  (CompatibilityStats COLOR#)
 * Pattern compatibility       15%  (CompatibilityStats PATTERN# — from S3)
 * Co-scan affinity            15%  (historical try-on frequency)
 * Fabric compatibility        10%  (CompatibilityStats FABRIC# — from S3)
 * Price proximity              8%  (similar price range)
 * Customer preferences         5%  (session prefs + customer profile)
 * In-session feedback          2%  (live feedback signal)
 */
function computeScore(candidate, base, { colorCompat, articleCompat, usageCompat, patternCompat, fabricCompat, fitCompat, coScanAffinity, sessionFeedback, prefs }) {
  const candColor   = (candidate.color       || "").toLowerCase().trim();
  const candArticle = (candidate.articleType || "").toLowerCase().trim();
  const candUsage   = (candidate.usage        || "casual").toLowerCase().trim();
  const candPattern = (candidate.pattern      || "").toLowerCase().trim();
  const candFabric  = (candidate.fabric       || "").toLowerCase().trim();
  const candFit     = (candidate.fit          || "").toLowerCase().trim();

  // ── Article type compatibility ─────────────────────────────────────────────
  let articleScore = articleCompat[candArticle] ?? 0.15;
  articleScore = clamp(articleScore);

  // ── Color compatibility ────────────────────────────────────────────────────
  let colorScore = colorCompat[candColor] ??
    (candColor === (base.color || "").toLowerCase().trim() ? 0.2 : 0.15);
  colorScore = clamp(colorScore);

  // ── Pattern compatibility (S3-enriched) ───────────────────────────────────
  // Only apply if both items have pattern data; otherwise neutral 0.6
  let patternScore = 0.6;
  if (candPattern && Object.keys(patternCompat).length > 0) {
    patternScore = patternCompat[candPattern] ?? 0.5;
  }
  patternScore = clamp(patternScore);

  // ── Fabric compatibility (S3-enriched) ────────────────────────────────────
  // Only apply if both have fabric data; otherwise neutral 0.6
  let fabricScore = 0.6;
  if (candFabric && Object.keys(fabricCompat).length > 0) {
    fabricScore = fabricCompat[candFabric] ?? 0.5;
  }
  fabricScore = clamp(fabricScore);

  // ── Usage compatibility ────────────────────────────────────────────────────
  let usageScore = usageCompat[candUsage] ??
    (candUsage === (base.usage || "").toLowerCase().trim() ? 0.8 : 0.5);
  usageScore = clamp(usageScore);

  // ── Co-scan affinity (boosts common pairings) ─────────────────────────────
  const coScanScore = coScanAffinity[candidate.productId] || 0;

  // ── Price proximity ────────────────────────────────────────────────────────
  const priceDiff = Math.abs((candidate.price || 0) - (base.price || 0));
  const maxPrice = Math.max(candidate.price || 1, base.price || 1);
  const priceScore = Math.max(0, 1 - priceDiff / (maxPrice * 2));

  // ── Customer / session preference boost ───────────────────────────────────
  // Session prefs (explicit, high-confidence) and profile history (learned,
  // medium-confidence) are kept as SEPARATE signals so they don't cancel
  // each other out when both are present.
  let prefScore = 0.5;
  let hasPrefs = false;
  if (prefs) {
    let boosts = 0, boostCount = 0;

    // Session colour preference — explicit pick, highest confidence
    const sessionColors = (prefs.preferredColors || []).map(c => c.toLowerCase());
    if (sessionColors.length > 0) {
      boosts += sessionColors.includes(candColor) ? 1.0 : 0.05;
      boostCount++;
      hasPrefs = true;
    }

    // Profile derived colour preference — learned from purchase history
    // Treated as a separate, lower-confidence signal so it can compete
    // with session prefs rather than being swallowed by them
    const profileColors = (prefs.derivedStyle?.topColors || []).map(c => c.toLowerCase());
    if (profileColors.length > 0) {
      boosts += profileColors.includes(candColor) ? 0.75 : 0.05;
      boostCount++;
      hasPrefs = true;
    }

    // Style / usage preferences (session + profile)
    const allStyles = [
      ...(prefs.preferredStyles || []),
      ...(prefs.derivedStyle?.dominantStyle ? [prefs.derivedStyle.dominantStyle] : []),
    ].map(s => s.toLowerCase());
    if (allStyles.length > 0) {
      boosts += allStyles.includes(candUsage) ? 1.0 : 0.1;
      boostCount++;
      hasPrefs = true;
    }

    // Pattern preferences (solid, striped, checked, printed, etc.)
    const allPreferredPatterns = (prefs.preferredPatterns || []).map(p => p.toLowerCase());
    if (allPreferredPatterns.length > 0 && candPattern) {
      boosts += allPreferredPatterns.includes(candPattern) ? 1.0 : 0.1;
      boostCount++;
      hasPrefs = true;
    }

    // Fabric preferences (cotton, denim, synthetic, etc.)
    const allPreferredFabrics = (prefs.preferredFabrics || []).map(f => f.toLowerCase());
    if (allPreferredFabrics.length > 0 && candFabric) {
      boosts += allPreferredFabrics.includes(candFabric) ? 1.0 : 0.1;
      boostCount++;
      hasPrefs = true;
    }

    // Article type affinity from purchase history
    const pastArticles = [
      ...(prefs.purchaseHistory || []).map(p => (p.articleType || "").toLowerCase()),
      ...(prefs.derivedStyle?.topArticles || []),
    ];
    if (pastArticles.length > 0) {
      boosts += pastArticles.includes(candArticle) ? 0.85 : 0.35;
      boostCount++;
      hasPrefs = true;
    }

    // Price range alignment from purchase history
    if (prefs.derivedStyle?.avgPrice) {
      const avgSpend = prefs.derivedStyle.avgPrice;
      const candPrice = candidate.price || 0;
      const diff = Math.abs(candPrice - avgSpend) / Math.max(avgSpend, 1);
      boosts += diff < 0.5 ? 1.0 : diff < 1.0 ? 0.6 : 0.2;
      boostCount++;
      hasPrefs = true;
    }

    if (boostCount > 0) prefScore = boosts / boostCount;
  }

  // ── In-session feedback signal ─────────────────────────────────────────────
  let feedbackScore = 0.5;
  if (sessionFeedback && Object.keys(sessionFeedback).length > 0) {
    let total = 0, count = 0;
    for (const fb of Object.values(sessionFeedback)) {
      if (fb.preferredColor && fb.preferredColor.toLowerCase() === candColor) {
        total += fb.signal > 0 ? 1.0 : 0.1;
        count++;
      }
    }
    if (count > 0) feedbackScore = total / count;
  }

  // ── Dynamic weights: give preference signal much more power when context exists
  // Without profile/prefs: algorithm is purely catalog-driven (compatibility + co-occurrence)
  // With profile/prefs: personal signals take a significant share of the final score
  if (hasPrefs) {
    return (
      articleScore  * 0.18 +
      colorScore    * 0.13 +
      patternScore  * 0.10 +
      coScanScore   * 0.12 +
      fabricScore   * 0.07 +
      priceScore    * 0.05 +
      prefScore     * 0.33 +
      feedbackScore * 0.02
    );
  }

  // ── Default weights: no personalisation context ────────────────────────────
  return (
    articleScore  * 0.25 +
    colorScore    * 0.20 +
    patternScore  * 0.15 +
    coScanScore   * 0.15 +
    fabricScore   * 0.10 +
    priceScore    * 0.08 +
    prefScore     * 0.05 +
    feedbackScore * 0.02
  );
}

function clamp(v) { return Math.min(1, Math.max(0, v)); }

// ─────────────────────────────────────────────────────────────────────────────
// Outfit Mode — score candidates against ALL selected base items, fill missing
// categories, return top-2 per missing category
// ─────────────────────────────────────────────────────────────────────────────

async function handleOutfitMode({ productIds, gender, sessionId, customerId, sessionPreferences }) {
  // 1. Fetch all base products
  const baseProducts = (await Promise.all(productIds.map(getProduct))).filter(Boolean);
  if (baseProducts.length === 0) return res(404, { error: "No products found" });

  // 2. Fetch compat stats for each base product (6 dimensions each)
  const compatDataArray = await Promise.all(baseProducts.map(async (bp) => {
    const [colorCompat, articleCompat, usageCompat, patternCompat, fabricCompat, fitCompat] = await Promise.all([
      bp.color       ? getCompatScores(`COLOR#${bp.color.toLowerCase().trim()}`)       : {},
      bp.articleType ? getCompatScores(`ARTICLE#${bp.articleType.toLowerCase().trim()}`) : {},
      bp.usage       ? getCompatScores(`USAGE#${bp.usage.toLowerCase().trim()}`)       : {},
      bp.pattern     ? getCompatScores(`PATTERN#${bp.pattern.toLowerCase().trim()}`)   : {},
      bp.fabric      ? getCompatScores(`FABRIC#${bp.fabric.toLowerCase().trim()}`)     : {},
      bp.fit         ? getCompatScores(`FIT#${bp.fit.toLowerCase().trim()}`)           : {},
    ]);
    return { colorCompat, articleCompat, usageCompat, patternCompat, fabricCompat, fitCompat };
  }));

  // 3. Session context
  const excludeSkus = new Set(productIds);
  let sessionFeedback = {};
  let mergedSessionPrefs = sessionPreferences || null;

  if (sessionId) {
    const [scannedSkus, feedbackEvents, prefEvents] = await Promise.all([
      getSessionScannedSkus(sessionId),
      getSessionFeedbackSignals(sessionId),
      getSessionPreferences(sessionId),
    ]);
    scannedSkus.forEach(sku => excludeSkus.add(sku));
    sessionFeedback = feedbackEvents;
    if (!mergedSessionPrefs && prefEvents) mergedSessionPrefs = prefEvents;
  }

  // 4. Co-scan affinity for primary item
  const coScanAffinity = await buildCoScanAffinity(productIds[0]);

  // 5. Customer profile
  let customerProfile = null;
  if (customerId) customerProfile = await getCustomerProfile(customerId);
  const prefs = mergePreferences(customerProfile, mergedSessionPrefs);

  // 6. Determine missing categories
  const presentCategories = new Set(baseProducts.map(bp => (bp.category || "").toLowerCase()));
  const allCategories = ["top", "bottom", "shoes", "accessory"];
  const missingCategories = allCategories.filter(c => !presentCategories.has(c));

  if (missingCategories.length === 0) {
    return res(200, { outfit: {}, baseProductIds: productIds, message: "Outfit is already complete" });
  }

  // 7. Get candidates (filter by gender)
  const inferredGender = gender || baseProducts.find(bp => bp.gender)?.gender || customerProfile?.gender;
  const candidates = await getCandidates(inferredGender, excludeSkus);

  // 8. Score each candidate against ALL base items — average the scores
  const outfitResult = {};
  for (const cat of missingCategories) {
    const catCandidates = candidates.filter(c => (c.category || "").toLowerCase() === cat);

    const scored = catCandidates.map(candidate => {
      let totalScore = 0;
      let count = 0;
      for (let i = 0; i < baseProducts.length; i++) {
        if (!compatDataArray[i]) continue;
        const s = computeScore(candidate, baseProducts[i], {
          ...compatDataArray[i],
          coScanAffinity,
          sessionFeedback,
          prefs,
        });
        totalScore += s;
        count++;
      }
      return {
        productId: candidate.productId,
        name: candidate.name,
        category: candidate.category,
        articleType: candidate.articleType,
        color: candidate.color,
        price: candidate.price,
        score: Math.round((count > 0 ? totalScore / count : 0) * 1000) / 1000,
      };
    }).sort((a, b) => b.score - a.score);

    // Diversity re-rank: max 1 per article type, max 2 per colour — pick top 2
    const selected = [];
    const articleTypeCount = {};
    const colorCount = {};
    for (const item of scored) {
      const art   = (item.articleType || "other").toLowerCase();
      const color = (item.color       || "other").toLowerCase();
      if ((articleTypeCount[art] || 0) < 1 && (colorCount[color] || 0) < 2) {
        selected.push(item);
        articleTypeCount[art]   = (articleTypeCount[art]   || 0) + 1;
        colorCount[color]       = (colorCount[color]       || 0) + 1;
      }
      if (selected.length >= 2) break;
    }
    // Backfill if needed
    if (selected.length < 2) {
      const ids = new Set(selected.map(i => i.productId));
      for (const item of scored) {
        if (!ids.has(item.productId)) { selected.push(item); if (selected.length >= 2) break; }
      }
    }

    outfitResult[cat] = selected;
  }

  return res(200, { outfit: outfitResult, baseProductIds: productIds });
}
