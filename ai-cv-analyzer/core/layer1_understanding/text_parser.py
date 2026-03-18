import logging
import io
import fitz  # PyMuPDF
import pdfplumber # 🔴 المكتبة الجديدة التي يجب إضافتها
import re
from docx import Document
from typing import Optional

logger = logging.getLogger(__name__)

def clean_extracted_text(text: str) -> str:
    """
    مشرط مخفف: التركيز على تنظيف المسافات العشوائية والحروف غير الصالحة
    دون التدخل العنيف في دمج الكلمات لأن الـ Parser سيهتم بذلك.
    """
    if not text:
        return ""
    
    # تنظيف الحروف غير القابلة للطباعة (تظهر كرموز غريبة في الـ PDF)
    text = "".join(char for char in text if char.isprintable() or char.isspace())
    
    # توحيد المسافات (استبدال المسافات المتعددة بمسافة واحدة)
    text = re.sub(r'[ \t]+', ' ', text)
    
    # فك التصاق القوائم النقطية بالكلمات (مثل: •Laravel -> • Laravel)
    text = re.sub(r'([•·\-\*])([a-zA-Z])', r'\1 \2', text)

    return text.strip()

def extract_text_from_pdf(file_bytes: bytes) -> Optional[str]:
    """
    Adaptive Text Extractor:
    1. يحاول استخدام pdfplumber للحفاظ على المسافات والأعمدة (Layout-Preserving).
    2. إذا فشل، يستخدم PyMuPDF كخطة بديلة (Fallback).
    """
    text = ""
    
    # المحاولة الأولى: استخدام pdfplumber (ممتاز في قراءة الأعمدة والمسافات)
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                # layout=True هي السر هنا! تحفظ المسافات بين الأعمدة
                page_text = page.extract_text(layout=True)
                if page_text:
                    text += page_text + "\n\n"
                    
        text = text.strip()
        
    except Exception as e:
        logger.warning(f"pdfplumber failed: {e}. Falling back to PyMuPDF.")
        text = "" # Reset in case of partial failure

    # المحاولة الثانية (خطة بديلة): إذا فشل pdfplumber أو أعاد نصاً فارغاً
    if len(text) < 50:
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = ""
            for page in doc:
                # استخدام "blocks" أفضل بكثير من get_text() العادية 
                # لأنها تقرأ كتل النصوص بدلاً من التدفق العشوائي
                blocks = page.get_text("blocks")
                for block in blocks:
                    text += block[4] + "\n" # block[4] يحتوي على النص
            doc.close()
            text = text.strip()
        except Exception as e:
            logger.error(f"Failed to extract text using PyMuPDF: {e}")
            return None

    # التحقق مما إذا كان الملف صورة Scan 
    if len(text) < 50:
        logger.info("PDF appears to be image-based (scanned) or empty. Deferring to OCR pipeline.")
        return None
        
    # تمرير النص على المشرط للتنظيف النهائي
    return clean_extracted_text(text)

def extract_text_from_docx(file_bytes: bytes) -> Optional[str]:
    # (يبقى كما هو بدون تغيير)
    try:
        doc = Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
                
        text = " \n ".join(full_text) # استخدام \n بدلاً من مسافة للحفاظ على الأسطر
        return clean_extracted_text(text) if text else None
    except Exception as e:
        logger.error(f"Failed to extract text from DOCX: {e}")
        return None