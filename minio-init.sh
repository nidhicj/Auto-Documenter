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

# Configure CORS to allow Chrome extensions and all origins
echo "Configuring CORS for MinIO..."
cat > /tmp/cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF
mc anonymous set-json /tmp/cors.json myminio/${S3_BUCKET} 2>/dev/null || mc cors set /tmp/cors.json myminio/${S3_BUCKET} 2>/dev/null || echo "Note: CORS may need manual configuration via MinIO console"

echo "MinIO initialization complete!"