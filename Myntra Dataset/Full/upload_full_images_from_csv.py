import csv
import os
import requests
import boto3
import mimetypes
from botocore.exceptions import ClientError

# -------- CONFIG --------
CSV_PATH = "images.csv"
S3_BUCKET = "vestia-product-images"
S3_PREFIX = "full/"
TMP_DIR = "/tmp/full_images"
REQUEST_TIMEOUT = 30
# ------------------------

os.makedirs(TMP_DIR, exist_ok=True)

s3 = boto3.client("s3")

def s3_exists(bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError:
        return False

def main():
    success = 0
    skipped = 0
    failed = 0

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        for i, row in enumerate(reader, start=1):
            filename = row["filename"].strip()
            url = row["link"].strip()
            s3_key = f"{S3_PREFIX}{filename}"
            local_path = os.path.join(TMP_DIR, filename)

            if s3_exists(S3_BUCKET, s3_key):
                skipped += 1
                if skipped % 500 == 0:
                    print(f"⏭️  Skipped {skipped}")
                continue

            try:
                print(f"[{i}] Downloading {filename}")
                resp = requests.get(url, timeout=REQUEST_TIMEOUT)
                resp.raise_for_status()

                with open(local_path, "wb") as img:
                    img.write(resp.content)

                content_type = resp.headers.get(
                    "Content-Type",
                    mimetypes.guess_type(filename)[0] or "image/jpeg"
                )

                s3.upload_file(
                    local_path,
                    S3_BUCKET,
                    s3_key,
                    ExtraArgs={
                        "ContentType": content_type,
                        "CacheControl": "public, max-age=31536000"
                    }
                )

                success += 1
                if success % 500 == 0:
                    print(f"✅ Uploaded {success}")

            except Exception as e:
                failed += 1
                print(f"❌ Failed {filename}: {e}")

            finally:
                if os.path.exists(local_path):
                    os.remove(local_path)

    print("\n🎉 DONE")
    print(f"✅ Uploaded: {success}")
    print(f"⏭️  Skipped:  {skipped}")
    print(f"❌ Failed:   {failed}")

if __name__ == "__main__":
    main()