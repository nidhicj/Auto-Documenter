import jwt
from datetime import datetime, timezone

secret = "SUPER_SECRET_KEY_CHANGE_ME"

payload = {
    "sub": "user_123",
    "role": "admin",
    # no "exp"
}

token = jwt.encode(payload, secret, algorithm="HS256")
print(token)
