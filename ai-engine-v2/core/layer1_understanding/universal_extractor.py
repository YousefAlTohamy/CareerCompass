import logging
from typing import Optional, Tuple
from core.layer1_understanding.text_parser import extract_text_from_pdf, extract_text_from_docx
from core.layer1_understanding.ocr_pipeline import extract_text_from_image, extract_images_from_pdf_bytes

logger = logging.getLogger(__name__)

def process_document(filename: str, file_bytes: bytes) -> Tuple[Optional[str], str]:
    """
    Intelligently extracts text from uploaded CVs regardless of format.
    Returns: (Extracted Text, Method Used)
    """
    ext = filename.lower().split(".")[-1]
    logger.info(f"Processing document: {filename} (Ext: {ext})")
    
    if ext == "docx" or ext == "doc":
        text = extract_text_from_docx(file_bytes)
        return (text, "python-docx") if text else (None, "failed")
        
    elif ext in ["png", "jpg", "jpeg"]:
        # Direct image upload
        text = extract_text_from_image(file_bytes)
        return (text, "easyocr") if text else (None, "failed")
        
    elif ext == "pdf":
        # 1. Try standard text extraction first (fast)
        text = extract_text_from_pdf(file_bytes)
        
        # 2. If it fails or returns None (indicates scanned image), fallback to OCR
        if not text:
            logger.info("Standard PDF extraction failed or empty. Triggering OCR pipeline...")
            images = extract_images_from_pdf_bytes(file_bytes)
            ocr_text_parts = []
            for img_bytes in images:
                page_text = extract_text_from_image(img_bytes)
                if page_text:
                    ocr_text_parts.append(page_text)
                    
            full_ocr_text = "\n".join(ocr_text_parts)
            return (full_ocr_text, "mupdf-to-easyocr") if full_ocr_text else (None, "failed")
            
        return (text, "pymupdf")
        
    else:
        logger.error(f"Unsupported file extension: {ext}")
        return (None, "unsupported")
