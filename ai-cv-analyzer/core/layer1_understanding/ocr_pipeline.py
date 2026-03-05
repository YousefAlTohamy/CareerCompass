import logging
import io
from typing import Optional
import numpy as np
import cv2

try:
    import easyocr
    # Initialize reader once (Singleton pattern) for performance
    # Will download the model on first run (~150MB)
    READER = easyocr.Reader(['en'], gpu=False) # Set gpu=True if CUDA is configured
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    READER = None

logger = logging.getLogger(__name__)

def extract_text_from_image(file_bytes: bytes) -> Optional[str]:
    """
    Extracts text from an image (PNG, JPG) using EasyOCR.
    Includes OpenCV structural pre-processing for better accuracy.
    """
    if not OCR_AVAILABLE:
        logger.error("EasyOCR is not installed. Cannot process image-based CV.")
        return None

    try:
        # Convert bytes to opencv image
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logger.error("Failed to decode image bytes.")
            return None

        # Preprocessing: Grayscale and slight blur to reduce noise
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)

        logger.info("Starting EasyOCR extraction...")
        # detail=0 returns a list of strings instead of bounding boxes
        results = READER.readtext(blur, detail=0, paragraph=True)
        
        extracted_text = "\n".join(results)
        logger.info(f"OCR completed. Extracted {len(extracted_text)} characters.")
        
        return extracted_text

    except Exception as e:
        logger.error(f"OCR Pipeline failed: {e}")
        return None


def extract_images_from_pdf_bytes(file_bytes: bytes) -> list[bytes]:
    """
    If a PDF is essentially a container for scanned images, this function 
    extracts the raw image bytes from the PDF to be fed into the OCR engine.
    (Implementation placeholder relying on PyMuPDF pixmaps)
    """
    import fitz
    images_bytes = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page in doc:
            pix = page.get_pixmap(dpi=150) # Render page to image
            images_bytes.append(pix.tobytes("png"))
        doc.close()
    except Exception as e:
        logger.error(f"Failed to render PDF pages to images: {e}")
        
    return images_bytes
