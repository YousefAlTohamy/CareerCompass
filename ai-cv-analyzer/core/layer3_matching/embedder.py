import logging
import os
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration via environment variables
# ---------------------------------------------------------------------------
_MODEL_NAME = os.getenv("EMBEDDER_MODEL_NAME", "all-MiniLM-L6-v2")
_QUANTIZE = os.getenv("EMBEDDER_QUANTIZE", "false").lower() in ("1", "true", "yes")


class SemanticEmbedder:
    """
    Layer 3: Semantic Embedder (Singleton).

    Converts text into high-dimensional vectors using a sentence-transformer.

    Phase 5 enhancements:
    - **CPU-safe**: never calls ``.to('cuda')`` — lets SentenceTransformer
      auto-detect the best available device via its own logic.
    - **Optional quantization**: When ``EMBEDDER_QUANTIZE=true`` env var is set,
      applies dynamic int8 quantization to reduce memory footprint on CPU servers.
    - **Loaded once**: Singleton pattern ensures a single model instance across
      the entire process lifetime.
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
            logger.error("sentence-transformers not installed. SemanticEmbedder disabled.")
            return

        logger.info("Loading Embedder Model '%s' ...", _MODEL_NAME)
        try:
            # SentenceTransformer auto-selects device (CPU/CUDA) internally.
            # We do NOT force .to('cuda') — safe for CPU-only servers.
            self._model = SentenceTransformer(_MODEL_NAME)

            # Optional: Dynamic int8 quantization for CPU to reduce memory
            if _QUANTIZE and TORCH_AVAILABLE:
                try:
                    self._model[0].auto_model = torch.quantization.quantize_dynamic(
                        self._model[0].auto_model,
                        {torch.nn.Linear},
                        dtype=torch.qint8,
                    )
                    logger.info("Embedder model quantized (int8 dynamic) successfully.")
                except Exception as qe:
                    logger.warning("Embedder quantization failed (non-fatal): %s", qe)

            logger.info("Embedder Model '%s' loaded successfully.", _MODEL_NAME)
        except Exception as e:
            logger.error("Failed to load Embedder model: %s", e)
            self._model = None

    @property
    def is_available(self) -> bool:
        """Check if the model is loaded and ready."""
        return self._model is not None

    def get_embedding(self, text: str) -> np.ndarray:
        """
        Generates a vector embedding for the given text.

        Returns a zero-vector if the model is unavailable or input is empty.
        """
        if self._model is None or not text:
            return np.zeros((384,))  # Default size for MiniLM

        try:
            embedding = self._model.encode(text, convert_to_numpy=True)
            return embedding
        except Exception as e:
            logger.error("Embedding generation failed: %s", e)
            return np.zeros((384,))

    def get_embeddings_batch(self, texts: list[str]) -> np.ndarray:
        """
        Batch-encode multiple texts at once (more efficient than single calls).

        Returns a 2-D numpy array of shape (len(texts), 384).
        """
        if self._model is None or not texts:
            return np.zeros((max(1, len(texts)), 384))

        try:
            return self._model.encode(texts, convert_to_numpy=True, batch_size=32)
        except Exception as e:
            logger.error("Batch embedding failed: %s", e)
            return np.zeros((len(texts), 384))
