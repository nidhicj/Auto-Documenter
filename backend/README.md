# Backend API Documentation

## Base URL

- Local: `http://localhost:3001/api`
- Production: `https://api.scribe-ai.com/api`

## Authentication

All endpoints (except `/embed/*`) require JWT authentication.

Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST `/auth/login`
Login and get JWT token.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Guides

#### POST `/guides/workflows`
Create guide from workflow event.

**Request**:
```json
{
  "id": "workflow-uuid",
  "events": [...],
  "screenshots": [...],
  "startTime": 1234567890,
  "endTime": 1234567891,
  "url": "https://example.com",
  "title": "Workflow Title"
}
```

**Response**:
```json
{
  "id": "guide-uuid",
  "title": "Workflow Title",
  "description": "...",
  "steps": [...]
}
```

#### GET `/guides`
Get all guides for organization.

**Response**:
```json
[
  {
    "id": "guide-uuid",
    "title": "Guide Title",
    "description": "...",
    "steps": [...]
  }
]
```

#### GET `/guides/:id`
Get guide by ID.

#### PATCH `/guides/:id`
Update guide.

**Request**:
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### DELETE `/guides/:id`
Delete guide.

#### POST `/guides/:id/steps/reorder`
Reorder steps.

**Request**:
```json
{
  "stepIds": ["step-1", "step-2", "step-3"]
}
```

#### PATCH `/guides/steps/:stepId`
Update step.

**Request**:
```json
{
  "description": "Updated step description"
}
```

#### DELETE `/guides/steps/:stepId`
Delete step.

### Media

#### POST `/media/signed-url`
Get signed URL for screenshot upload.

**Request**:
```json
{
  "contentType": "image/png",
  "expiresIn": 3600
}
```

**Response**:
```json
{
  "signedUrl": "https://s3.amazonaws.com/...",
  "key": "screenshots/123-abc.png"
}
```

#### POST `/media/upload-complete`
Notify backend that upload is complete.

**Request**:
```json
{
  "key": "screenshots/123-abc.png",
  "stepIndex": 0,
  "timestamp": 1234567890,
  "domEvent": {...}
}
```

#### GET `/media/:key`
Get media URL.

### Export

#### GET `/export/pdf/:guideId`
Export guide as PDF.

#### GET `/export/html/:guideId`
Export guide as HTML.

#### GET `/export/markdown/:guideId`
Export guide as Markdown.

### Embed

#### GET `/embed/:id`
Get guide for embedding (no auth required).

**Response**:
```json
{
  "guide": {
    "id": "guide-uuid",
    "title": "Guide Title",
    "description": "...",
    "steps": [...]
  }
}
```

### Redaction

#### POST `/redaction/process`
Process screenshot for OCR and PII detection.

**Request**:
```json
{
  "stepId": "step-uuid",
  "screenshotUri": "https://..."
}
```

**Response**:
```json
{
  "ocr": {
    "text": "Extracted text",
    "confidence": 0.95
  },
  "pii": {
    "entities": [...],
    "blurredRegions": [...]
  }
}
```

#### POST `/redaction/apply`
Apply redaction blur to screenshot.

**Request**:
```json
{
  "screenshotUri": "https://...",
  "blurredRegions": [
    {
      "x": 100,
      "y": 200,
      "width": 150,
      "height": 30
    }
  ]
}
```

**Response**:
```json
{
  "redactedUri": "https://.../redacted.png"
}
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user



