import pandas as pd

CSV_PATH = "styles 2.csv"

df = pd.read_csv(
    CSV_PATH,
    engine="python",
    on_bad_lines="skip"
)

def show_uniques(col, limit=30):
    values = (
        df[col]
        .dropna()
        .astype(str)
        .str.strip()
        .str.lower()
        .value_counts()
    )
    print(f"\n=== {col} ({len(values)} unique) ===")
    print(values.head(limit))

# Inspect critical columns
show_uniques("baseColour")
show_uniques("articleType")
show_uniques("subCategory")
show_uniques("gender")