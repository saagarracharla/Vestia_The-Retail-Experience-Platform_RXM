import boto3
import csv
from decimal import Decimal

TABLE_NAME = "ProductCatalog"
CSV_PATH = "product_catalog_normalized.csv"
REGION = "ca-central-1"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

def to_decimal(val):
    try:
        return Decimal(str(val))
    except:
        return None

with open(CSV_PATH, newline="", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)

    with table.batch_writer(overwrite_by_pkeys=["productId"]) as batch:
        for row in reader:
            item = {
                "productId": row["productId"],
                "name": row["name"],
                "gender": row["gender"].lower(),
                "category": row["category"],
                "articleType": row["articleType"].lower(),
                "color": row["color"],
                "season": row["season"],
                "usage": row["usage"],
                "price": to_decimal(row["price"])
            }

            batch.put_item(Item=item)

print("✅ ProductCatalog upload complete")