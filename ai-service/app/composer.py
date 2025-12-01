import os
import google.generativeai as genai
from typing import List, Dict


class DocumentComposer:
    """AI document composer using Google Gemini"""

    def __init__(self):
        api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_GEMINI_API_KEY environment variable is required")
        genai.configure(api_key=api_key)
        # Use gemini-2.5-flash for faster responses (latest stable model)
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    async def compose(self, steps: List[Dict], style: str = "professional") -> str:
        """Compose document from steps"""

        # Build prompt
        prompt = self._build_prompt(steps, style)

        # Generate document using Gemini
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
            )
        )

        # Extract text from response - handle both simple and complex responses
        try:
            return response.text
        except (AttributeError, ValueError):
            # For non-simple responses, use parts accessor
            try:
                if hasattr(response, 'parts'):
                    parts = response.parts
                    text_parts = []
                    for part in parts:
                        if hasattr(part, 'text'):
                            text_parts.append(part.text)
                    if text_parts:
                        return ' '.join(text_parts).strip()
                
                # Fallback to candidates
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        parts = candidate.content.parts
                        text_parts = []
                        for part in parts:
                            if hasattr(part, 'text'):
                                text_parts.append(part.text)
                        if text_parts:
                            return ' '.join(text_parts).strip()
            except Exception:
                pass
            
            # If all else fails, raise an error
            raise ValueError("Could not extract text from Gemini response")

    def _build_prompt(self, steps: List[Dict], style: str) -> str:
        """Build prompt for document generation"""

        steps_text = "\n\n".join([
            f"Step {i + 1}:\n"
            f"Description: {step.get('description', 'N/A')}\n"
            f"Event: {step.get('domEvent', {}).get('type', 'N/A')}\n"
            f"Target: {step.get('domEvent', {}).get('target', {}).get('tagName', 'N/A')}"
            for i, step in enumerate(steps)
        ])

        system_instruction = "You are a technical writer creating step-by-step guides from workflow data. Write clear, concise instructions using professional language. Include context for each step and make it easy to follow for users of all skill levels. Format your response as markdown."

        prompt = f"""{system_instruction}

Create a {style} step-by-step guide from the following workflow data:

{steps_text}

Format the output as markdown with proper headings and formatting."""

        return prompt


