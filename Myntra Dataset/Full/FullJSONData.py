import json
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

# ========= CONFIG =========
BUCKET = "vestia-product-data-ca"
S3_PREFIX = "raw/myntra/json/"

USB_JSON_DIR = Path(
    "/Volumes/USB DATA/fashion-dataset/fashion-dataset/styles"
)
# ==========================

def is_valid_json(path: Path) -> bool:
    try:
        with path.open("r", encoding="utf-8") as f:
            json.load(f)
        return True
    except Exception:
        return False

def main():
    if not USB_JSON_DIR.exists():
        raise SystemExit(f"USB path not found: {USB_JSON_DIR}")

    json_files = sorted(USB_JSON_DIR.glob("*.json"))

    if not json_files:
        raise SystemExit("No JSON files found on USB")

    print(f"Found {len(json_files)} JSON files on USB")
    print(f"Uploading to s3://{BUCKET}/{S3_PREFIX}")

    s3 = boto3.client("s3")

    uploaded = 0
    skipped = 0
    failed = 0

    for path in json_files:
        if not is_valid_json(path):
            print(f"SKIP invalid JSON: {path.name}")
            skipped += 1
            continue

        s3_key = f"{S3_PREFIX}{path.name}"

        try:
            s3.upload_file(
                Filename=str(path),
                Bucket=BUCKET,
                Key=s3_key,
                ExtraArgs={"ContentType": "application/json"},
            )
            uploaded += 1
            if uploaded % 100 == 0:
                print(f"Uploaded {uploaded}/{len(json_files)}")
        except ClientError as e:
            failed += 1
            print(f"FAIL {path.name}: {e}")

    print("\nUpload complete")
    print(f"Uploaded: {uploaded}")
    print(f"Skipped invalid: {skipped}")
    print(f"Failed: {failed}")

if __name__ == "__main__":
    main()