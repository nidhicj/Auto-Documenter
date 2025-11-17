from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from typing import List, Dict
import re


class PIIEntity:
    def __init__(self, type: str, value: str, confidence: float, start: int, end: int):
        self.type = type
        self.value = value
        self.confidence = confidence
        self.start = start
        self.end = end


class PIIResult:
    def __init__(self, entities: List[Dict], blurred_regions: List[Dict]):
        self.entities = entities
        self.blurred_regions = blurred_regions


class PIIService:
    """PII detection service using Presidio"""

    def __init__(self):
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()

    async def detect_pii(self, text: str) -> PIIResult:
        """Detect PII in text and return entities with blur regions"""

        # Analyze text for PII
        results = self.analyzer.analyze(
            text=text,
            language="en",
            entities=[
                "EMAIL_ADDRESS",
                "PHONE_NUMBER",
                "CREDIT_CARD",
                "SSN",
                "IP_ADDRESS",
                "PERSON",
                "LOCATION",
                "DATE_TIME",
            ],
        )

        # Convert to entities list
        entities = []
        for result in results:
            entities.append({
                "type": result.entity_type,
                "value": text[result.start:result.end],
                "confidence": result.score,
                "start": result.start,
                "end": result.end,
            })

        # Generate blur regions (simplified - in production, map to image coordinates)
        blurred_regions = []
        for entity in entities:
            # This is a simplified version
            # In production, you'd need to map text positions to image coordinates
            blurred_regions.append({
                "x": 0,  # Would be calculated from OCR bounding boxes
                "y": 0,
                "width": 100,
                "height": 30,
                "type": entity["type"],
            })

        return PIIResult(entities, blurred_regions)

    async def anonymize_text(self, text: str) -> str:
        """Anonymize PII in text"""
        results = self.analyzer.analyze(text=text, language="en")
        anonymized = self.anonymizer.anonymize(text=text, analyzer_results=results)
        return anonymized.text



