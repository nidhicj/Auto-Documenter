# AutoDoc AI Architecture

## System Overview

AutoDoc AI is a production-grade platform for capturing user workflows, generating step-by-step guides, and creating AI-powered documentation.

## Component Architecture

### 1. Chrome MV3 Extension

**Location**: `extension/`

**Key Components**:
- `record.ts`: Event listener for DOM events
- `screenshot.ts`: Screenshot capture with throttling (1 per 500ms)
- `uploader.ts`: Signed URL upload to S3
- `offlineQueue.ts`: Offline retry logic for screenshots
- `background.ts`: Service worker for background processing
- `content.ts`: Content script for DOM event capture

**Flow**:
1. User clicks "Start Recording" in popup
2. Content script injects event listeners
3. On click/navigation/DOM change:
   - Capture screenshot (throttled)
   - Record DOM event
   - Store locally in chrome.storage.local
4. On "Stop Recording":
   - POST workflow bundle to backend
   - Backend processes and creates guide

### 2. NestJS Backend

**Location**: `backend/`

**Modules**:

#### Auth Module
- JWT authentication
- OAuth2 + SAML SSO support
- RBAC for organization-level access

#### Guides Module
- CRUD operations for guides
- Step management (create, update, delete, reorder)
- Workflow processing via BullMQ queue
- Step assembly with auto-generated descriptions

#### Media Module
- Signed URL generation for S3 uploads
- Image compression using Sharp
- Per-organization bucket prefixes
- Upload callback handling

#### Export Module
- PDF export using Puppeteer
- HTML export
- Markdown export

#### Embed Module
- Public embed endpoint (no auth)
- Embed token validation
- Guide viewer for iframe embedding

#### Redaction Module
- Integration with AI service for OCR/PII detection
- Blur region application
- Redacted image storage

### 3. FastAPI AI Service

**Location**: `ai-service/`

**Services**:

#### OCR Service
- Tesseract OCR (fallback)
- Google Vision API (primary)
- Text extraction with confidence scores

#### PII Service
- Presidio analyzer for PII detection
- Entity types: EMAIL, PHONE, CREDIT_CARD, SSN, IP, PERSON, LOCATION
- Blur region generation

#### Document Composer
- Google Gemini Pro for document generation
- Style customization (professional, casual, technical, beginner-friendly)
- Markdown output

#### Embedding Service
- Google text-embedding-004 for embeddings
- Step-level and guide-level embeddings
- For search functionality

### 4. Next.js Frontend

**Location**: `frontend/`

**Pages**:
- `/`: Landing page
- `/guides`: Guide list
- `/guides/[id]`: Guide editor
- `/redaction/[stepId]`: Redaction UI
- `/documents/compose`: AI document composer
- `/embed/[id]`: Embed viewer

**Features**:
- Guide CRUD operations
- Step editing with screenshot preview
- Drag-and-drop step reordering
- Redaction UI with PII detection
- Document composition interface
- Export functionality

## Data Flow

### Workflow Capture Flow

```
User Action → Content Script → Background Worker → Screenshot Capture
                                                      ↓
                                              Local Storage
                                                      ↓
                                              Upload Queue
                                                      ↓
                                              Backend API
                                                      ↓
                                              Step Processor
                                                      ↓
                                              Database
```

### Screenshot Upload Flow

```
Extension → Get Signed URL → Upload to S3 → Notify Backend
     ↓
Local Queue (if offline)
     ↓
Retry on connection restore
```

### Guide Generation Flow

```
Workflow Event → Backend → Queue Job → Process Screenshots
                                          ↓
                                    Upload to S3
                                          ↓
                                    Create Steps
                                          ↓
                                    AI Description
                                          ↓
                                    Save to DB
```

## Database Schema

### Guides Table
- `id` (UUID)
- `title` (string)
- `description` (text)
- `organizationId` (string)
- `userId` (string)
- `metadata` (JSONB)
- `createdAt`, `updatedAt`

### Steps Table
- `id` (UUID)
- `guideId` (UUID, FK)
- `stepIndex` (integer)
- `description` (text)
- `screenshotUri` (string)
- `domEvent` (JSONB)
- `redactionMetadata` (JSONB)
- `timestamp` (bigint)
- `createdAt`, `updatedAt`

## Security

### Authentication
- JWT tokens with 7-day expiration
- OAuth2 for SSO
- SAML support for enterprise

### Authorization
- Organization-level RBAC
- User roles: admin, editor, viewer
- Guide-level permissions

### Data Protection
- Screenshots uploaded via signed URLs (1-hour expiration)
- PII detection and redaction
- AES-256 encryption at rest
- TLS 1.3 in transit

## Infrastructure

### Local Development
- Docker Compose for all services
- MinIO for S3-compatible storage
- PostgreSQL and Redis containers

### Production
- Kubernetes (EKS/GKE)
- RDS PostgreSQL
- ElastiCache Redis
- S3 for media storage
- Terraform for infrastructure
- Helm charts for deployment

## Observability

### Metrics
- Prometheus for metrics collection
- Custom metrics for:
  - Screenshot capture rate
  - Upload success/failure
  - Guide creation rate
  - AI service latency

### Logging
- Structured logging (JSON)
- Log levels: DEBUG, INFO, WARN, ERROR
- Centralized logging (ELK stack)

### Tracing
- OpenTelemetry for distributed tracing
- Request correlation IDs
- Performance monitoring

## Scalability

### Horizontal Scaling
- Stateless backend services
- Redis for session storage
- S3 for media storage
- Load balancer for API

### Caching
- Redis for:
  - Guide metadata
  - User sessions
  - API response caching

### Queue Processing
- BullMQ for async jobs:
  - Screenshot processing
  - AI description generation
  - Export generation

## Deployment

### CI/CD Pipeline
1. Code push → GitHub Actions
2. Build Docker images
3. Run tests
4. Deploy to staging
5. Manual approval
6. Deploy to production

### Rollback Strategy
- Blue-green deployment
- Canary releases for frontend
- Database migrations with rollback scripts


