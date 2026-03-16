import logging
from typing import List, Dict
import os

try:
    from transformers import pipeline
    import warnings
    warnings.filterwarnings("ignore")
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)

class SkillNEREngine:
    _instance = None
    _ner_pipeline = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SkillNEREngine, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        if not TRANSFORMERS_AVAILABLE:
            logger.error("HuggingFace Transformers not installed.")
            return

        logger.info("Loading Custom NER Transformer Model into memory...")
        try:
            import os
            # 1. جلب المسار المطلق للملف الحالي (ner_engine.py)
            current_dir = os.path.dirname(os.path.abspath(__file__))
            
            # 2. الرجوع خطوتين للخلف للوصول لمجلد ai-cv-analyzer الأساسي
            base_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
            
            # 3. بناء المسار الصحيح للموديل
            custom_model_path = os.path.join(base_dir, "models", "ner_weights", "career_compass_ner_final")
            
            if os.path.exists(custom_model_path):
                logger.info(f"✅ Custom Fine-Tuned Model found at {custom_model_path}. Loading...")
                MODEL_NAME = custom_model_path
            else:
                logger.warning(f"❌ Custom model not found at {custom_model_path}! Falling back to pre-trained generic model.")
                MODEL_NAME = "dslim/bert-base-NER"  
            
            self._ner_pipeline = pipeline(
                "ner", 
                model=MODEL_NAME, 
                tokenizer=MODEL_NAME, 
                aggregation_strategy="simple"
            )
            logger.info(f"NER Model ({MODEL_NAME}) loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load NER model: {e}")
            self._ner_pipeline = None

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        if self._ner_pipeline is None or not text:
            return {"skills": [], "roles": [], "education": [], "certifications": []}

        try:
            import re
            chunks = [chunk for chunk in text.split("\n") if len(chunk.strip()) > 2]
            all_entities = []
            logger.info("🚨🚨🚨 REGEX FILTER IS RUNNING 🚨🚨🚨")
            
            current_chunk = ""
            for line in chunks:
                if len(current_chunk) + len(line) < 2000:
                    current_chunk += line + " . "
                else:
                    all_entities.extend(self._ner_pipeline(current_chunk))
                    current_chunk = line + " . "
            if current_chunk:
                all_entities.extend(self._ner_pipeline(current_chunk))

            skills, roles, education, certifications = set(), set(), set(), set()

            for entity in all_entities:
                word = entity.get("word", "").replace("#", "")
                label = entity.get("entity_group", "")
                
                # 1. تنظيف الكلمة من النقاط (Bullets) والرموز الخاصة مع الاحتفاظ بحروف البرمجة زي (C++, C#)
                clean_word = re.sub(r'[^a-zA-Z0-9\+\-\#\.\s]', '', word).strip()
                
                # 2. إزالة النقاط الزائدة في آخر الكلمة (مثل: Deme.)
                clean_word = re.sub(r'\.+$', '', clean_word).strip()
                
                # 3. شروط التصفية الصارمة (Filter Conditions)
                if len(clean_word) < 2 or len(clean_word) > 30:
                    continue  # تجاهل الحروف المفردة أو الجمل الطويلة جداً
                
                if clean_word.isdigit() or re.match(r'^\d{4}$', clean_word):
                    continue  # تجاهل الأرقام والتواريخ البحتة
                    
                if re.search(r'(http|www|\.com|\.org|gmail|github|linkedin)', clean_word, re.IGNORECASE):
                    continue  # تجاهل الروابط والإيميلات
                    
                # تجاهل الكلمات الشائعة التي يتم التقاطها بالخطأ
                stop_words = {'the', 'and', 'for', 'with', 'student', 'production', 'project', 'projects'}
                if clean_word.lower() in stop_words:
                    continue

                # 4. التوزيع
                if label == "SKILL":
                    skills.add(clean_word)
                elif label == "ROLE":
                    roles.add(clean_word)
                elif label == "EDU":
                    education.add(clean_word)
                elif label == "CERT":
                    certifications.add(clean_word)

            return {
                "skills": list(skills),
                "roles": list(roles),
                "education": list(education),
                "certifications": list(certifications)
            }
            
        except Exception as e:
            logger.error(f"NER Extraction failed: {e}")
            return {"skills": [], "roles": [], "education": [], "certifications": []}