import csv
import boto3
from decimal import Decimal

# ---------- CONFIG ----------
TABLE_NAME = "ProductCatalog"
CSV_PATH = "product_catalog_normalized_again.csv"
REGION = "ca-central-1"

# ---------- SETUP ----------
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# ---------- HELPERS ----------
def convert_value(v):
    if v is None:
        return None
    v = v.strip()
    if v == "":
        return None
    try:
        return Decimal(v)
    except:
        return v

# ---------- LOAD CSV ----------
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Uploading {len(rows)} products...")

# ---------- BATCH WRITE ----------
with table.batch_writer(overwrite_by_pkeys=["productId"]) as batch:
    for row in rows:
        item = {
            "productId": row["productId"],
            "name": row["name"],
            "gender": row["gender"].lower(),
            "category": row["category"],
            "articleType": row["articleType"],
            "color": row["color"],
            "season": row["season"],
            "usage": row["usage"],
            "price": convert_value(row["price"])
        }

        batch.put_item(Item=item)

print("✅ ProductCatalog upload complete")