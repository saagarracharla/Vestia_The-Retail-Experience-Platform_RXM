/**
 * vestia-customer-profile Lambda
 *
 * GET  /customer/{customerId}      → fetch profile
 * PUT  /customer/{customerId}      → create or update profile
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  const method = event.requestContext?.http?.method;
  const customerId = event.pathParameters?.customerId;

  if (!customerId) {
    return res(400, { error: "customerId is required" });
  }

  try {
    if (method === "GET") {
      const result = await docClient.send(new GetCommand({
        TableName: "CustomerProfiles",
        Key: { customerId },
      }));

      if (!result.Item) {
        return res(404, { error: "Customer not found" });
      }

      // Compute derivedStyle from purchase history so the recommend
      // Lambda and frontend can use it without re-computing
      const profile = { ...result.Item, derivedStyle: deriveStyle(result.Item.purchaseHistory || []) };
      return res(200, profile);
    }

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const now = new Date().toISOString();

      // Fetch existing to increment visitCount
      const existing = await docClient.send(new GetCommand({
        TableName: "CustomerProfiles",
        Key: { customerId },
      }));

      const profile = {
        customerId,
        gender:           body.gender           ?? existing.Item?.gender           ?? null,
        preferredSizes:   body.preferredSizes   ?? existing.Item?.preferredSizes   ?? {},
        preferredColors:  body.preferredColors  ?? existing.Item?.preferredColors  ?? [],
        preferredStyles:  body.preferredStyles  ?? existing.Item?.preferredStyles  ?? [],
        // Merge purchase history (append new entries)
        purchaseHistory:  [
          ...(existing.Item?.purchaseHistory ?? []),
          ...(body.purchaseHistory ?? []),
        ].slice(-50), // keep last 50 purchases
        visitCount:  (existing.Item?.visitCount ?? 0) + (body.incrementVisit ? 1 : 0),
        lastVisitAt: body.incrementVisit ? now : (existing.Item?.lastVisitAt ?? now),
        createdAt:   existing.Item?.createdAt ?? now,
        updatedAt:   now,
      };

      await docClient.send(new PutCommand({
        TableName: "CustomerProfiles",
        Item: profile,
      }));

      return res(200, { profile, message: "Profile saved" });
    }

    return res(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Customer profile error:", err);
    return res(500, { error: "Internal server error" });
  }
};

function res(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

/**
 * Derive style insights from purchase history.
 * Returns top colours, top article types, avg price, and dominant usage style.
 */
function deriveStyle(purchaseHistory) {
  if (!purchaseHistory?.length) return null;

  const colorCount   = {};
  const articleCount = {};
  const styleMap     = {
    tshirts: "casual", shirts: "casual", jeans: "casual", trousers: "formal",
    "sports shoes": "sports", sneakers: "casual", "casual shoes": "casual",
    kurtas: "ethnic", sarees: "ethnic", blazers: "formal", "formal shoes": "formal",
    shorts: "casual", "track pants": "sports", "sports wear": "sports",
  };
  const styleCount = {};
  let totalPrice = 0;

  for (const p of purchaseHistory) {
    const color   = (p.color       || "").toLowerCase();
    const article = (p.articleType || "").toLowerCase();
    if (color)   colorCount[color]     = (colorCount[color]   || 0) + 1;
    if (article) articleCount[article] = (articleCount[article] || 0) + 1;
    totalPrice += Number(p.price) || 0;

    const style = styleMap[article] || "casual";
    styleCount[style] = (styleCount[style] || 0) + 1;
  }

  const topColors   = Object.entries(colorCount).sort((a,b) => b[1]-a[1]).slice(0,4).map(e => e[0]);
  const topArticles = Object.entries(articleCount).sort((a,b) => b[1]-a[1]).slice(0,4).map(e => e[0]);
  const dominantStyle = Object.entries(styleCount).sort((a,b) => b[1]-a[1])[0]?.[0] || "casual";
  const avgPrice = Math.round(totalPrice / purchaseHistory.length);

  return { topColors, topArticles, avgPrice, dominantStyle };
}
