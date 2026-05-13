import logging
import os
# pyrefly: ignore [missing-import]
import numpy as np

try:
    # pyrefly: ignore [missing-import]
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

try:
    # pyrefly: ignore [missing-import]
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
    _cache = {}  # In-memory cache
    _max_cache_size = 2000

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
        Returns a cached vector if available.
        """
        if self._model is None or not text:
            return np.zeros((384,))

        # 1. Check Cache
        text_hash = hash(text)
        if text_hash in self._cache:
            return self._cache[text_hash]

        # 2. Generate new embedding
        try:
            embedding = self._model.encode(text, convert_to_numpy=True)
            
            # 3. Save to Cache
            if len(self._cache) < self._max_cache_size:
                self._cache[text_hash] = embedding
                
            return embedding
        except Exception as e:
            logger.error("Embedding generation failed: %s", e)
            return np.zeros((384,))

    def get_embeddings_batch(self, texts: list[str]) -> np.ndarray:
        """
        Batch-encode multiple texts at once. Uses cache for known texts.
        """
        if self._model is None or not texts:
            return np.zeros((max(1, len(texts)), 384))

        results = [None] * len(texts)
        to_encode = []
        to_encode_indices = []

        # 1. Check cache for each text
        for i, text in enumerate(texts):
            text_hash = hash(text)
            if text_hash in self._cache:
                results[i] = self._cache[text_hash]
            else:
                to_encode.append(text)
                to_encode_indices.append(i)

        # 2. Encode only those not in cache
        if to_encode:
            try:
                new_embeddings = self._model.encode(to_encode, convert_to_numpy=True, batch_size=32)
                for i, emb in enumerate(new_embeddings):
                    original_idx = to_encode_indices[i]
                    results[original_idx] = emb
                    # Save to cache
                    if len(self._cache) < self._max_cache_size:
                        self._cache[hash(to_encode[i])] = emb
            except Exception as e:
                logger.error("Batch embedding failed: %s", e)
                # Fallback: fill None with zeros
                for i in to_encode_indices:
                    results[i] = np.zeros((384,))

        return np.array(results)
    def compute_similarity(self, text1: str, text2: str) -> float:
        """
        Calculates cosine similarity between two strings.
        Returns a float between -1.0 and 1.0 (usually 0.0 to 1.0 for BERT).
        """
        if not text1 or not text2:
            return 0.0
            
        emb1 = self.get_embedding(text1)
        emb2 = self.get_embedding(text2)
        
        # Cosine similarity formula
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return float(np.dot(emb1, emb2) / (norm1 * norm2))
