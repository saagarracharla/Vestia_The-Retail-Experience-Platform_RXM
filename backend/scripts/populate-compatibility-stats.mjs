/**
 * Populate CompatibilityStats DynamoDB table with comprehensive fashion compatibility data.
 *
 * Schema:
 *   PK: "COLOR#{baseColor}"  SK: "COLOR#{compatColor}"  score: 0.0-1.0
 *   PK: "ARTICLE#{baseArticle}"  SK: "ARTICLE#{compatArticle}"  score: 0.0-1.0
 *   PK: "USAGE#{usage}"  SK: "USAGE#{compatUsage}"  score: 0.0-1.0
 *
 * Run: node backend/scripts/populate-compatibility-stats.mjs
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE = "CompatibilityStats";

// ─── COLOR COMPATIBILITY ──────────────────────────────────────────────────────
// Score: 1.0 = great pair, 0.7 = decent, 0.4 = neutral/possible, 0.1 = avoid
// Rules derived from fashion theory: analogous colors, complementary, neutrals + accent
const COLOR_RULES = {
  black:  { white:1.0, grey:0.9, red:0.9, pink:0.85, gold:0.85, silver:0.85, blue:0.8, navy:0.8, purple:0.8, green:0.75, yellow:0.75, orange:0.7, beige:0.7, cream:0.7, khaki:0.65, teal:0.75, maroon:0.8, brown:0.5, olive:0.65, denim:0.8, copper:0.7, rose:0.8 },
  white:  { black:1.0, navy:0.95, blue:0.9, grey:0.85, red:0.85, pink:0.85, green:0.8, brown:0.8, beige:0.7, gold:0.75, silver:0.75, purple:0.75, teal:0.8, maroon:0.8, khaki:0.75, cream:0.6, olive:0.7, denim:0.85, orange:0.7, yellow:0.7, copper:0.6, rose:0.8 },
  grey:   { white:0.95, black:0.9, navy:0.85, blue:0.8, pink:0.8, red:0.75, purple:0.75, teal:0.7, maroon:0.7, yellow:0.6, orange:0.6, green:0.65, brown:0.6, beige:0.65, olive:0.6, denim:0.75, rose:0.75, silver:0.8, gold:0.65, copper:0.55, cream:0.7 },
  navy:   { white:0.95, grey:0.85, beige:0.85, khaki:0.85, gold:0.8, red:0.8, pink:0.75, green:0.7, brown:0.7, cream:0.8, yellow:0.65, orange:0.6, silver:0.7, copper:0.6, teal:0.65, olive:0.7, maroon:0.6, rose:0.7, black:0.8, denim:0.5 },
  blue:   { white:0.95, grey:0.85, black:0.8, beige:0.8, brown:0.75, navy:0.6, khaki:0.8, gold:0.7, yellow:0.65, red:0.6, cream:0.75, orange:0.55, pink:0.65, silver:0.65, teal:0.6, olive:0.65, denim:0.5, rose:0.65, green:0.6, copper:0.55, maroon:0.6, purple:0.6 },
  brown:  { beige:1.0, white:0.9, cream:0.9, khaki:0.9, green:0.8, gold:0.8, orange:0.75, navy:0.7, blue:0.75, black:0.6, olive:0.8, copper:0.75, yellow:0.65, maroon:0.6, pink:0.5, red:0.5, rose:0.55, teal:0.55, denim:0.7, grey:0.6, silver:0.45, purple:0.45 },
  red:    { black:0.9, white:0.85, grey:0.75, navy:0.8, gold:0.75, silver:0.7, denim:0.8, blue:0.6, beige:0.55, cream:0.55, khaki:0.5, brown:0.5, pink:0.4, purple:0.5, green:0.45, maroon:0.3, orange:0.35, yellow:0.35, teal:0.45, olive:0.4, rose:0.5, copper:0.6 },
  pink:   { white:0.95, grey:0.85, black:0.85, navy:0.75, blue:0.65, gold:0.7, silver:0.75, beige:0.7, cream:0.75, maroon:0.5, rose:0.8, purple:0.65, green:0.5, teal:0.55, brown:0.5, khaki:0.6, denim:0.7, olive:0.4, yellow:0.5, orange:0.4, red:0.4, copper:0.5 },
  green:  { white:0.9, black:0.75, brown:0.8, beige:0.8, khaki:0.85, cream:0.8, gold:0.7, navy:0.7, blue:0.6, olive:0.7, yellow:0.6, orange:0.55, grey:0.65, copper:0.65, maroon:0.5, denim:0.7, red:0.45, teal:0.75, pink:0.5, purple:0.5, silver:0.55, rose:0.5 },
  beige:  { brown:1.0, white:0.9, navy:0.85, cream:0.9, khaki:0.85, green:0.8, gold:0.8, black:0.7, blue:0.8, orange:0.6, maroon:0.65, copper:0.75, olive:0.75, teal:0.6, denim:0.7, grey:0.65, yellow:0.6, red:0.5, pink:0.6, rose:0.6, silver:0.6, purple:0.45 },
  yellow: { black:0.85, white:0.75, navy:0.65, grey:0.6, brown:0.65, green:0.6, blue:0.65, denim:0.7, khaki:0.6, gold:0.7, beige:0.6, olive:0.6, orange:0.5, purple:0.5, teal:0.55, cream:0.65, red:0.35, pink:0.5, rose:0.4, silver:0.5, maroon:0.4, copper:0.55 },
  orange: { white:0.8, black:0.7, brown:0.75, navy:0.6, blue:0.55, grey:0.6, gold:0.75, beige:0.65, khaki:0.7, olive:0.65, copper:0.8, green:0.55, teal:0.55, denim:0.65, cream:0.6, yellow:0.5, red:0.35, maroon:0.5, purple:0.45, silver:0.45, pink:0.4, rose:0.4 },
  purple: { white:0.85, grey:0.75, black:0.8, silver:0.8, gold:0.7, navy:0.65, pink:0.65, blue:0.6, beige:0.55, cream:0.6, teal:0.6, rose:0.65, maroon:0.6, green:0.5, denim:0.65, brown:0.45, khaki:0.5, olive:0.45, yellow:0.5, orange:0.45, red:0.5, copper:0.45 },
  gold:   { black:0.85, white:0.75, navy:0.8, brown:0.8, beige:0.8, orange:0.75, maroon:0.75, green:0.7, khaki:0.7, cream:0.75, olive:0.7, copper:0.8, yellow:0.7, teal:0.6, blue:0.7, grey:0.65, purple:0.7, red:0.65, denim:0.55, pink:0.7, rose:0.65, silver:0.5 },
  silver: { black:0.85, white:0.75, grey:0.8, navy:0.7, blue:0.65, purple:0.8, pink:0.75, teal:0.7, maroon:0.65, red:0.7, rose:0.7, green:0.55, beige:0.6, cream:0.6, denim:0.65, brown:0.45, khaki:0.5, olive:0.45, yellow:0.5, orange:0.45, gold:0.5, copper:0.5 },
  khaki:  { white:0.9, navy:0.85, brown:0.9, beige:0.85, green:0.85, olive:0.9, blue:0.8, black:0.65, gold:0.7, orange:0.7, denim:0.75, cream:0.8, copper:0.65, teal:0.6, maroon:0.6, grey:0.65, yellow:0.6, red:0.45, pink:0.5, rose:0.45, silver:0.5, purple:0.5 },
  cream:  { brown:0.9, beige:0.9, navy:0.8, black:0.7, blue:0.75, green:0.8, gold:0.75, khaki:0.8, olive:0.75, maroon:0.7, teal:0.65, copper:0.65, denim:0.7, grey:0.7, white:0.6, yellow:0.65, orange:0.6, red:0.5, pink:0.65, rose:0.6, silver:0.6, purple:0.55 },
  denim:  { white:0.85, black:0.8, grey:0.75, red:0.8, navy:0.5, beige:0.7, brown:0.7, gold:0.55, yellow:0.7, green:0.7, khaki:0.75, cream:0.7, orange:0.65, pink:0.7, rose:0.65, teal:0.65, olive:0.65, copper:0.55, maroon:0.65, silver:0.55, purple:0.65, blue:0.5 },
  teal:   { white:0.9, black:0.75, grey:0.7, navy:0.65, gold:0.6, silver:0.7, beige:0.6, cream:0.65, brown:0.55, denim:0.65, pink:0.55, rose:0.55, purple:0.6, green:0.75, blue:0.6, khaki:0.6, olive:0.65, yellow:0.55, orange:0.55, red:0.45, maroon:0.5, copper:0.55 },
  maroon: { white:0.85, beige:0.75, cream:0.7, gold:0.75, navy:0.6, grey:0.7, black:0.8, khaki:0.65, brown:0.6, olive:0.6, pink:0.5, rose:0.5, blue:0.6, green:0.5, denim:0.65, copper:0.65, silver:0.65, teal:0.5, yellow:0.4, orange:0.5, purple:0.6, red:0.3 },
  olive:  { white:0.8, khaki:0.9, beige:0.85, brown:0.85, cream:0.8, black:0.65, green:0.7, gold:0.7, denim:0.65, navy:0.7, blue:0.65, orange:0.65, copper:0.7, maroon:0.6, grey:0.6, yellow:0.6, teal:0.65, red:0.4, pink:0.35, rose:0.35, silver:0.45, purple:0.4 },
  rose:   { white:0.9, grey:0.8, black:0.8, navy:0.7, gold:0.65, silver:0.7, pink:0.8, purple:0.65, beige:0.65, cream:0.65, blue:0.65, denim:0.7, brown:0.55, khaki:0.55, green:0.5, teal:0.55, maroon:0.5, red:0.5, yellow:0.45, orange:0.4, olive:0.35, copper:0.5 },
  copper: { brown:0.85, beige:0.8, orange:0.8, gold:0.8, khaki:0.7, olive:0.7, cream:0.65, black:0.7, white:0.6, green:0.65, maroon:0.65, navy:0.6, blue:0.55, grey:0.55, denim:0.55, yellow:0.55, teal:0.55, red:0.6, pink:0.5, rose:0.5, silver:0.5, purple:0.45 },
};

// ─── ARTICLE TYPE COMPATIBILITY ───────────────────────────────────────────────
// Pairs based on category logic: top + bottom + shoes + accessory
// Score: 1.0 = perfect pair, 0.7 = good, 0.5 = neutral, 0.2 = unlikely
const ARTICLE_RULES = {
  // TOPS → bottoms, shoes, accessories
  tshirts:       { jeans:1.0, shorts:0.95, chinos:0.9, "track pants":0.85, "joggers":0.85, "casual shoes":0.95, sneakers:0.95, "sports shoes":0.8, sandals:0.8, flats:0.75, watches:0.9, belts:0.7, caps:0.85, backpacks:0.75, sweatpants:0.85, leggings:0.75, skirts:0.7 },
  shirts:        { jeans:0.95, trousers:0.95, chinos:0.9, shorts:0.8, skirts:0.75, "casual shoes":0.9, "formal shoes":0.9, loafers:0.9, watches:0.95, belts:0.9, ties:0.85, "formal trousers":1.0, dresses:0.4 },
  tops:          { jeans:0.95, skirts:0.95, shorts:0.85, leggings:0.9, trousers:0.8, flats:0.9, heels:0.9, sandals:0.85, "casual shoes":0.8, watches:0.85, bracelets:0.8, handbags:0.9, sunglasses:0.8, necklaces:0.85 },
  kurtas:        { leggings:1.0, jeans:0.85, "churidar":0.95, palazzo:0.9, sandals:0.9, flats:0.85, juttis:0.95, watches:0.8, bangles:0.9, earrings:0.9, dupattas:0.95, skirts:0.7 },
  jackets:       { jeans:0.95, trousers:0.9, chinos:0.85, "casual shoes":0.9, sneakers:0.85, tshirts:0.9, shirts:0.85, watches:0.85, backpacks:0.75 },
  sweatshirts:   { jeans:0.9, "track pants":0.9, sweatpants:0.95, joggers:0.9, shorts:0.75, sneakers:0.95, "sports shoes":0.9, "casual shoes":0.85, watches:0.75, caps:0.8, backpacks:0.8 },
  sweaters:      { jeans:0.9, trousers:0.85, chinos:0.8, skirts:0.75, "casual shoes":0.85, boots:0.85, loafers:0.8, watches:0.85, scarves:0.9, belts:0.75 },
  blazers:       { trousers:1.0, "formal trousers":1.0, jeans:0.85, chinos:0.85, "formal shoes":1.0, loafers:0.9, watches:0.95, ties:0.9, shirts:0.85, dresses:0.8 },
  dresses:       { heels:1.0, sandals:0.9, flats:0.85, "casual shoes":0.75, watches:0.85, necklaces:0.95, earrings:0.95, handbags:0.9, sunglasses:0.85, belts:0.8, bracelets:0.8 },
  sarees:        { heels:0.9, sandals:0.85, juttis:0.9, bangles:1.0, earrings:1.0, necklaces:0.95, "clutch":0.9 },
  // BOTTOMS → tops, shoes, accessories
  jeans:         { tshirts:1.0, shirts:0.95, tops:0.95, sweatshirts:0.9, sweaters:0.9, jackets:0.95, sneakers:0.95, "casual shoes":0.9, boots:0.85, loafers:0.8, belts:0.9, watches:0.85 },
  trousers:      { shirts:0.95, blazers:1.0, tops:0.85, sweaters:0.85, "formal shoes":0.95, loafers:0.9, "casual shoes":0.8, belts:0.95, watches:0.9, ties:0.8 },
  shorts:        { tshirts:0.95, shirts:0.85, sweatshirts:0.75, sneakers:0.95, sandals:0.9, "sports shoes":0.85, "casual shoes":0.85, watches:0.75, caps:0.8 },
  skirts:        { tops:0.95, tshirts:0.85, shirts:0.8, kurtas:0.7, heels:0.9, flats:0.9, sandals:0.85, watches:0.8, bracelets:0.85, earrings:0.85, handbags:0.9 },
  leggings:      { kurtas:1.0, tops:0.9, tshirts:0.8, sweatshirts:0.8, "sports shoes":0.85, "casual shoes":0.8, flats:0.8, watches:0.7, handbags:0.75 },
  chinos:        { shirts:0.95, tshirts:0.9, sweaters:0.85, loafers:0.9, "casual shoes":0.85, "formal shoes":0.8, belts:0.9, watches:0.85 },
  // SHOES → tops and bottoms (reverse pairs)
  "casual shoes": { tshirts:0.95, shirts:0.9, jeans:0.9, shorts:0.85, chinos:0.85, watches:0.8, caps:0.75, socks:0.9, backpacks:0.75 },
  sneakers:      { tshirts:0.95, sweatshirts:0.9, jeans:0.9, shorts:0.9, "track pants":0.9, joggers:0.9, watches:0.8, caps:0.85, socks:0.95, backpacks:0.85 },
  "sports shoes": { "track pants":0.95, shorts:0.9, sweatshirts:0.9, tshirts:0.9, joggers:0.95, leggings:0.85, watches:0.8, socks:0.95 },
  heels:         { dresses:1.0, skirts:0.95, tops:0.9, trousers:0.85, jeans:0.75, handbags:0.9, earrings:0.85, bracelets:0.8, watches:0.8, necklaces:0.85 },
  flats:         { tops:0.9, kurtas:0.85, skirts:0.9, jeans:0.75, dresses:0.85, handbags:0.85, watches:0.75, bracelets:0.8, earrings:0.8 },
  sandals:       { dresses:0.9, tops:0.85, kurtas:0.9, shorts:0.85, skirts:0.85, jeans:0.7, watches:0.75, earrings:0.8, handbags:0.8 },
  boots:         { jeans:0.95, trousers:0.85, skirts:0.8, sweaters:0.85, jackets:0.9, chinos:0.8, belts:0.8, watches:0.85 },
  loafers:       { chinos:0.95, trousers:0.9, jeans:0.85, shirts:0.9, blazers:0.9, sweaters:0.85, belts:0.85, watches:0.9 },
  juttis:        { kurtas:0.95, sarees:0.9, leggings:0.8, salwar:0.9, bangles:0.85, earrings:0.85 },
  // ACCESSORIES → various
  watches:       { shirts:0.95, tshirts:0.9, jeans:0.9, trousers:0.95, blazers:0.95, tops:0.85, dresses:0.85, kurtas:0.8, shorts:0.8 },
  belts:         { jeans:0.95, trousers:0.95, shorts:0.85, chinos:0.9, shirts:0.85, blazers:0.9, dresses:0.7 },
  sunglasses:    { tshirts:0.9, shirts:0.85, tops:0.85, dresses:0.85, shorts:0.85, jeans:0.85, caps:0.8 },
  caps:          { tshirts:0.95, sweatshirts:0.9, sneakers:0.85, shorts:0.9, "sports shoes":0.85, jackets:0.8, backpacks:0.75 },
  backpacks:     { tshirts:0.9, sneakers:0.85, "casual shoes":0.8, jeans:0.85, "sports shoes":0.8, shorts:0.8, caps:0.75 },
  handbags:      { tops:0.9, dresses:0.95, skirts:0.9, heels:0.9, flats:0.85, sandals:0.8, watches:0.75 },
  earrings:      { tops:0.9, dresses:0.95, kurtas:0.9, sarees:1.0, heels:0.85, skirts:0.85, necklaces:0.8 },
  necklaces:     { tops:0.9, dresses:0.95, tshirts:0.75, heels:0.85, earrings:0.8, watches:0.7 },
  bracelets:     { tops:0.85, dresses:0.85, tshirts:0.8, watches:0.8, earrings:0.75 },
  bangles:       { kurtas:0.95, sarees:1.0, tops:0.8, earrings:0.85 },
  scarves:       { sweaters:0.9, jackets:0.85, coats:0.9, boots:0.75 },
  ties:          { shirts:0.95, blazers:0.95, "formal trousers":0.9, "formal shoes":0.85 },
  socks:         { sneakers:0.95, "sports shoes":0.9, "casual shoes":0.85, boots:0.8 },
};

// ─── USAGE COMPATIBILITY ───────────────────────────────────────────────────────
// Matches "casual" items together, "formal" together, etc.
const USAGE_RULES = {
  casual:  { casual:1.0, sports:0.5, formal:0.2, ethnic:0.3, party:0.7, smart_casual:0.85 },
  formal:  { formal:1.0, smart_casual:0.75, casual:0.2, ethnic:0.1, sports:0.1, party:0.6 },
  sports:  { sports:1.0, casual:0.5, formal:0.1, ethnic:0.1, party:0.2, smart_casual:0.4 },
  ethnic:  { ethnic:1.0, casual:0.3, formal:0.15, sports:0.1, party:0.6, smart_casual:0.3 },
  party:   { party:1.0, casual:0.7, formal:0.6, ethnic:0.6, sports:0.2, smart_casual:0.75 },
  smart_casual: { smart_casual:1.0, casual:0.85, formal:0.75, party:0.75, ethnic:0.3, sports:0.3 },
};

// ─── BATCH WRITE HELPER ───────────────────────────────────────────────────────
async function batchWrite(items) {
  const BATCH_SIZE = 25;
  let total = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE).map(item => ({
      PutRequest: { Item: item }
    }));
    await docClient.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: batch }
    }));
    total += batch.length;
  }
  return total;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const items = [];

  // COLOR entries
  for (const [base, targets] of Object.entries(COLOR_RULES)) {
    for (const [target, score] of Object.entries(targets)) {
      items.push({
        PK: `COLOR#${base}`,
        SK: `COLOR#${target}`,
        score,
        type: "color",
        baseColor: base,
        targetColor: target,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  console.log(`Color entries: ${items.length}`);

  // ARTICLE entries
  const articleStart = items.length;
  for (const [base, targets] of Object.entries(ARTICLE_RULES)) {
    for (const [target, score] of Object.entries(targets)) {
      items.push({
        PK: `ARTICLE#${base}`,
        SK: `ARTICLE#${target}`,
        score,
        type: "article",
        baseArticle: base,
        targetArticle: target,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  console.log(`Article entries: ${items.length - articleStart}`);

  // USAGE entries
  const usageStart = items.length;
  for (const [base, targets] of Object.entries(USAGE_RULES)) {
    for (const [target, score] of Object.entries(targets)) {
      items.push({
        PK: `USAGE#${base}`,
        SK: `USAGE#${target}`,
        score,
        type: "usage",
        baseUsage: base,
        targetUsage: target,
        updatedAt: new Date().toISOString(),
      });
    }
  }
  console.log(`Usage entries: ${items.length - usageStart}`);
  console.log(`Total items to write: ${items.length}`);

  const written = await batchWrite(items);
  console.log(`✓ Written ${written} items to ${TABLE}`);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
