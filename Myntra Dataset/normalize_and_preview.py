import pandas as pd

CSV_PATH = "styles 2.csv"

df = pd.read_csv(
    CSV_PATH,
    engine="python",
    on_bad_lines="skip"
)

# ---- COLOR NORMALIZATION ----
COLOR_MAP = {
    "navy blue": "blue",
    "off white": "white",
    "cream": "white",
    "charcoal": "grey",
    "grey melange": "grey",
    "khaki": "beige",
    "tan": "beige",
    "olive": "green",
    "maroon": "red"
}

df["normColor"] = (
    df["baseColour"]
    .str.lower()
    .map(COLOR_MAP)
    .fillna(df["baseColour"].str.lower())
)

# ---- CATEGORY NORMALIZATION ----
TOPS = {"tshirts", "shirts", "tops", "kurtas", "dresses"}
BOTTOMS = {"jeans", "trousers", "shorts"}
SHOES = {"casual shoes", "sports shoes", "heels", "sandals", "flats"}

def map_category(row):
    at = str(row["articleType"]).lower()
    if at in TOPS:
        return "top"
    if at in BOTTOMS:
        return "bottom"
    if at in SHOES:
        return "shoes"
    return "accessory"

df["category"] = df.apply(map_category, axis=1)

print("\nNormalized colors:")
print(df["normColor"].value_counts().head(15))

print("\nNormalized categories:")
print(df["category"].value_counts())