import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

# Import Layer 1: Understanding
from core.layer1_understanding.universal_extractor import process_document
from core.layer1_understanding.ner_engine import SkillNEREngine

# Import Layer 2: Classification
from core.layer2_classification.classifier import CVDomainClassifier

# Import Layer 3: Matching
from core.layer3_matching.similarity import IntelligentMatcher

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CareerCompass AI Engine v2.0",
    description="The 3-Layer Intelligent Backend for CV Analysis and Job Matching",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI singletons on startup
@app.on_event("startup")
async def startup_event():
    logger.info("Initializing AI Engine v2 Models (This may take a moment)...")
    # Instantiating these classes triggers the _load_model() logic inside their Singletons
    SkillNEREngine()
    CVDomainClassifier()
    # IntelligentMatcher initializes the SemanticEmbedder automatically
    IntelligentMatcher()
    logger.info("All AI Models loaded successfully into memory.")

@app.get("/")
def health_check():
    return {"status": "operational", "version": "v2.0 (3-Layer Architecture)"}

@app.post("/api/v2/analyze-cv")
async def analyze_full_cv(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    The main endpoint executing Layer 1 and Layer 2 on an uploaded CV.
    """
    logger.info(f"Received CV Analysis request for: {file.filename}")
    
    # ─── Read File Bytes ───
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    # ─── Layer 1: CV Understanding (Extraction + NER) ───
    logger.info("--> Executing Layer 1: Data Preprocessing & NER")
    raw_text, extraction_method = process_document(file.filename, file_bytes)
    
    if not raw_text:
         raise HTTPException(status_code=422, detail="Failed to extract any text from the document.")

    ner_engine = SkillNEREngine()
    entities = ner_engine.extract_entities(raw_text)

    # ─── Layer 2: Domain Classification ───
    logger.info("--> Executing Layer 2: CV Domain Classification")
    classifier = CVDomainClassifier()
    domain_probs = classifier.predict_domain(raw_text)
    primary_domain = max(domain_probs, key=domain_probs.get) if domain_probs else "Unknown"

    return {
        "status": "success",
        "metadata": {
            "filename": file.filename,
            "extraction_method": extraction_method,
            "text_length": len(raw_text)
        },
        "layer1_understanding": {
            "skills": entities.get("skills", []),
            "roles": entities.get("roles", []),
            "organizations": entities.get("organizations", [])
        },
        "layer2_classification": {
            "primary_domain": primary_domain,
            "domain_probabilities": domain_probs
        }
    }

from pydantic import BaseModel
class MatchRequest(BaseModel):
    cv_text: str
    cv_skills: list[str]
    job_description: str
    job_skills: list[str]

@app.post("/api/v2/match-job")
def match_job(request: MatchRequest) -> Dict[str, Any]:
    """
    Layer 3 endpoint: Compares a user's CV to a specific job description.
    """
    logger.info("--> Executing Layer 3: Intelligent Matching")
    
    matcher = IntelligentMatcher()
    
    cv_data = {"raw_text": request.cv_text, "skills": request.cv_skills}
    job_data = {"description": request.job_description, "skills": request.job_skills}
    
    match_results = matcher.calculate_match(cv_data, job_data)
    
    return {
        "status": "success",
        "layer3_matching": match_results
    }

if __name__ == "__main__":
    import uvicorn
    # Running on port 8002 to avoid conflicts with the legacy ai-engine (port 8001)
    uvicorn.run(app, host="0.0.0.0", port=8002)
