Product JSON Structure (S3 Raw Data)

Each file in:
s3://vestia-product-data-ca/raw/myntra/json/{id}.json

represents a full product object from the Myntra dataset.

---

Top Level:
- data → main product object

---

Key Fields Used in Vestia:

Identification:
- data.id → productId
- data.articleNumber → SKU

Basic Info:
- data.productDisplayName → name
- data.brandName → brand
- data.gender → gender
- data.baseColour → color
- data.usage → usage (Casual, Sports, etc.)
- data.season → season

Categorization:
- data.masterCategory.typeName → category (e.g. Apparel)
- data.subCategory.typeName → subcategory (e.g. Topwear)
- data.articleType.typeName → articleType (e.g. Tshirts)

Pricing:
- data.price → price
- data.discountedPrice → discounted price

Images:
- data.styleImages.default.imageURL → main image

Attributes:
- data.articleAttributes → additional metadata (fit, fabric, occasion)

Sizes:
- data.styleOptions → available sizes

---

System Usage:

- DynamoDB ProductCatalog stores a CLEANED version of this data
- Only key fields are extracted and normalized:
    productId, name, category, articleType, color, price, gender, season

- S3 JSON is NOT queried at runtime for performance reasons
- It acts as:
    → raw dataset
    → enrichment source (optional)