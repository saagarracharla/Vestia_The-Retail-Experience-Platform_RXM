import delta_sharing
import pandas as pd

# --------------------------------------------------
# 1️⃣ Connect to Delta Sharing using credential file
# --------------------------------------------------
client = delta_sharing.SharingClient("urstyle.share")

# --------------------------------------------------
# 2️⃣ Resolve share and schema
# --------------------------------------------------
shares = client.list_shares()
share = shares[0]

schemas = client.list_schemas(share)
schema = schemas[0]

print("Using share:", share.name)
print("Using schema:", schema.name)

# --------------------------------------------------
# 3️⃣ Build Delta Sharing table URLs
# --------------------------------------------------
products_url = (
    f"urstyle.share#{schema.share}.{schema.name}.fashion_products"
)

outfits_url = (
    f"urstyle.share#{schema.share}.{schema.name}.outfit_combinations"
)

# --------------------------------------------------
# 4️⃣ Load tables into Pandas
# --------------------------------------------------
print("\nLoading fashion_products...")
df_products = delta_sharing.load_as_pandas(products_url)

print("Loading outfit_combinations...")
df_outfits = delta_sharing.load_as_pandas(outfits_url)

# --------------------------------------------------
# 5️⃣ Inspect data (sanity check)
# --------------------------------------------------
print("\n=== Products Preview ===")
print(df_products.head())

print("\n=== Outfits Preview ===")
print(df_outfits.head())

print("\n=== Row Counts ===")
print("Products:", len(df_products))
print("Outfits:", len(df_outfits))

# --------------------------------------------------
# 6️⃣ Export to JSON (RAW DATA LAYER)
# --------------------------------------------------
df_products.to_json(
    "fashion_products.json",
    orient="records",
    indent=2
)

df_outfits.to_json(
    "outfit_combinations.json",
    orient="records",
    indent=2
)

print("\n✅ Export complete:")
print(" - fashion_products.json")
print(" - outfit_combinations.json")