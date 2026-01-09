import pandas as pd
import random

# -------- CONFIG --------
CSV_PATH = "styles 2.csv"
OUTPUT_PATH = "product_catalog_normalized.csv"

random.seed(42)

# -------- LOAD CSV (robust parsing) --------
df = pd.read_csv(
    CSV_PATH,
    engine="python",
    on_bad_lines="skip"
)

# -------- NORMALIZE COLOR --------
def normalize_color(c):
    if pd.isna(c):
        return "unknown"
    c = c.lower().strip()

    color_map = {
        "navy blue": "blue",
        "off white": "white",
        "grey melange": "grey",
        "charcoal": "grey",
        "cream": "beige",
        "peach": "orange",
        "khaki": "green",
        "lavender": "purple",
        "skin": "beige",
        "tan": "brown",
        "maroon": "red"
    }

    return color_map.get(c, c)

df["normColor"] = df["baseColour"].apply(normalize_color)

# -------- NORMALIZE CATEGORY --------
def normalize_category(row):
    sub = str(row["subCategory"]).lower()
    art = str(row["articleType"]).lower()

    if sub in ["shoes", "sandal", "flip flops"]:
        return "shoes"
    if sub in ["bottomwear"]:
        return "bottom"
    if sub in ["topwear", "dress", "apparel set"]:
        return "top"
    if sub in ["bags", "wallets", "watches", "belts", "eyewear", "jewellery"]:
        return "accessory"

    # fallback heuristic
    if any(x in art for x in ["shoe", "sandal", "heel", "flip"]):
        return "shoes"
    if any(x in art for x in ["jean", "pant", "short", "trouser"]):
        return "bottom"

    return "top"

df["category"] = df.apply(normalize_category, axis=1)

# -------- ASSIGN REALISTIC PRICES --------
def assign_price(category):
    if category == "top":
        return random.randint(20, 50)
    if category == "bottom":
        return random.randint(30, 60)
    if category == "shoes":
        return random.randint(50, 100)
    if category == "accessory":
        return random.randint(15, 80)
    return random.randint(20, 50)

df["price"] = df["category"].apply(assign_price)

# -------- PRODUCT ID --------
df["productId"] = df["id"].astype(str)

# -------- FINAL SHAPE (DYNAMODB-READY) --------
final_df = df[
    [
        "productId",
        "productDisplayName",
        "gender",
        "category",
        "articleType",
        "normColor",
        "season",
        "usage",
        "price"
    ]
].rename(
    columns={
        "productDisplayName": "name",
        "normColor": "color"
    }
)

# -------- EXPORT --------
final_df.to_csv(OUTPUT_PATH, index=False)

print("✅ Export complete")
print(f"Rows: {len(final_df)}")
print(final_df.head(5))