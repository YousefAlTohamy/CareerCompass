import logging
import io
import fitz  # PyMuPDF
import re
from docx import Document
from typing import Optional

logger = logging.getLogger(__name__)

def clean_extracted_text(text: str) -> str:
    """
    ينظف النص المستخرج لمنع الكلمات من الالتصاق ببعضها (Gluing)
    ويساعد نموذج الذكاء الاصطناعي على قراءة المهارات ككلمات منفصلة تماماً.
    """
    if not text:
        return ""
        
    # 1. استبدال النزول لسطر جديد بمسافة لمنع التصاق أخر كلمة في السطر بأول كلمة في السطر اللي بعده
    text = text.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    
    # 2. إضافة مسافات حول علامات الترقيم (الفاصلة، النقطتين، الشرطة، النقطة، علامة العطف)
    # عشان لو الـ PDF قاري "Testing&QA:PHPUnit" يحولها لـ "Testing & QA : PHPUnit"
    text = re.sub(r'([:,|•·/&])', r' \1 ', text)
    
    # 3. التأكد من وجود مسافة بعد الفاصلة أو النقطة لو كانت لازقة في حرف
    # مثلا: "Laravel,MySQL" تتحول إلى "Laravel, MySQL"
    text = re.sub(r'(?<=[a-zA-Z])([,.:])(?=[a-zA-Z])', r'\1 ', text)

    # 4. مسح أي مسافات زيادة متكررة
    text = re.sub(r'\s+', ' ', text)
    
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
            # إضافة مسافة قبل النزول لسطر جديد كضمان إضافي
            page_text = page.get_text()
            text += page_text + " \n "
            total_images += len(page.get_images())
            
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