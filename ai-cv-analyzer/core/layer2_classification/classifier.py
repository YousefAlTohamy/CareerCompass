import logging
import threading
from typing import Dict, Optional
from core.layer3_matching.embedder import SemanticEmbedder

logger = logging.getLogger(__name__)

class CVDomainClassifier:
    """
    Lean AI Model Provider for CV Classification.
    This class now only handles the BERT model loading (Singleton) 
    to be shared across specialized engines.
    """
    _instance: Optional["CVDomainClassifier"] = None
    _instance_lock = threading.Lock()

    def __new__(cls) -> "CVDomainClassifier":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super(CVDomainClassifier, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        logger.info("🧠 Loading BERT Semantic Embedder for Layer 2...")
        self._embedder = SemanticEmbedder()
        self._initialized = True
        logger.info("✅ BERT Model ready.")

    @property
    def embedder(self) -> SemanticEmbedder:
        return self._embedder
