import json
import boto3

# -----------------------------
# CONFIG
# -----------------------------
S3_BUCKET = "vestia-raw-datasets"
S3_KEY = "urstyle/fashion_products.json"
DDB_TABLE = "VestiaProducts"

# -----------------------------
# AWS CLIENTS
# -----------------------------
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DDB_TABLE)

# -----------------------------
# HELPERS
# -----------------------------
def normalize_layer(layer):
    return {
        1: "head",
        2: "top",
        3: "bottom",
        4: "shoes",
        5: "accessory"
    }.get(layer, "other")

def normalize_color(color):
    return color.lower().strip() if color else "unknown"

# -----------------------------
# LOAD JSON FROM S3
# -----------------------------
print("📥 Loading fashion_products.json from S3...")
response = s3.get_object(Bucket=S3_BUCKET, Key=S3_KEY)
products = json.loads(response["Body"].read())

print(f"Found {len(products)} products")

# -----------------------------
# INGEST INTO DYNAMODB
# -----------------------------
written = 0

for product in products:
    sku = product.get("_id")
    if not sku:
        continue

    item = {
        "PK": f"PRODUCT#{sku}",
        "SK": "META",

        "sku": sku,
        "name": product.get("name"),
        "brand": product.get("brand"),
        "color": normalize_color(product.get("color")),
        "layer": normalize_layer(product.get("layer")),
        "imageUrl": product.get("imgOriginal"),

        "popularity": product.get("addCount", 0),
        "commentCount": product.get("commentCount", 0),
        "stickerCount": product.get("stickerCount", 0),

        "source": "urstyle"
    }

    table.put_item(Item=item)
    written += 1

    if written % 500 == 0:
        print(f"✔ Inserted {written} products")

print(f"✅ Finished ingesting {written} products into VestiaProducts")