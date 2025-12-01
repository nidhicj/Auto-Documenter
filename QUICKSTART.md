# Quick Start Guide

## Prerequisites

- Node.js 18+ and npm
- Docker & Docker Compose
- Python 3.10+ (for AI service)
- Chrome/Chromium browser
- Google Gemini API key (for AI features) - Get one at https://makersuite.google.com/app/apikey


Required variables:
- `DATABASE_URL` (default: postgresql://autodoc:autodoc_dev_password@localhost:5432/autodoc_ai)
- `REDIS_URL` (default: redis://localhost:6379)
- `JWT_SECRET` (generate a secure secret)
- `GOOGLE_GEMINI_API_KEY` (your Google Gemini API key - get one at https://makersuite.google.com/app/apikey)

## Step 1: Install Dependencies

```bash
# Root dependencies
npm install

# Extension
cd extension && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# AI Service
cd ai-service && pip install -r requirements.txt && cd ..
```

## Step 2: Configure Environment Variables

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your settings

### Frontend
```bash
cd frontend
cp .env.example .env.local
# Edit .env.local if needed
```

### AI Service
```bash
cd ai-service
cp .env.example .env
# Edit .env with GOOGLE_GEMINI_API_KEY
```

## Step 3: Start Services

### Option A: Docker Compose (Recommended)

```bash
# From project root
docker compose up -d

# Check logs
docker compose logs -f
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (ports 9000, 9001)
- Backend (port 3001)
- AI Service (port 8000)
- Frontend (port 3000)
- Worker

### Option B: Manual Start

```bash
# Terminal 1: Start databases
docker compose up postgres redis minio -d

# Terminal 2: Backend
cd backend
npm run start:dev

# Terminal 3: AI Service
cd ai-service
uvicorn main:app --reload

# Terminal 4: Frontend
cd frontend
npm run dev
```

## Step 4: Build and Load Extension

```bash
cd extension
npm run build
```

Then in Chrome:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/dist` directory

## Step 5: Initialize MinIO Bucket

1. Open http://localhost:9001
2. Login with `minioadmin` / `minioadmin123`
3. Create bucket: `autodoc-bucket`
4. Set bucket policy to public read (for development)

## Step 6: Test the System

1. **Record a workflow**:
   - Click extension icon
   - Click "Start Recording"
   - Navigate and interact with a webpage
   - Click "Stop Recording"

2. **View guide**:
   - Open http://localhost:3000
   - Navigate to `/guides`
   - Click on your guide to edit

3. **Test redaction**:
   - Open a guide with screenshots
   - Navigate to `/redaction/[stepId]`
   - Review detected PII
   - Apply redaction

4. **Generate document**:
   - Navigate to `/documents/compose`
   - Enter guide ID
   - Select style
   - Click "Compose Document"

## Troubleshooting

### Extension not capturing screenshots
- Check browser console for errors
- Verify extension has "activeTab" permission
- Ensure you're on an http/https page (not chrome://)

### Backend connection errors
- Verify Docker containers are running: `docker compose ps`
- Check backend logs: `docker compose logs backend`
- Verify environment variables are set

### AI service errors
- Check Google Gemini API key is set (GOOGLE_GEMINI_API_KEY)
- Verify AI service is running: `curl http://localhost:8000/health`
- Check logs: `docker compose logs ai-service`

### Database connection errors
- Verify PostgreSQL is running: `docker compose ps postgres`
- Check connection string in `.env`
- Try connecting manually: `psql $DATABASE_URL`

## Next Steps

- Set up authentication (implement user management)
- Configure OAuth2/SAML for SSO
- Set up production infrastructure
- Configure monitoring and logging
- Set up CI/CD pipeline

## Support

For issues or questions, check:
- `README.md` for overview
- `ARCHITECTURE.md` for system design
- `backend/README.md` for API docs


