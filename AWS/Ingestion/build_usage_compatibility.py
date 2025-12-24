import boto3
from collections import defaultdict
from itertools import combinations
from decimal import Decimal

# ---------- CONFIG ----------
REGION = "ca-central-1"
PRODUCT_TABLE = "ProductCatalog"
COMPAT_TABLE = "CompatibilityStats"

# ---------- AWS ----------
dynamodb = boto3.resource("dynamodb", region_name=REGION)
product_table = dynamodb.Table(PRODUCT_TABLE)
compat_table = dynamodb.Table(COMPAT_TABLE)

# ---------- STEP 1: Scan ProductCatalog ----------
print("Scanning ProductCatalog for usage data...")

products = []
scan_kwargs = {}

while True:
    response = product_table.scan(**scan_kwargs)
    products.extend(response.get("Items", []))

    if "LastEvaluatedKey" not in response:
        break

    scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

print(f"Loaded {len(products)} products")

# ---------- STEP 2: Group usage by gender ----------
usage_by_gender = defaultdict(set)

for product in products:
    gender = product.get("gender")
    usage = product.get("usage")

    if gender and usage:
        usage_by_gender[gender].add(usage)

# ---------- STEP 3: Count usage transitions ----------
pair_counts = defaultdict(int)

for gender, usages in usage_by_gender.items():
    if len(usages) < 2:
        continue

    for a, b in combinations(sorted(usages), 2):
        pair_counts[f"{a}->{b}"] += 1
        pair_counts[f"{b}->{a}"] += 1

print(f"Computed {len(pair_counts)} usage transitions")

# ---------- STEP 4: Normalize scores ----------
max_count = max(pair_counts.values()) if pair_counts else 1

normalized_scores = {
    key: value / max_count
    for key, value in pair_counts.items()
}

# ---------- STEP 5: Write to DynamoDB ----------
print("Writing USAGE compatibility to DynamoDB...")

for stat_key, score in normalized_scores.items():
    compat_table.put_item(
        Item={
            "statType": "USAGE",
            "statKey": stat_key,
            "score": Decimal(str(round(score, 4))),
            "count": Decimal(pair_counts[stat_key])
        }
    )

print("✅ USAGE compatibility build complete")