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

- DynamoDB ProductCatalog stores a CLEANED + ENRICHED version of this data
- Base fields extracted and normalized:
    productId, name, category, articleType, color, price, gender, season, usage

- Additional fields written by backend/scripts/enrich-catalog-from-s3.py (one-time enrichment):
    pattern, fit, fabric, occasion, baseColour, availableSizes, sleeveLength, neckType, idealFor

- S3 JSON is NOT queried at runtime for performance reasons
- 60 concurrent workers enriched all 44,426 products in ~4 minutes
- The enriched DynamoDB attributes are read directly by vestia-recommend at scoring time
    (pattern and fabric fields feed the pattern/fabric compatibility signals)