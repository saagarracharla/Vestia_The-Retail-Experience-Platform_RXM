/**
 * vestia-outfit Lambda
 *
 * POST /outfit              → save an outfit, returns { outfitId, shareCode }
 * GET  /outfit/{shareCode}  → fetch a saved outfit by share code
 *
 * Outfits are stored in VestiaSessions table:
 *   PK: OUTFIT#{shareCode}   SK: META
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  const method = event.requestContext?.http?.method;

  try {
    // ── POST /outfit — save an outfit ─────────────────────────────────────────
    if (method === "POST") {
      const { sessionId, customerId, items } = JSON.parse(event.body || "{}");

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res(400, { error: "items array is required" });
      }

      const shareCode = generateShareCode();
      const outfitId  = `outfit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const now       = new Date().toISOString();

      await docClient.send(new PutCommand({
        TableName: "VestiaSessions",
        Item: {
          PK:         `OUTFIT#${shareCode}`,
          SK:         "META",
          outfitId,
          shareCode,
          sessionId:  sessionId  || null,
          customerId: customerId || null,
          items,
          createdAt:  now,
        },
      }));

      return res(200, { outfitId, shareCode });
    }

    // ── GET /outfit/{shareCode} — fetch a saved outfit ─────────────────────────
    if (method === "GET") {
      const shareCode = event.pathParameters?.shareCode;
      if (!shareCode) return res(400, { error: "shareCode is required" });

      const result = await docClient.send(new GetCommand({
        TableName: "VestiaSessions",
        Key: { PK: `OUTFIT#${shareCode}`, SK: "META" },
      }));

      if (!result.Item) return res(404, { error: "Outfit not found" });

      // Strip internal DynamoDB keys before returning
      const { PK, SK, ...outfit } = result.Item;
      return res(200, outfit);
    }

    return res(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("Outfit error:", err);
    return res(500, { error: "Internal server error" });
  }
};

function res(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

/**
 * Generate a 6-char share code using unambiguous alphanumeric characters.
 * Excludes: 0, O, I, 1 to avoid confusion when read aloud or typed manually.
 */
function generateShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
