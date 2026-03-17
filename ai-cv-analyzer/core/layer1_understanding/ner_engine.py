import logging
from typing import List, Dict
import os
import re

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

        logger.info("Loading AI NER Transformer Model into memory...")
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            base_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
            custom_model_path = os.path.join(base_dir, "models", "ner_weights", "career_compass_ner_final")
            
            if os.path.exists(custom_model_path):
                logger.info(f"✅ AI Fine-Tuned Model loaded successfully from: {custom_model_path}")
                MODEL_NAME = custom_model_path
            else:
                logger.warning(f"❌ Custom model not found! Using base fallback.")
                MODEL_NAME = "dslim/bert-base-NER"  
            
            # aggregation_strategy="simple" tries to merge B and I tags automatically
            self._ner_pipeline = pipeline(
                "ner", 
                model=MODEL_NAME, 
                tokenizer=MODEL_NAME, 
                aggregation_strategy="simple"
            )
        except Exception as e:
            logger.error(f"Failed to load NER model: {e}")
            self._ner_pipeline = None

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        if self._ner_pipeline is None or not text:
            return {"skills": [], "roles": [], "education": [], "certifications": []}

        try:
            # تقسيم النص لقطع صغيرة تناسب حجم BERT (أقصى حاجة 512 Token)
            chunks = [text[i:i+1500] for i in range(0, len(text), 1500)]
            all_entities = []
            
            for chunk in chunks:
                all_entities.extend(self._ner_pipeline(chunk))

            extracted_data = {"skills": [], "roles": [], "education": [], "certifications": []}

            # خوارزمية الدمج الذكي للكلمات المقطوعة (Fixing Tokenization Fragmentation)
            for entity in all_entities:
                word = entity.get("word", "")
                label = entity.get("entity_group", "")
                
                # إزالة المسافات وتجاهل الكلمات القصيرة جداً
                clean_word = word.strip()
                if len(clean_word) < 2 or clean_word.lower() in ['the', 'and', 'for', 'with']:
                    continue
                
                # تنظيف الكلمة من رموز الـ Tokenization (##)
                if clean_word.startswith("##"):
                    clean_word = clean_word.replace("##", "")
                    # إذا كانت جزء من كلمة، نلصقها في الكلمة التي قبلها في نفس القائمة
                    target_list = None
                    if label == "SKILL": target_list = extracted_data["skills"]
                    elif label == "ROLE": target_list = extracted_data["roles"]
                    elif label == "EDU": target_list = extracted_data["education"]
                    elif label == "CERT": target_list = extracted_data["certifications"]
                    
                    if target_list and len(target_list) > 0:
                        target_list[-1] += clean_word # لصق الجزء المتبقي
                        continue

                # توزيع الكلمات النظيفة
                if label == "SKILL" and clean_word not in extracted_data["skills"]:
                    extracted_data["skills"].append(clean_word)
                elif label == "ROLE" and clean_word not in extracted_data["roles"]:
                    extracted_data["roles"].append(clean_word)
                elif label == "EDU" and clean_word not in extracted_data["education"]:
                    extracted_data["education"].append(clean_word)
                elif label == "CERT" and clean_word not in extracted_data["certifications"]:
                    extracted_data["certifications"].append(clean_word)

            return extracted_data
            
        except Exception as e:
            logger.error(f"NER Extraction failed: {e}")
            return {"skills": [], "roles": [], "education": [], "certifications": []}