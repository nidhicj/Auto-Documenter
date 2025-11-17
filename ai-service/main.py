from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os

from app.ocr import OCRService
from app.pii import PIIService
from app.composer import DocumentComposer
from app.embeddings import EmbeddingService

app = FastAPI(title="Scribe AI Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ocr_service = OCRService()
pii_service = PIIService()

# Initialize AI services (may fail if API key not set)
try:
    composer = DocumentComposer()
    embedding_service = EmbeddingService()
except ValueError as e:
    print(f"Warning: AI services not initialized: {e}")
    composer = None
    embedding_service = None


class RedactionRequest(BaseModel):
    stepId: str
    screenshotUri: str


class RedactionApplyRequest(BaseModel):
    screenshotUri: str
    blurredRegions: List[dict]


class DocumentRequest(BaseModel):
    guideId: str
    steps: List[dict]
    style: Optional[str] = "professional"


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/redaction/process")
async def process_redaction(request: RedactionRequest):
    """Process screenshot for OCR and PII detection"""
    try:
        # Download image
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(request.screenshotUri)
            image_bytes = response.content

        # Run OCR
        ocr_result = await ocr_service.extract_text(image_bytes)

        # Detect PII
        pii_result = await pii_service.detect_pii(ocr_result.text)

        return {
            "stepId": request.stepId,
            "ocr": {
                "text": ocr_result.text,
                "confidence": ocr_result.confidence,
            },
            "pii": {
                "entities": pii_result.entities,
                "blurredRegions": pii_result.blurred_regions,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/redaction/apply")
async def apply_redaction(request: RedactionApplyRequest):
    """Apply blur to detected regions"""
    try:
        import httpx
        from app.redaction import apply_blur

        # Download image
        async with httpx.AsyncClient() as client:
            response = await client.get(request.screenshotUri)
            image_bytes = response.content

        # Apply blur
        redacted_image = await apply_blur(image_bytes, request.blurredRegions)

        # Upload to S3 (implement upload logic)
        redacted_uri = request.screenshotUri.replace(".png", "_redacted.png")

        return {"redactedUri": redacted_uri}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/documents/compose")
async def compose_document(request: DocumentRequest):
    """Generate AI-composed document from steps"""
    try:
        if composer is None:
            raise HTTPException(status_code=500, detail="Document composer not initialized. Check GOOGLE_GEMINI_API_KEY.")
        document = await composer.compose(request.steps, request.style)
        return {"document": document}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embeddings/generate")
async def generate_embeddings(steps: List[dict]):
    """Generate embeddings for search"""
    try:
        if embedding_service is None:
            raise HTTPException(status_code=500, detail="Embedding service not initialized. Check GOOGLE_GEMINI_API_KEY.")
        embeddings = await embedding_service.generate_embeddings(steps)
        return {"embeddings": embeddings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


