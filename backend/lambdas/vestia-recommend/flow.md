Recommendation Flow

Input:
- productId (selected item)
- sessionId

Steps:

1. Fetch base product (ProductCatalog)
2. Fetch candidate products (same category / complementary types)
3. Filter:
   - remove unavailable items
   - apply category constraints
   - apply color constraints

4. Score:
   - base score (category + color)
   - compatibility score (CompatibilityStats)
   - session boost (items already in session)

5. Rank items
6. Take top N results

7. Enrich (optional):
   - fetch brand / usage from S3 JSON

Output:
- ranked list of products