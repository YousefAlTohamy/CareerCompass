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
            
            # 🔴 التعديل الجوهري: إزالة aggregation_strategy 
            # للحصول على التوكنز الخام بمؤشرات الحروف الحقيقية (start, end)
            self._ner_pipeline = pipeline(
                "ner", 
                model=MODEL_NAME, 
                tokenizer=MODEL_NAME
            )
        except Exception as e:
            logger.error(f"Failed to load NER model: {e}")
            self._ner_pipeline = None

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        if self._ner_pipeline is None or not text:
            return {"skills": [], "roles": [], "education": [], "certifications": []}

        try:
            words = text.split()
            chunks = []
            current_chunk = []
            current_length = 0
            
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

                    # إذا كان الكيان ليس له علاقة بمجالنا، نتخطاه ونحفظ ما قبله
                    if base_label not in label_map:
                        save_current_entity()
                        current_word = ""
                        current_label = None
                        last_end = end
                        continue

                    # 🔴 خوارزمية الدمج الهندسية
                    # 1. إذا كان التوكن يبدأ بـ ## أو ملامس للتوكن السابق بالملي (start == last_end)
                    if word.startswith("##") or start == last_end:
                        current_word += clean_token
                        # أولوية الـ SKILL لو حصل تداخل في توقعات الموديل
                        if base_label == "SKILL": 
                            current_label = "SKILL"
                        elif current_label is None: 
                            current_label = base_label
                            
                    # 2. إذا كان جزء من نفس الكلمة ولكن بمسافة (مثل I-SKILL)
                    elif is_inside and current_label == base_label:
                        current_word += " " + clean_token
                        
                    # 3. كلمة جديدة تماماً
                    else:
                        save_current_entity()
                        current_word = clean_token
                        current_label = base_label
                        
                    last_end = end
                
                # حفظ آخر كيان
                save_current_entity()

            return {
                "skills": list(extracted_data["skills"]),
                "roles": list(extracted_data["roles"]),
                "education": list(extracted_data["education"]),
                "certifications": list(extracted_data["certifications"])
            }
            
        except Exception as e:
            logger.error(f"NER Extraction failed: {e}")
            return {"skills": [], "roles": [], "education": [], "certifications": []}