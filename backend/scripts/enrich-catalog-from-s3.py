"""
Enrich ProductCatalog DynamoDB table with rich attributes from S3 JSONs.

Reads raw/myntra/json/{productId}.json for every item in ProductCatalog and
adds: pattern, fit, fabric, occasion, baseColour, sleeveLength, availableSizes.

Runs with 60 concurrent workers — takes ~3-5 minutes for 44k products.
"""

import boto3
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal

REGION       = "ca-central-1"
BUCKET       = "vestia-product-data-ca"
JSON_PREFIX  = "raw/myntra/json/"
TABLE        = "ProductCatalog"
MAX_WORKERS  = 60

s3  = boto3.client("s3",      region_name=REGION)
ddb = boto3.resource("dynamodb", region_name=REGION)
table = ddb.Table(TABLE)

# ── Step 1: Scan all productIds from ProductCatalog ───────────────────────────
print("Scanning ProductCatalog for all productIds…")
product_ids = []
last_key = None
while True:
    kwargs = {"ProjectionExpression": "productId"}
    if last_key:
        kwargs["ExclusiveStartKey"] = last_key
    r = table.scan(**kwargs)
    product_ids.extend(i["productId"] for i in r["Items"])
    last_key = r.get("LastEvaluatedKey")
    if not last_key:
        break
print(f"Found {len(product_ids)} products.\n")

# ── Step 2: Fetch S3 JSON + extract attributes ────────────────────────────────
def fetch_and_update(product_id):
    key = f"{JSON_PREFIX}{product_id}.json"
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        raw = json.loads(obj["Body"].read())
        data = raw.get("data", raw)

        attrs = data.get("articleAttributes", {})

        pattern       = attrs.get("Pattern")         or attrs.get("pattern")
        fit           = attrs.get("Fit")             or attrs.get("fit")
        fabric        = attrs.get("Fabric")          or attrs.get("fabric")
        occasion      = attrs.get("Occasion")        or attrs.get("occasion")
        ideal_for     = attrs.get("Ideal For")       or attrs.get("idealFor")
        sleeve_length = attrs.get("Sleeve Length")   or attrs.get("sleeveLength")
        neck          = attrs.get("Neck")            or attrs.get("neck")
        base_colour   = data.get("baseColour")       or data.get("base_colour")

        # Available sizes from styleOptions
        style_options  = data.get("styleOptions", [])
        available_sizes = list({
            o.get("size") for o in style_options
            if o.get("size") and o.get("available") is True
        })
        # Fallback: collect all sizes even if not "available" (Myntra data has all false)
        all_sizes = list({
            o.get("size") for o in style_options if o.get("size")
        })

        # Build update expression only for non-null fields
        updates = {}
        if pattern:        updates["pattern"]       = pattern
        if fit:            updates["fit"]            = fit
        if fabric:         updates["fabric"]         = fabric
        if occasion:       updates["occasion"]       = occasion
        if ideal_for:      updates["idealFor"]       = ideal_for
        if sleeve_length:  updates["sleeveLength"]   = sleeve_length
        if neck:           updates["neckType"]       = neck
        if base_colour:    updates["baseColour"]     = base_colour
        if all_sizes:      updates["availableSizes"] = all_sizes

        if not updates:
            return ("skip", product_id)

        # Build DynamoDB UpdateExpression
        expr_parts  = []
        expr_names  = {}
        expr_values = {}
        for i, (field, val) in enumerate(updates.items()):
            placeholder = f"#f{i}"
            valph       = f":v{i}"
            expr_names[placeholder]  = field
            expr_values[valph]       = val
            expr_parts.append(f"{placeholder} = {valph}")

        table.update_item(
            Key={"productId": product_id},
            UpdateExpression="SET " + ", ".join(expr_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )
        return ("ok", product_id)

    except s3.exceptions.NoSuchKey:
        return ("missing", product_id)
    except Exception as e:
        return ("error", f"{product_id}: {e}")

# ── Step 3: Run concurrently ──────────────────────────────────────────────────
print(f"Enriching {len(product_ids)} products with {MAX_WORKERS} workers…")
counts = {"ok": 0, "skip": 0, "missing": 0, "error": 0}
errors = []

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {executor.submit(fetch_and_update, pid): pid for pid in product_ids}
    for i, future in enumerate(as_completed(futures)):
        status, detail = future.result()
        counts[status] += 1
        if status == "error":
            errors.append(detail)
        if (i + 1) % 500 == 0:
            pct = (i + 1) / len(product_ids) * 100
            print(f"  {i+1:5d}/{len(product_ids)}  ({pct:.0f}%)  "
                  f"ok={counts['ok']}  skip={counts['skip']}  "
                  f"missing={counts['missing']}  errors={counts['error']}")

print(f"\n✓ Done.")
print(f"  Updated:  {counts['ok']}")
print(f"  Skipped (no attrs): {counts['skip']}")
print(f"  Missing JSON: {counts['missing']}")
print(f"  Errors: {counts['error']}")
if errors[:5]:
    print("  First errors:", errors[:5])
