#!/bin/sh

# Wait for MinIO to be ready
echo "Waiting for MinIO to start..."
sleep 5

# Configure mc client
mc alias set myminio http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# Create bucket if it doesn't exist
if ! mc ls myminio/${S3_BUCKET} > /dev/null 2>&1; then
  echo "Creating bucket: ${S3_BUCKET}"
  mc mb myminio/${S3_BUCKET}
  echo "Bucket created successfully"
else
  echo "Bucket ${S3_BUCKET} already exists"
fi

# Set public read policy for development
echo "Setting public read policy..."
mc anonymous set download myminio/${S3_BUCKET}

echo "MinIO initialization complete!"