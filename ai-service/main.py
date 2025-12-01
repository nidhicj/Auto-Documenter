from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os

from app.ocr import OCRService
from app.pii import PIIService
from app.composer import DocumentComposer
from app.embeddings import EmbeddingService

import google.generativeai as genai
import httpx
from app.redaction import apply_blur
from urllib.parse import urlparse
import uvicorn


def extract_gemini_text(response) -> str:
    """
    Robustly extract plain text from a Gemini GenerateContentResponse.
    Works even when the response has multiple parts/candidates.
    """
    # Try the safe, official structure: candidates -> content -> parts -> text
    texts = []

    # Some versions expose .candidates; others may use .candidates or dict-like
    candidates = getattr(response, "candidates", None) or []
    
    print(f"[extract_gemini_text] Candidates count: {len(candidates)}")

    for cand_idx, cand in enumerate(candidates):
        print(f"[extract_gemini_text] Processing candidate {cand_idx}")
        content = getattr(cand, "content", None)
        if not content:
            print(f"[extract_gemini_text] No content in candidate {cand_idx}")
            continue

        parts = getattr(content, "parts", None) or []
        print(f"[extract_gemini_text] Candidate {cand_idx} has {len(parts)} parts")
        for part_idx, part in enumerate(parts):
            # New client: each part usually has a .text attr
            text = getattr(part, "text", None)
            if text:
                print(f"[extract_gemini_text] Found text in part {part_idx}: {text[:100]}")
                texts.append(text)

    # If we got anything, join it
    if texts:
        result = " ".join(texts).strip()
        print(f"[extract_gemini_text] Successfully extracted text: {result[:100]}")
        return result

    # Fallback: try direct .text, but catch the dreaded quick-accessor error
    try:
        direct = getattr(response, "text", None)
        if callable(direct):
            direct = direct()
        if isinstance(direct, str):
            print(f"[extract_gemini_text] Extracted via response.text fallback: {direct[:100]}")
            return direct.strip()
    except Exception as e:
        print(f"[extract_gemini_text] response.text failed: {type(e).__name__}: {e}")
        pass

    # Last resort: string representation (very defensive fallback)
    print(f"[extract_gemini_text] All extraction methods failed, returning empty string")
    return ""


app = FastAPI(title="Autodocumenter", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services (may fail if credentials not available)
try:
    ocr_service = OCRService()
except Exception as e:
    print(f"Warning: OCR service not initialized: {e}")
    ocr_service = None

try:
    pii_service = PIIService()
except Exception as e:
    print(f"Warning: PII service not initialized: {e}")
    pii_service = None

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


class StepEnhanceRequest(BaseModel):
    currentDescription: str
    context: dict


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/debug/apikey")
async def debug_apikey():
    """Debug endpoint to check API key status"""
    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
    
    if not api_key:
        return {
            "status": "error",
            "message": "GOOGLE_GEMINI_API_KEY not set in environment",
            "api_key_present": False,
            "api_key_length": 0,
            "api_key_preview": None
        }
    
    # Check if composer is initialized
    composer_status = "initialized" if composer is not None else "not initialized"
    
    # Try a simple API call to verify the key works
    test_result = None
    try:
        if composer:
            test_model = genai.GenerativeModel('gemini-2.5-flash')
            test_response = test_model.generate_content("Say 'API key is working' if you can read this.")
            try:
                resp_text = extract_gemini_text(test_response)
            except Exception as e:
                resp_text = f"Failed to extract text: {type(e).__name__}: {e}"
            test_result = {
                "success": True,
                "response": resp_text
            }

    except Exception as e:
        test_result = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    return {
        "status": "ok",
        "api_key_present": True,
        "api_key_length": len(api_key),
        "api_key_preview": f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***",
        "composer_status": composer_status,
        "test_api_call": test_result
    }


@app.post("/redaction/process")
async def process_redaction(request: RedactionRequest):
    """Process screenshot for OCR and PII detection"""
    try:
        if ocr_service is None or pii_service is None:
            raise HTTPException(status_code=500, detail="OCR or PII service not initialized")
        
        # Download image
        
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


@app.post("/api/steps/enhance")
async def enhance_step(request: StepEnhanceRequest):
    """Enhance step description using AI"""
    print("\n" + "="*80)
    print("🤖 GEMINI AI STEP ENHANCEMENT STARTED")
    print("="*80)
    print(f"📝 Current Description: {request.currentDescription}")
    print(f"📊 Context: {request.context}")
    
    try:
        if composer is None:
            print("❌ ERROR: Composer not initialized")
            raise HTTPException(status_code=500, detail="AI service not initialized. Check GOOGLE_GEMINI_API_KEY.")
        
        print("✅ Composer initialized, proceeding with enhancement...")
        
        
        
        # Build prompt for step enhancement
        event_type = request.context.get('eventType', 'unknown')
        target = request.context.get('target', {})
        url = request.context.get('url', '')
        selector = request.context.get('selector', '')
        text_content = target.get('textContent', '') if isinstance(target, dict) else ''
        
        # Build a more intelligent prompt
        target_info = []
        if target.get('tagName'):
            target_info.append(target.get('tagName').lower())
        if target.get('id'):
            target_info.append(f"with ID '{target.get('id')}'")
        if target.get('className'):
            classes = [c for c in target.get('className', '').split(' ') if c]
            if classes:
                target_info.append(f"with class '{classes[0]}'")
        if text_content:
            # Use text content to identify buttons/links better
            target_info.append(f"labeled '{text_content[:50]}'")
        
        target_description = ' '.join(target_info) if target_info else 'the element'
        
        # Determine action context
        action_context = ""
        if event_type == 'click':
            if 'button' in target_description or 'btn' in (target.get('className', '') or '').lower():
                action_context = "button"
            elif 'link' in target_description or target.get('tagName', '').lower() == 'a':
                action_context = "link"
            elif 'input' in target_description or target.get('tagName', '').lower() == 'input':
                action_context = "input field"
            else:
                action_context = "element"
        elif event_type == 'navigation':
            # Extract domain or page name from URL
            try:
                
                parsed = urlparse(url)
                domain = parsed.netloc.replace('www.', '')
                path = parsed.path.strip('/').replace('/', ' > ')
                action_context = f"to {domain}" + (f" ({path})" if path else "")
            except:
                action_context = "to the page"
        
        # Extract page context from URL
        page_context = ""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.replace('www.', '')
            path_parts = [p for p in parsed.path.strip('/').split('/') if p]
            if path_parts:
                page_context = f" on {domain} ({'/'.join(path_parts[:2])})"
            else:
                page_context = f" on {domain}"
        except:
            page_context = ""
        
        button_text = text_content.strip() if text_content else ""
        
        prompt = f"""You are an expert technical writer creating clear, professional step-by-step instructions for user guides.

Current basic description: "{request.currentDescription}"

Context:
- Action: {event_type}
- Target element: {target_description}
- Button/Link text: "{button_text}" (if available)
- Page: {url}{page_context}
- Step number: {request.context.get('stepIndex', 0) + 1}

Rewrite this step description to be:
1. Professional and clear (use imperative mood: "Click", "Navigate", "Enter", "Select")
2. Specific and actionable - tell the user exactly what to do
3. Include helpful context (e.g., location: "in the top navigation bar", "on the left sidebar", "in the search box")
4. Natural language that sounds intelligent and professional
5. If it's a button/link with visible text, use that text (e.g., "Click the 'Search' button" or "Click 'Submit'")
6. If it's navigation, deautodoc where you're going in simple terms (e.g., "Navigate to the search results page" not the full URL)
7. If it's an input field, deautodoc what to enter (e.g., "Enter your search query in the search box")

Examples of good descriptions:
- "Click the 'Search' button in the top navigation bar"
- "Navigate to the search results page"
- "Enter your search query in the search box at the top of the page"
- "Click the 'Add to Cart' button below the product image"
- "Enter text in the search field"

Return ONLY the enhanced description text, nothing else. Keep it to 1-2 sentences maximum. Make it sound professional and intelligent."""
        
        print("\n" + "-"*80)
        print("📤 SENDING PROMPT TO GEMINI AI MODEL")
        print("-"*80)
        print(f"Prompt length: {len(prompt)} characters")
        print(f"Model: gemini-2.5-flash")
        print(f"Temperature: 0.7")
        print(f"Max tokens: 500")
        print("-"*80)
        
        response = composer.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=500,
            )
        )

        print("\n" + "-"*80)
        print("📥 GEMINI AI RESPONSE RECEIVED")
        print("-"*80)
        print(f"Response type: {type(response)}")

        # Use robust extractor
        enhanced_description = extract_gemini_text(response)
        if not enhanced_description:
            print("❌ No text extracted from Gemini response, falling back to original description")
            enhanced_description = request.currentDescription
        else:
            print("✅ Successfully extracted enhanced description")
            print(f"📝 Raw response: {enhanced_description}")

        
        # Clean up the response (remove quotes if present)
        if enhanced_description.startswith('"') and enhanced_description.endswith('"'):
            enhanced_description = enhanced_description[1:-1]
            print("🧹 Cleaned quotes from response")
        
        print("\n" + "="*80)
        print("✅ GEMINI AI ENHANCEMENT COMPLETED")
        print("="*80)
        print(f"📝 Final Enhanced Description: {enhanced_description}")
        print("="*80 + "\n")
        
        return {"enhancedDescription": enhanced_description}
    except Exception as e:
        print("\n" + "="*80)
        print("❌ GEMINI AI ENHANCEMENT FAILED")
        print("="*80)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("="*80 + "\n")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    
    uvicorn.run(app, host="0.0.0.0", port=8000)


