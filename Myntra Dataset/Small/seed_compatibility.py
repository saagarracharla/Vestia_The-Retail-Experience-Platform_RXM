import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="ca-central-1")
table = dynamodb.Table("CompatibilityStats")

def put(pk, sk, score):
    table.put_item(
        Item={
            "PK": pk,
            "SK": sk,
            "score": Decimal(str(score)),   # ✅ FIX
            "count": 0
        }
    )

# -------------------------
# ARTICLE TYPE COMPATIBILITY
# -------------------------
ARTICLE_RULES = {
    "shirts": ["jeans", "trousers", "casual shoes"],
    "tshirts": ["jeans", "shorts", "casual shoes"],
    "kurtas": ["trousers", "sandals"],
    "tops": ["jeans", "heels"],
}

for article, targets in ARTICLE_RULES.items():
    for t in targets:
        put(f"ARTICLE#{article}", t, 0.7)

# -------------------------
# COLOR COMPATIBILITY
# -------------------------
COLOR_RULES = {
    "black": ["white", "grey", "blue"],
    "blue": ["white", "black", "grey"],
    "white": ["black", "blue", "brown"],
    "brown": ["beige", "white"],
    "red": ["black", "white"],
}

for color, matches in COLOR_RULES.items():
    for m in matches:
        put(f"COLOR#{color}", m, 0.6)

print("✅ CompatibilityStats seeded successfully")