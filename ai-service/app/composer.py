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

        import os
        import google.generativeai as genai
        import httpx
        from typing import List, Dict, Optional


        class ClaudeComposer:
            """Simple Claude Haiku 4.5 composer using Anthropic HTTP API.

            Note: This implementation uses a conservative HTTP call and attempts to
            extract plain text. Adjustments may be required depending on Anthropic's
            exact API contract or SDK usage in production.
            """

            def __init__(self):
                self.api_key = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
                if not self.api_key:
                    raise ValueError("CLAUDE_API_KEY (or ANTHROPIC_API_KEY) environment variable is required for Claude provider")
                # Model name for Haiku 4.5
                self.model = os.getenv("CLAUDE_MODEL", "claude-haiku-4.5")
                self.endpoint = os.getenv("CLAUDE_API_URL", "https://api.anthropic.com/v1/claude/haiku-4.5/generate")

            async def compose(self, steps: List[Dict], style: str = "professional") -> str:
                prompt = self._build_prompt(steps, style)
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "prompt": prompt,
                    "max_tokens": 800,
                    "temperature": 0.7,
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(self.endpoint, json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()

                # Try common keys where text might appear
                text = None
                if isinstance(data, dict):
                    # new Anthropic responses may have 'completion' or 'output' or 'text'
                    for key in ("completion", "output", "text", "result", "completion_text"):
                        if key in data and isinstance(data[key], str) and data[key].strip():
                            text = data[key].strip()
                            break

                    # Try nested structures
                    if not text:
                        if "choices" in data and isinstance(data["choices"], list) and data["choices"]:
                            choice = data["choices"][0]
                            for ckey in ("text", "message", "output"):
                                if ckey in choice and isinstance(choice[ckey], str) and choice[ckey].strip():
                                    text = choice[ckey].strip()
                                    break

                return text or ""


        class DocumentComposer:
            """AI document composer supporting multiple providers (Gemini + Claude).

            The provider is chosen via the `AI_PROVIDER` or `DEFAULT_AI_PROVIDER` environment variable.
            Supported values: 'gemini' (default), 'claude'
            """

            def __init__(self):
                provider = (os.getenv("AI_PROVIDER") or os.getenv("DEFAULT_AI_PROVIDER") or "gemini").lower()
                self.provider = provider

                if provider == "claude":
                    # Use Claude/Anthropic
                    self.impl = ClaudeComposer()
                else:
                    # Default to Google Gemini
                    api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
                    if not api_key:
                        raise ValueError("GOOGLE_GEMINI_API_KEY environment variable is required")
                    genai.configure(api_key=api_key)
                    # Use gemini-2.5-flash for faster responses (latest stable model)
                    self.impl = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))

            async def compose(self, steps: List[Dict], style: str = "professional") -> str:
                """Compose document from steps using the selected provider."""

                # Build prompt
                prompt = self._build_prompt(steps, style)

                if self.provider == "claude":
                    return await self.impl.compose(steps, style)

                # Gemini path
                response = self.impl.generate_content(
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


