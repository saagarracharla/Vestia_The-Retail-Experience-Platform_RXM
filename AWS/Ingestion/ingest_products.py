import boto3
import csv
import io
from botocore.exceptions import ClientError

S3_BUCKET = "vestia-fashion-dataset"
CSV_KEY = "raw/fashion-products/styles.csv"
TABLE_NAME = "ProductCatalog"
IMAGE_PREFIX = "raw/fashion-products/images"

dynamodb = boto3.resource("dynamodb", region_name="ca-central-1")
s3 = boto3.client("s3")

table = dynamodb.Table(TABLE_NAME)


def load_csv_from_s3():
    obj = s3.get_object(Bucket=S3_BUCKET, Key=CSV_KEY)
    return csv.DictReader(io.StringIO(obj["Body"].read().decode("utf-8")))


def transform_row(row):
    return {
        "productId": row["id"],
        "gender": row["gender"],
        "masterCategory": row["masterCategory"],
        "subCategory": row["subCategory"],
        "articleType": row["articleType"],
        "baseColour": row["baseColour"],
        "season": row["season"],
        "usage": row["usage"],
        "displayName": row["productDisplayName"],
        "imageS3Prefix": f"s3://{S3_BUCKET}/{IMAGE_PREFIX}/{row['id']}/"
    }


def ingest():
    rows = load_csv_from_s3()
    count = 0

    with table.batch_writer() as batch:
        for row in rows:
            try:
                batch.put_item(Item=transform_row(row))
                count += 1
                if count % 1000 == 0:
                    print(f"Inserted {count} products...")
            except ClientError as e:
                print("Error inserting row:", row["id"], e)

    print(f"✅ Ingestion complete: {count} products")


if __name__ == "__main__":
    ingest()