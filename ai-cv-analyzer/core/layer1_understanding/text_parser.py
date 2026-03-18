import logging
import io
import fitz  # PyMuPDF
import re
from docx import Document
from typing import Optional

logger = logging.getLogger(__name__)

def clean_extracted_text(text: str) -> str:
    """
    مشرط الجراح: فك الكلمات الملتصقة وتنظيف النص المستخرج من الـ PDF/Docx
    """
    if not text:
        return ""
    
    # 1. فك الكلمات الملتصقة (حرف صغير يليه حرف كبير)
    # StripeHP -> Stripe HP | Doctorvel -> Doctor vel
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    
    # 2. فك التصاق الكلمات بالعلامات (نقطة أو فاصلة لازقة في كلمة)
    # developer.Experience -> developer. Experience
    text = re.sub(r'([.,:;!?])([a-zA-Z])', r'\1 \2', text)
    
    # 3. فك التصاق الرموز والقوائم (Bullets)
    # •Laravel -> • Laravel
    text = re.sub(r'([•·\-\*])([a-zA-Z])', r'\1 \2', text)

    # 4. معالجة اختصارات التكنولوجيا المشهورة (حالات خاصة)
    # SQLInjection -> SQL Injection
    text = re.sub(r'([A-Z]{2,})([A-Z][a-z])', r'\1 \2', text)

    # 5. تنظيف المسافات الزائدة والحروف غير القابلة للطباعة
    text = re.sub(r'\s+', ' ', text)
    text = "".join(char for char in text if char.isprintable() or char.isspace())
    
    return text.strip()


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
            # إضافة مسافة وسطر جديد بعد كل صفحة لضمان الفصل
            text += page.get_text() + " \n "
            
        doc.close()
        
        text = text.strip()
        
        # Heuristic: If there is very little text but images exist, it might be a scanned PDF
        if len(text) < 50 and total_images > 0:
            logger.info("PDF appears to be image-based (scanned). Deferring to OCR pipeline.")
            return None
            
        # 🔴 تطبيق خوارزمية التنظيف قبل إرسال النص للذكاء الاصطناعي
        cleaned_text = clean_extracted_text(text)
        return cleaned_text if cleaned_text else None
        
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
                
        # دمج كل البراجرافات بمسافة أمان
        text = " ".join(full_text)
        
        # 🔴 تطبيق خوارزمية التنظيف
        cleaned_text = clean_extracted_text(text)
        return cleaned_text if cleaned_text else None
        
    except Exception as e:
        logger.error(f"Failed to extract text from DOCX: {e}")
        return None