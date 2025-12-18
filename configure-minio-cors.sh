#!/bin/bash

# Script to configure MinIO CORS for Chrome extension uploads
# This allows the extension to upload directly to MinIO

echo "Configuring MinIO CORS..."

# Get MinIO credentials from environment or use defaults
MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin123}
S3_BUCKET=${S3_BUCKET:-scribe-media}

# Configure mc client
mc alias set myminio http://localhost:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD}

# Create CORS configuration file
cat > /tmp/cors-config.json <<EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# Apply CORS configuration to bucket
echo "Applying CORS configuration to bucket: ${S3_BUCKET}"
mc anonymous set-json /tmp/cors-config.json myminio/${S3_BUCKET} 2>/dev/null || \
mc cors set /tmp/cors-config.json myminio/${S3_BUCKET} 2>/dev/null || \
echo "Note: CORS configuration may need to be done via MinIO Console at http://localhost:9001"

# Alternative: Configure via MinIO admin API (requires admin credentials)
echo ""
echo "If the above didn't work, configure CORS via MinIO Console:"
echo "1. Go to http://localhost:9001"
echo "2. Login with ${MINIO_ROOT_USER} / ${MINIO_ROOT_PASSWORD}"
echo "3. Go to Settings > CORS"
echo "4. Add rule:"
echo "   - Allowed Origins: *"
echo "   - Allowed Methods: GET, PUT, POST, DELETE, HEAD"
echo "   - Allowed Headers: *"
echo "   - Expose Headers: ETag, Content-Length"
echo "   - Max Age: 3000"

echo ""
echo "CORS configuration complete!"





