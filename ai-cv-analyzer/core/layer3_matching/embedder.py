import logging
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)

class SemanticEmbedder:
    """
    Layer 3: Semantic Embedder
    Converts text (CV or Job Description) into high-dimensional vectors.
    """
    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SemanticEmbedder, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            logger.error("sentence-transformers not installed.")
            return

        logger.info("Loading Layer 3 Embedder Model...")
        try:
            # MiniLM is extremely fast and accurate enough for semantic matching
            MODEL_NAME = "all-MiniLM-L6-v2"
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info(f"Embedder Model '{MODEL_NAME}' loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Embedder model: {e}")
            self._model = None

    def get_embedding(self, text: str) -> np.ndarray:
        """
        Generates a vector embedding for the given text.
        """
        if self._model is None or not text:
            return np.zeros((384,)) # Default size for MiniLM

        try:
            # Encode text to vector
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return np.zeros((384,))
