import csv
import requests
import boto3
from io import BytesIO

BUCKET = "vestia-product-images"
PREFIX = "full/"

# Load missing IDs
with open("/tmp/missing_ids.txt") as f:
    missing_ids = set(line.strip() for line in f if line.strip().isdigit())

s3 = boto3.client("s3")

success = 0
failed = 0

with open("images.csv", newline="", encoding="utf-8") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        filename = row["filename"].replace(".jpg", "")
        if filename not in missing_ids:
            continue

        url = row["link"]
        key = f"{PREFIX}{filename}.jpg"

        try:
            print(f"Retrying {filename}.jpg")
            r = requests.get(url, timeout=20)
            r.raise_for_status()

            s3.upload_fileobj(
                BytesIO(r.content),
                BUCKET,
                key,
                ExtraArgs={"ContentType": "image/jpeg"}
            )

            success += 1

        except Exception as e:
            failed += 1
            print(f"❌ Failed {filename}: {e}")

print("\n🎉 RETRY DONE")
print(f"✅ Uploaded: {success}")
print(f"❌ Failed:   {failed}")