from PIL import Image, ImageFilter
import io
import numpy as np
from typing import List, Dict


async def apply_blur(image_bytes: bytes, blurred_regions: List[Dict]) -> bytes:
    """Apply blur to specified regions in image"""

    # Open image
    image = Image.open(io.BytesIO(image_bytes))
    image_array = np.array(image)

    # Apply blur to each region
    for region in blurred_regions:
        x = int(region.get("x", 0))
        y = int(region.get("y", 0))
        width = int(region.get("width", 100))
        height = int(region.get("height", 30))

        # Ensure coordinates are within image bounds
        x = max(0, min(x, image.width))
        y = max(0, min(y, image.height))
        width = min(width, image.width - x)
        height = min(height, image.height - y)

        if width > 0 and height > 0:
            # Extract region
            region_image = image.crop((x, y, x + width, y + height))

            # Apply blur
            blurred_region = region_image.filter(ImageFilter.GaussianBlur(radius=10))

            # Paste back
            image.paste(blurred_region, (x, y))

    # Convert back to bytes
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()




