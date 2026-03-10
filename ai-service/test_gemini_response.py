#!/usr/bin/env python3
"""Test script to verify Gemini response extraction"""
import os
import sys
import google.generativeai as genai

# Configure API key
api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_GEMINI_API_KEY not set")
    sys.exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.5-flash')

# Test with a simple prompt
prompt = "Enhance this step description: 'Click on button'"
print(f"Testing with prompt: {prompt}")

response = model.generate_content(
    prompt,
    generation_config=genai.types.GenerationConfig(
        temperature=0.7,
        max_output_tokens=150,
    )
)

print(f"\nResponse type: {type(response)}")
print(f"Response attributes: {[a for a in dir(response) if not a.startswith('_')]}")

# Check for errors or feedback
if hasattr(response, 'prompt_feedback'):
    print(f"Prompt feedback: {response.prompt_feedback}")
if hasattr(response, 'candidates') and response.candidates:
    candidate = response.candidates[0]
    if hasattr(candidate, 'finish_reason'):
        print(f"Finish reason: {candidate.finish_reason}")
    if hasattr(candidate, 'safety_ratings'):
        print(f"Safety ratings: {candidate.safety_ratings}")

# Don't use resolve() - it returns None for this response type

# Try extraction methods
enhanced_description = None

# Method 0: Try using the response as an iterator or accessing text differently
print(f"\nMethod 0: Trying different access methods")
try:
    # Try accessing text through the response's internal structure
    # The error says to use result.parts - maybe response itself IS the result?
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        print(f"  Candidate finish_reason: {candidate.finish_reason}")
        print(f"  Candidate content: {candidate.content}")
        if candidate.content:
            # Try to convert parts to list
            parts_list = list(candidate.content.parts) if candidate.content.parts else []
            print(f"  Parts as list: length={len(parts_list)}")
            for i, part in enumerate(parts_list):
                print(f"    Part {i}: {part}")
                print(f"      Type: {type(part)}")
                # Try all possible ways to get text
                if hasattr(part, 'text'):
                    print(f"      part.text = {part.text}")
                # Check if it's a protobuf message
                if hasattr(part, 'WhichOneof'):
                    print(f"      Has WhichOneof (protobuf)")
                # Try to see all fields
                if hasattr(part, 'DESCRIPTOR'):
                    print(f"      Protobuf fields: {[f.name for f in part.DESCRIPTOR.fields]}")
                    for field in part.DESCRIPTOR.fields:
                        if hasattr(part, field.name):
                            value = getattr(part, field.name)
                            print(f"        {field.name} = {value}")
except Exception as e:
    print(f"  Method 0 failed: {e}")
    import traceback
    traceback.print_exc()

# Method 1: response.parts
if hasattr(response, 'parts'):
    parts = response.parts
    print(f"\nMethod 1: response.parts")
    print(f"  Parts type: {type(parts)}")
    print(f"  Parts length: {len(parts) if parts else 0}")
    if parts:
        text_parts = []
        for i, part in enumerate(parts):
            print(f"  Part {i}: type={type(part)}")
            part_attrs = [a for a in dir(part) if not a.startswith('_')]
            print(f"    Part attributes: {part_attrs[:10]}")
            # Try multiple ways to get text
            text_value = None
            if hasattr(part, 'text'):
                text_value = part.text
                print(f"    Part.text: {text_value}")
            if text_value:
                text_parts.append(str(text_value))
                print(f"    ✅ Text found: {text_value[:100]}")
        if text_parts:
            enhanced_description = ' '.join(text_parts).strip()
            print(f"✅ Extracted: {enhanced_description}")

# Method 2: candidates[0].content.parts
if not enhanced_description and hasattr(response, 'candidates') and response.candidates:
    print(f"\nMethod 2: candidates[0].content.parts")
    candidate = response.candidates[0]
    print(f"  Candidate type: {type(candidate)}")
    print(f"  Candidate attributes: {[a for a in dir(candidate) if not a.startswith('_')]}")
    if hasattr(candidate, 'content') and candidate.content:
        print(f"  Content type: {type(candidate.content)}")
        print(f"  Content attributes: {[a for a in dir(candidate.content) if not a.startswith('_')]}")
        if hasattr(candidate.content, 'parts'):
            parts = candidate.content.parts
            print(f"  Parts type: {type(parts)}, length: {len(parts) if parts else 0}")
            if parts and len(parts) > 0:
                text_parts = []
                for i, part in enumerate(parts):
                    print(f"  Part {i}: type={type(part)}")
                    part_attrs = [a for a in dir(part) if not a.startswith('_')]
                    print(f"    Part attributes: {part_attrs[:10]}")
                    # Try to get text - check multiple ways
                    text_value = None
                    if hasattr(part, 'text'):
                        text_value = part.text
                        print(f"    Part.text (attr): {text_value}")
                    elif hasattr(part, 'get') and callable(getattr(part, 'get')):
                        text_value = part.get('text', None)
                        print(f"    Part.get('text'): {text_value}")
                    elif isinstance(part, dict):
                        text_value = part.get('text', None)
                        print(f"    Part['text'] (dict): {text_value}")
                    else:
                        # Try to convert to string and see what we get
                        part_str = str(part)
                        print(f"    Part as string: {part_str[:200]}")
                        # Sometimes the text is just the string representation
                        if part_str and not part_str.startswith('<'):
                            text_value = part_str
                    
                    if text_value:
                        text_parts.append(str(text_value))
                        print(f"    ✅ Text found: {text_value[:100]}")
                if text_parts:
                    enhanced_description = ' '.join(text_parts).strip()
                    print(f"✅ Extracted: {enhanced_description}")
                else:
                    print(f"  ❌ No text found in parts")
            else:
                print(f"  ⚠️ Parts is empty or None")

# Method 3: response.text
if not enhanced_description:
    try:
        enhanced_description = response.text.strip()
        print(f"\nMethod 3: response.text")
        print(f"✅ Extracted: {enhanced_description}")
    except Exception as e:
        print(f"\nMethod 3: response.text failed: {e}")

if enhanced_description:
    print(f"\n✅ SUCCESS: Final extracted text: {enhanced_description}")
else:
    print(f"\n❌ FAILED: Could not extract text from response")

