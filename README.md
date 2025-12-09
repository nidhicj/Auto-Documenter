# AutoDoc AI

A production-grade platform that captures user workflows (screenshots + DOM actions), turns them into editable step-by-step guides, and generates AI-powered documentation.

## Architecture

```
┌─────────────────┐
│  Chrome MV3     │
│  Extension      │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │  ┌─────────────────┐
│  Next.js        │◄─┼──┤  NestJS         │
│  Frontend       │  │  │  Backend        │
└─────────────────┘  │  └─────────────────┘
                     │         │
                     │         ▼
                     │  ┌─────────────────┐
                     └─►│  FastAPI        │
                        │  AI Service     │
                        └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ PostgreSQL   │      │   Redis      │      │   S3/MinIO   │
└──────────────┘      └──────────────┘      └──────────────┘
```

## Features

- **Workflow Capture**: Records DOM events + screenshots on clicks, navigation, and DOM changes
- **Screenshot Management**: Throttled capture (1 per 500ms), offline queue, signed URL uploads
- **Step-by-Step Guides**: Auto-generated descriptions with screenshot-linked steps
- **AI Document Generation**: Google Gemini-powered document composition
- **Redaction**: OCR + PII detection with blur rectangles
- **Export**: PDF and HTML export capabilities
- **Embeddable Viewer**: Share guides via embeddable iframe
- **Authentication**: OAuth2 + SAML SSO support
- **Security**: TLS 1.3, AES-256 encryption, JWT, RBAC

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Python 3.10+ (for AI service)
- Chrome/Chromium browser

### Local Development

1. **Clone and install dependencies:**

```bash
npm install
cd extension && npm install
cd ../backend && npm install
cd ../frontend && npm install
cd ../ai-service && pip install -r requirements.txt
```

2. **Set up environment variables:**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp ai-service/.env.example ai-service/.env
```

3. **Start services with Docker Compose:**

```bash
docker compose up -d
```

4. **Load the extension:**

- Build the extension: `cd extension && npm run build`
- Open Chrome → Extensions → Developer mode
- Click "Load unpacked" → Select `extension/dist` directory

5. **Access the application:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- AI Service: http://localhost:8000
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin123)

### Debugging the browser extension and guide ingestion

If the extension popup buttons appear unresponsive or screenshots are missing from the `http://localhost:3000/guide` view, use the following checks:

1. **Extension logs (persisted in the popup):** the popup's **Refresh Logs** button reads entries stored via `chrome.storage.local`. Key lifecycle events ("Received runtime message", "Recording started", "Recording stopped", and network send status) are persisted so you can see whether the background service worker handled the Start/Stop events.
2. **Service worker console:** open `chrome://extensions`, click **Service Worker** under the AutoDoc AI extension, and check for runtime errors (for example, permission errors when injecting the content script or capturing the visible tab).
3. **Backend container logs:** run `docker compose logs -f backend worker` to see workflow ingestion and screenshot processing. The `StepProcessor` logs when screenshot payloads are missing for a step so you can tell whether the extension sent image data or it failed in the backend pipeline.
4. **AI/Media services:** if screenshots upload but URLs are broken, also inspect `docker compose logs -f ai-service minio` to confirm AI enrichment and S3/MinIO availability.

This flow helps pinpoint where the capture failed: popup ➜ background service worker ➜ POST `/api/guides/workflows` ➜ worker queue ➜ MinIO uploads.

## Project Structure

```
autodoc-ai/
├── extension/          # Chrome MV3 extension
│   ├── src/
│   │   ├── record.ts          # Event listener
│   │   ├── screenshot.ts      # Screenshot capture
│   │   ├── uploader.ts        # Signed URL upload
│   │   ├── offlineQueue.ts    # Offline retry logic
│   │   ├── background.ts      # Service worker
│   │   └── popup/             # Extension popup UI
│   └── manifest.json
├── backend/            # NestJS backend
│   ├── src/
│   │   ├── auth/              # Authentication module
│   │   ├── guides/            # Guide CRUD
│   │   ├── media/             # Media service (signed URLs, S3)
│   │   ├── export/            # Export service (PDF/HTML)
│   │   ├── embed/             # Embed viewer
│   │   └── redaction/         # Redaction service
│   └── Dockerfile
├── ai-service/         # FastAPI AI service
│   ├── app/
│   │   ├── ocr.py             # OCR (Tesseract/Vision API)
│   │   ├── pii.py             # PII detection (Presidio)
│   │   ├── composer.py        # Document generation
│   │   └── embeddings.py      # Embeddings for search
│   └── Dockerfile
├── frontend/           # Next.js frontend
│   ├── app/
│   │   ├── guides/            # Guide editor
│   │   ├── redaction/         # Redaction UI
│   │   ├── documents/         # Document composer
│   │   └── embed/             # Embed viewer route
│   └── Dockerfile
└── infra/              # Infrastructure
    ├── terraform/             # Terraform modules
    └── helm/                  # Helm charts
```

## Development Workflow

1. **Start recording**: Click extension icon → Start Recording
2. **Interact with page**: Extension captures events + screenshots
3. **Stop recording**: Click Stop → Workflow sent to backend
4. **Edit guide**: Open frontend → Edit steps, add descriptions
5. **Redact sensitive data**: Use redaction UI to blur PII
6. **Generate document**: AI composes document from steps
7. **Export**: Download as PDF or HTML

## API Documentation

See `backend/README.md` for detailed API documentation.

## Security

- All API endpoints require JWT authentication
- Screenshots uploaded via signed URLs (expire in 1 hour)
- PII detection and redaction before sharing
- RBAC for organization-level access control

## License

Proprietary - All rights reserved


