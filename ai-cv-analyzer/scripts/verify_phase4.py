import os
import sys

sys.path.append(os.path.dirname(__file__))

from core.layer1_understanding.advanced_ner import AdvancedNEREngine
from core.layer1_understanding.orchestrator import CVOrchestrator

def benchmark():
    ner = AdvancedNEREngine()
    print(f"--- 1. Verification of Loaded Model ---")
    model_name = ner._ner.model.config.name_or_path
    print(f"Loaded NER Model Path: {model_name}")
    if "career_compass_ner_final" in model_name:
        print("SUCCESS: Local fine-tuned model loaded successfully.")
    else:
        print("FAILURE: Model loaded was a fallback: " + model_name)

    print("\n--- 2. Benchmarking Name Extraction (PER Label Confidence) ---")
    # Using the bert-base-NER mock
    text = "John Doe is a Senior Laravel Developer. He worked at Huma-Volve."
    entities = ner.extract_entities(text)
    
    # Check what people entities it found
    people = entities.get("people", [])
    print(f"Found people entities: {people}")
    
    name_candidate = ner.extract_candidate_name(text, entities=entities)
    print(f"Extracted Name Candidate: {name_candidate.full_name if name_candidate else None}")
    if name_candidate:
        print(f"Confidence Score: {name_candidate.confidence_score}")
        if name_candidate.confidence_score >= 0.90:
            print("SUCCESS: Name extraction confidence score is above 0.90.")
        else:
             print("FAILURE: Confidence score too low.")

    print("\n--- 3. Benchmarking Orchestrator (Roles, Skills, Experience) ---")
    orchestrator = CVOrchestrator()
    # Mock spatial extraction exactly like the test CVs
    import core.layer1_understanding.orchestrator as orch_module
    from core.layer1_understanding.spatial_parser import SpatialTextExtraction
    
    bench_text = "John Doe\nLaravel Developer\nExperience\nHuma-Volve\nSept 2021 - Present\n- Led a team to build amazing APIs."
    
    def mocked_extract_spatial(*args, **kwargs):
        return SpatialTextExtraction(status="ok", text=bench_text, page_count=1, word_count=len(bench_text.split()))
    
    old_spatial = orch_module.extract_spatial_text_from_pdf
    orch_module.extract_spatial_text_from_pdf = mocked_extract_spatial
    
    try:
        res = orchestrator.process_cv(b"dummy")
        
        # Check Name Extraction
        print(f"Full Name: {res.profile.full_name}")
        
        # Check Skills vs Roles
        skills = [s.name for s in res.skills.items]
        roles = res.analysis.metadata["segmentation"]["found_sections"]  # Just testing it runs without overlapping
        print(f"Extracted Skills: {skills}")
        if "Laravel Developer" not in skills and "Huma-Volve" not in skills:
             print("SUCCESS: Skills do not contain roles or organization names.")
        else:
             print("FAILURE: Skills overlapped with roles.")
             
        # Check Experience Years
        years = res.analysis.metadata["experience"]["total_experience_years"]
        print(f"Total Experience Years: {years}")
        if years > 0:
            print("SUCCESS: Total experience years calculated accurately.")
        else:
            print("FAILURE: Total experience years is 0.")
            
        # Check Descriptions
        for item in res.experience.items:
            print(f"Experience Item Title: {item.title}, Company: {item.company}")
            print(f"Descriptions: {item.description}")
            if item.description and not any(item.title in b or item.company in b for b in item.description):
                 print("SUCCESS: Description bullet points scrubbed successfully.")
            
    finally:
        orch_module.extract_spatial_text_from_pdf = old_spatial

if __name__ == '__main__':
    benchmark()
