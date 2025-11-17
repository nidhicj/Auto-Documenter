import os
from typing import Optional
import pytesseract
from PIL import Image
import io
import httpx

try:
    from google.cloud import vision
    GOOGLE_VISION_AVAILABLE = True
except ImportError:
    GOOGLE_VISION_AVAILABLE = False


class OCRResult:
    def __init__(self, text: str, confidence: float):
        self.text = text
        self.confidence = confidence


class OCRService:
    """OCR service using Tesseract or Google Vision API"""

    def __init__(self):
        self.use_google_vision = (
            GOOGLE_VISION_AVAILABLE and
            os.getenv("GOOGLE_VISION_API_KEY") is not None
        )

        if self.use_google_vision:
            self.vision_client = vision.ImageAnnotatorClient()

    async def extract_text(self, image_bytes: bytes) -> OCRResult:
        """Extract text from image using OCR"""

        if self.use_google_vision:
            return await self._extract_with_google_vision(image_bytes)
        else:
            return await self._extract_with_tesseract(image_bytes)

    async def _extract_with_tesseract(self, image_bytes: bytes) -> OCRResult:
        """Extract text using Tesseract OCR"""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            text = pytesseract.image_to_string(image)
            # Get confidence (average)
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0

            return OCRResult(text.strip(), avg_confidence)
        except Exception as e:
            print(f"[OCR] Tesseract error: {e}")
            return OCRResult("", 0.0)

    async def _extract_with_google_vision(self, image_bytes: bytes) -> OCRResult:
        """Extract text using Google Vision API"""
        try:
            image = vision.Image(content=image_bytes)
            response = self.vision_client.text_detection(image=image)
            texts = response.text_annotations

            if texts:
                text = texts[0].description
                # Calculate average confidence
                confidences = [
                    annotation.confidence
                    for annotation in texts[1:]
                    if annotation.confidence > 0
                ]
                avg_confidence = (
                    sum(confidences) / len(confidences)
                    if confidences
                    else 0.9
                )
                return OCRResult(text, avg_confidence)
            else:
                return OCRResult("", 0.0)
        except Exception as e:
            print(f"[OCR] Google Vision error: {e}")
            # Fallback to Tesseract
            return await self._extract_with_tesseract(image_bytes)



