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
print("Scanning ProductCatalog...")

products = []
scan_kwargs = {}

while True:
    response = product_table.scan(**scan_kwargs)
    products.extend(response.get("Items", []))

    if "LastEvaluatedKey" not in response:
        break

    scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

print(f"Loaded {len(products)} products")

# ---------- STEP 2: Group articles by gender ----------
by_gender = defaultdict(list)

for product in products:
    article = product.get("articleType")
    gender = product.get("gender")

    if article and gender:
        by_gender[gender].append(article)

# ---------- STEP 3: Count ARTICLE transitions ----------
pair_counts = defaultdict(int)

for gender, articles in by_gender.items():
    unique_articles = set(articles)

    # Count bidirectional compatibility
    for a, b in combinations(sorted(unique_articles), 2):
        pair_counts[f"{a}->{b}"] += 1
        pair_counts[f"{b}->{a}"] += 1

print(f"Computed {len(pair_counts)} article transitions")

# ---------- STEP 4: Normalize scores ----------
max_count = max(pair_counts.values())

normalized_scores = {
    key: value / max_count
    for key, value in pair_counts.items()
}

# ---------- STEP 5: Write to DynamoDB ----------
print("Writing CompatibilityStats...")

for stat_key, score in normalized_scores.items():
    compat_table.put_item(
        Item={
            "statType": "ARTICLE",
            "statKey": stat_key,
            "score": Decimal(str(round(score, 4))),
            "count": Decimal(pair_counts[stat_key])
        }
    )

print("✅ ARTICLE compatibility build complete")