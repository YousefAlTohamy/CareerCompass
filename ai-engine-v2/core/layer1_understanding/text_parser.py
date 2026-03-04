import logging
import io
import fitz  # PyMuPDF
from docx import Document
from typing import Optional

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_bytes: bytes) -> Optional[str]:
    """
    Extracts text from a standard text-based PDF using PyMuPDF.
    Returns None if the PDF appears to be entirely image-based (scanned).
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        total_images = 0
        
        for page in doc:
            page_text = page.get_text()
            text += page_text + "\n"
            total_images += len(page.get_images())
            
        doc.close()
        
        text = text.strip()
        
        # Heuristic: If there is very little text but images exist, it might be a scanned PDF
        if len(text) < 50 and total_images > 0:
            logger.info("PDF appears to be image-based (scanned). Deferring to OCR pipeline.")
            return None
            
        return text if text else None
        
    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        return None


def extract_text_from_docx(file_bytes: bytes) -> Optional[str]:
    """
    Extracts text from a Word document (.docx).
    """
    try:
        doc = Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return "\n".join(full_text)
    except Exception as e:
        logger.error(f"Failed to extract text from DOCX: {e}")
        return None
