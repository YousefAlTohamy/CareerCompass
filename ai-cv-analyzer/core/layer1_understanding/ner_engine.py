import logging
from typing import List, Dict
import os
import re  # 🔴 تم نقلها للأعلى (المكان الصحيح لأي استدعاء)

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
            
            # إزالة aggregation_strategy للحصول على التوكنز الخام بمؤشرات الحروف الحقيقية
            self._ner_pipeline = pipeline(
                "ner", 
                model=MODEL_NAME, 
                tokenizer=MODEL_NAME
            )
        except Exception as e:
            logger.error(f"Failed to load NER model: {e}")
            self._ner_pipeline = None

    def _post_process_entities(self, extracted_data: Dict[str, List[str]], original_text: str) -> Dict[str, List[str]]:
        """
        مرحلة الفلترة الديناميكية الذكية:
        تعتمد على الخوارزميات (Heuristics) والسياق فقط دون أي بيانات Hardcoded.
        """
        cleaned_data = {"skills": [], "roles": [], "education": [], "certifications": []}
        
        # 1. الاستخراج السياقي للاسم والبيانات الشخصية:
        header_text_lower = original_text[:150].lower()
        
        for category, entities in extracted_data.items():
            unique_entities = set()
            
            for entity in entities:
                # تنظيف المسافات الزائدة
                clean_entity = re.sub(r'\s+', ' ', entity).strip()
                
                # تخطي الكلمات الفارغة
                if not clean_entity:
                    continue
                    
                # 2. القاعدة الخوارزمية للكلمات القصيرة (Micro-tokens Filter):
                if len(clean_entity) <= 2:
                    is_valid_short = (
                        clean_entity.isupper() or 
                        any(char in clean_entity for char in ['#', '+', '.']) or 
                        clean_entity.lower() == 'go'
                    )
                    if not is_valid_short:
                        continue
                
                # 3. الفلترة السياقية للمسميات الوظيفية (Contextual Role Filtering):
                if category == "roles":
                    if clean_entity.lower() in header_text_lower and len(clean_entity.split()) <= 3:
                        tech_role_indicators = ['developer', 'engineer', 'manager', 'designer', 'admin', 'analyst', 'stack', 'end']
                        if not any(indicator in clean_entity.lower() for indicator in tech_role_indicators):
                            continue # هذا غالباً اسم الشخص أو مدينته، نتخطاه
                            
                unique_entities.add(clean_entity)
                
            cleaned_data[category] = list(unique_entities)

        return cleaned_data

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        if self._ner_pipeline is None or not text:
            return {"skills": [], "roles": [], "education": [], "certifications": []}

        try:
            words = text.split()
            chunks = []
            current_chunk = []
            current_length = 0
            
            # تقطيع النص بذكاء
            for word in words:
                current_length += len(word) + 1
                current_chunk.append(word)
                if current_length > 1200:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = []
                    current_length = 0
            if current_chunk:
                chunks.append(" ".join(current_chunk))

            extracted_data = {"skills": set(), "roles": set(), "education": set(), "certifications": set()}
            label_map = {"SKILL": "skills", "ROLE": "roles", "EDU": "education", "CERT": "certifications"}

            for chunk in chunks:
                tokens = self._ner_pipeline(chunk)
                if not tokens: continue
                
                current_word = ""
                current_label = None
                last_end = -1

                def save_current_entity():
                    nonlocal current_word, current_label
                    if current_word and current_label in label_map:
                        clean_final = current_word.strip()
                        # تصفية الحروف المفردة الغريبة باستثناء لغات البرمجة C و R
                        if len(clean_final) < 2 and clean_final.upper() not in ['C', 'R']:
                            return
                        if clean_final.lower() not in ['the', 'and', 'for', 'with', 'in', 'of']:
                            extracted_data[label_map[current_label]].add(clean_final)

                for token in tokens:
                    word = token.get("word", "")
                    label = token.get("entity", "")
                    start = token.get("start", -1)
                    end = token.get("end", -1)
                    
                    base_label = label.split("-")[-1] if "-" in label else label
                    is_inside = label.startswith("I-")
                    clean_token = word.replace("##", "")

                    if base_label not in label_map:
                        save_current_entity()
                        current_word = ""
                        current_label = None
                        last_end = end
                        continue

                    # 🔴 خوارزمية الدمج الهندسية
                    if word.startswith("##") or start == last_end:
                        current_word += clean_token
                        if base_label == "SKILL": 
                            current_label = "SKILL"
                        elif current_label is None: 
                            current_label = base_label
                    elif is_inside and current_label == base_label:
                        current_word += " " + clean_token
                    else:
                        save_current_entity()
                        current_word = clean_token
                        current_label = base_label
                        
                    last_end = end
                
                save_current_entity()

            # تحويل الـ Sets إلى قوائم للتمرير
            raw_data = {
                "skills": list(extracted_data["skills"]),
                "roles": list(extracted_data["roles"]),
                "education": list(extracted_data["education"]),
                "certifications": list(extracted_data["certifications"])
            }
            
            # التمرير للفلتر الديناميكي
            return self._post_process_entities(raw_data, text)
            
        except Exception as e:
            # 🚨 إذا رأيت هذه الرسالة في الـ Terminal، أخبرني فوراً بالخطأ المكتوب!
            logger.error(f"NER Extraction failed: {e}")
            return {"skills": [], "roles": [], "education": [], "certifications": []}