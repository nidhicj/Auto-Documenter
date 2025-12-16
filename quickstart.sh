tar \
  --exclude='**/.env*' \
  --exclude='node_modules' \
  --exclude='**/node_modules' \
  --exclude='build' \
  -czvf extension.tar.gz .
