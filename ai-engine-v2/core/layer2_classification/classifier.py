import logging
from typing import Dict

try:
    from transformers import pipeline
    import warnings
    warnings.filterwarnings("ignore")
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)

class CVDomainClassifier:
    """
    Layer 2: Domain Classification
    Uses Zero-Shot Classification to determine the professional domain of the CV
    without needing a massive labeled dataset initially.
    """
    _instance = None
    _classifier = None
    
    # Pre-defined domains relevant to the project
    DOMAINS = [
        "Backend Development",
        "Frontend Development",
        "Full Stack Development",
        "Mobile App Development",
        "Data Science & AI",
        "DevOps & Cloud",
        "UI/UX Design",
        "Quality Assurance & Testing",
        "Product Management",
        "Cybersecurity"
    ]

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CVDomainClassifier, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        """
        Loads the Zero-Shot classification model into memory (Singleton).
        """
        if not TRANSFORMERS_AVAILABLE:
            logger.error("HuggingFace Transformers not installed.")
            return

        logger.info("Loading Layer 2 Classifier Model...")
        try:
            # Using facebook's heavily optimized zero-shot model
            MODEL_NAME = "facebook/bart-large-mnli"
            self._classifier = pipeline("zero-shot-classification", model=MODEL_NAME)
            logger.info("Classifier Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Classifier model: {e}")
            self._classifier = None

    def predict_domain(self, parsed_text: str) -> Dict[str, float]:
        """
        Predicts the professional domain based on the extracted CV text/skills.
        Returns a dictionary of {Domain: Probability}.
        """
        if self._classifier is None or not parsed_text:
            return {"Unknown": 1.0}

        try:
            # We don't need the whole CV, just a chunk containing skills and summaries
            sample_text = parsed_text[:1500] 
            
            logger.info("Running Layer 2 Zero-Shot Classification...")
            
            result = self._classifier(
                sample_text, 
                candidate_labels=self.DOMAINS,
                multi_label=False # We want the primary domain
            )
            
            # Extract top 3 probabilities
            domain_probs = {}
            for label, score in zip(result['labels'][:3], result['scores'][:3]):
                domain_probs[label] = round(score, 4)
                
            return domain_probs

        except Exception as e:
            logger.error(f"Classification failed: {e}")
            return {"Error": 1.0}
