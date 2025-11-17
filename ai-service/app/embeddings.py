import os
import google.generativeai as genai
from typing import List, Dict
import numpy as np


class EmbeddingService:
    """Embedding service for search using Google's text-embedding-004"""

    def __init__(self):
        api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_GEMINI_API_KEY environment variable is required")
        genai.configure(api_key=api_key)
        # Use text-embedding-004 model for embeddings
        self.embedding_model = 'models/text-embedding-004'

    async def generate_embeddings(self, steps: List[Dict]) -> List[List[float]]:
        """Generate embeddings for steps using Google's embedding model"""

        # Combine step descriptions
        texts = [
            f"{step.get('description', '')} {step.get('domEvent', {}).get('type', '')}"
            for step in steps
        ]

        # Generate embeddings using Google's embedding API
        embeddings = []
        for text in texts:
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="RETRIEVAL_DOCUMENT"
            )
            # Handle both dict and object responses
            if isinstance(result, dict):
                embeddings.append(result['embedding'])
            else:
                embeddings.append(result.embedding)

        return embeddings

    async def generate_guide_embedding(self, guide: Dict) -> List[float]:
        """Generate embedding for entire guide"""

        # Combine all step descriptions
        text = "\n".join([
            step.get("description", "")
            for step in guide.get("steps", [])
        ])

        result = genai.embed_content(
            model=self.embedding_model,
            content=text,
            task_type="RETRIEVAL_DOCUMENT"
        )

        # Handle both dict and object responses
        if isinstance(result, dict):
            return result['embedding']
        else:
            return result.embedding


