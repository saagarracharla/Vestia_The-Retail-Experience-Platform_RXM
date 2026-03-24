import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ca-central-1" });
const doc = DynamoDBDocumentClient.from(client);

const PRODUCT_TABLE = "ProductCatalog";

export const handler = async (event) => {
  try {
    // Works for API Gateway path param OR console test
    const productId =
      event.pathParameters?.sku ||
      event.productId ||
      event.sku;

    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "sku is required" })
      };
    }

    const res = await doc.send(
      new GetCommand({
        TableName: PRODUCT_TABLE,
        Key: { productId }
      })
    );

    if (!res.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Product not found" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(res.Item)
    };
  } catch (err) {
    console.error("Product GET error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};