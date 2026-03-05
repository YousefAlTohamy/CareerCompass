import logging
from typing import List, Dict

try:
    from transformers import pipeline, AutoModelForTokenClassification, AutoTokenizer
    # Suppress verbose warnings unless error
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
        # Singleton pattern to ensure the large model is loaded only once in memory
        if cls._instance is None:
            cls._instance = super(SkillNEREngine, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        """
        Loads the Custom fine-tuned NER model or a pre-trained fallback.
        """
        if not TRANSFORMERS_AVAILABLE:
            logger.error("HuggingFace Transformers not installed.")
            return

        logger.info("Loading NER Transformer Model into memory...")
        try:
            import os
            
            # The path where the Colab weights should be placed
            custom_model_path = os.path.join("models", "ner_weights", "career_compass_ner_final")
            
            # Check if the user has downloaded the fine-tuned weights
            if os.path.exists(custom_model_path):
                logger.info(f"Custom Fine-Tuned Model found at {custom_model_path}. Loading...")
                MODEL_NAME = custom_model_path
            else:
                logger.warning(f"Custom model not found at {custom_model_path}. Falling back to pre-trained generic model.")
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
        """
        Process the raw text and extract entities (Skills, Roles, Orgs).
        """
        if self._ner_pipeline is None or not text:
            return {"skills": [], "roles": [], "organizations": []}

        try:
            # Text can be very long. BERT models have a max length of 512 tokens.
            # We truncate or chunk the text for inference.
            # Simple chunking by paragraph for safety:
            chunks = text.split("\n\n")
            all_entities = []
            
            for chunk in chunks:
                if len(chunk.strip()) < 5:
                    continue
                # Truncate chunk to approx BERT token limit
                safe_chunk = chunk[:2000]
                results = self._ner_pipeline(safe_chunk)
                all_entities.extend(results)

            # Map the entities (Generic processing)
            # In a Custom Skill NER, labels would be 'B-SKILL', 'I-SKILL'
            skills = set()
            roles = set()
            orgs = set()

            for entity in all_entities:
                word = entity.get("word", "").replace("#", "").strip()
                label = entity.get("entity_group", "")
                
                # Mapping generic NER to CV concepts for demonstration
                # 'MISC' or 'ORG' often capture technologies in generic models
                if label in ["MISC", "SKILL"] and len(word) > 2:
                    skills.add(word)
                elif label == "PER" and "engineer" in word.lower():
                    roles.add(word)
                elif label == "ORG":
                    orgs.add(word)

            return {
                "skills": list(skills),
                "roles": list(roles),
                "organizations": list(orgs)
            }
            
        except Exception as e:
            logger.error(f"NER Extraction failed: {e}")
            return {"skills": [], "roles": [], "organizations": []}
