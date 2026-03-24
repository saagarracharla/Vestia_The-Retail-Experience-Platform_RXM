import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  try {
    const { productId, targetCategory, gender } = JSON.parse(event.body);
    
    if (!productId || !targetCategory) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "productId and targetCategory are required" })
      };
    }

    // Get current product for context
    const currentProduct = await getCurrentProduct(productId);
    
    // Build co-scan affinity from recent sessions
    const coScanAffinity = await buildCoScanAffinity(productId);
    
    // Get candidate products with hard filters
    const candidates = await getCandidateProducts(targetCategory, gender, productId);
    
    // Score each candidate
    const scoredRecommendations = candidates.map(candidate => {
      const score = calculateScore(candidate, currentProduct, coScanAffinity);
      return {
        productId: candidate.productId,
        name: candidate.name,
        category: candidate.category,
        articleType: candidate.articleType,
        color: candidate.color,
        price: candidate.price,
        score: Math.round(score * 1000) / 1000 // Round to 3 decimals
      };
    });

    // Sort by score DESC and return top 5
    const recommendations = scoredRecommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendations)
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};

async function getCurrentProduct(productId) {
  const result = await docClient.send(new ScanCommand({
    TableName: "ProductCatalog",
    FilterExpression: "productId = :pid",
    ExpressionAttributeValues: { ":pid": productId }
  }));
  return result.Items?.[0] || {};
}

async function buildCoScanAffinity(targetProductId) {
  // Query recent SCAN events (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const result = await docClient.send(new ScanCommand({
    TableName: "VestiaSessions",
    FilterExpression: "entityType = :type AND createdAt > :date",
    ExpressionAttributeValues: {
      ":type": "SCAN",
      ":date": thirtyDaysAgo
    }
  }));

  // Group scans by session
  const sessionGroups = {};
  (result.Items || []).forEach(scan => {
    if (!sessionGroups[scan.sessionId]) {
      sessionGroups[scan.sessionId] = [];
    }
    sessionGroups[scan.sessionId].push(scan.sku);
  });

  // Build co-occurrence counts
  const coOccurrence = {};
  Object.values(sessionGroups).forEach(skus => {
    if (skus.includes(targetProductId)) {
      skus.forEach(sku => {
        if (sku !== targetProductId) {
          coOccurrence[sku] = (coOccurrence[sku] || 0) + 1;
        }
      });
    }
  });

  // Normalize to 0-1 range
  const maxCount = Math.max(...Object.values(coOccurrence), 1);
  const normalized = {};
  Object.entries(coOccurrence).forEach(([sku, count]) => {
    normalized[sku] = count / maxCount;
  });

  return normalized;
}

async function getCandidateProducts(targetCategory, gender, excludeProductId) {
  const scanParams = {
    TableName: "ProductCatalog",
    FilterExpression: "category = :category AND productId <> :exclude",
    ExpressionAttributeValues: {
      ":category": targetCategory,
      ":exclude": excludeProductId
    }
  };

  // Add gender filter if provided
  if (gender) {
    scanParams.FilterExpression += " AND (#gender = :gender OR #gender = :unisex)";
    scanParams.ExpressionAttributeNames = { "#gender": "gender" };
    scanParams.ExpressionAttributeValues[":gender"] = gender;
    scanParams.ExpressionAttributeValues[":unisex"] = "unisex";
  }

  const result = await docClient.send(new ScanCommand(scanParams));
  return result.Items || [];
}

function calculateScore(candidate, currentProduct, coScanAffinity) {
  // Co-scan affinity (0.4 weight)
  const coScanScore = coScanAffinity[candidate.productId] || 0;
  
  // Color match (0.15 weight)
  const colorMatch = candidate.color === currentProduct.color ? 1 : 0;
  
  // Price proximity (0.15 weight)
  const priceDiff = Math.abs((candidate.price || 0) - (currentProduct.price || 0));
  const maxPriceDiff = Math.max(candidate.price || 1, currentProduct.price || 1);
  const priceProximity = Math.max(0, 1 - (priceDiff / maxPriceDiff));
  
  // Recency boost (0.05 weight) - favor higher productIds as proxy for newer
  const recencyBoost = Math.min(1, parseInt(candidate.productId) / 50000);
  
  // Session similarity placeholder (0.3 weight) - would need current session context
  const sessionSimilarity = 0.2; // Base similarity score
  
  const finalScore = 
    (coScanScore * 0.4) +
    (sessionSimilarity * 0.3) +
    (colorMatch * 0.15) +
    (priceProximity * 0.15) +
    (recencyBoost * 0.05);

  return Math.max(0.1, Math.min(1.0, finalScore)); // Clamp between 0.1-1.0
}
