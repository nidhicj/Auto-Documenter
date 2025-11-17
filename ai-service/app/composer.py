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
        self.model = genai.GenerativeModel('gemini-pro')

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

        return response.text

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


