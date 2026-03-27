import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.layer1_understanding.advanced_ner import AdvancedNEREngine
from core.layer1_understanding.orchestrator import CVOrchestrator
from core.layer1_understanding.schema import CVParseResult, Profile, ExperienceSection

def verify():
    print("--- 1. Verify NER-Aware Name Extraction ---")
    ner = AdvancedNEREngine()
    test_text = "Senior Software Engineer\nBuilt amazing apps.\nYousef Altohamy\nWorked at Google."
    entities = {
        "people": ["Yousef Altohamy"]
    }
    name_candidate = ner.extract_candidate_name(test_text, entities)
    print(f"Entities provided: {entities}")
    print(f"Extracted Name: {name_candidate.full_name if name_candidate else None}")
    
    if name_candidate and name_candidate.full_name == "Yousef Altohamy":
        print("SUCCESS: Name extracted successfully using NER entities.")
    else:
        print("FAILURE: Name extraction failed or fell back incorrectly.")

    print("\n--- 2. Verify Label De-confliction ---")
    import core.layer1_understanding.orchestrator as orch_module
    from core.layer1_understanding.spatial_parser import SpatialTextExtraction

    orchestrator = CVOrchestrator()
    bench_text = "John Doe\nLaravel Developer\nHuma-Volve\nSept 2021 - Present\n- Led a team to build amazing APIs."
    
    def mocked_extract_spatial(*args, **kwargs):
        return SpatialTextExtraction(status="ok", text=bench_text, page_count=1, word_count=len(bench_text.split()))

    def mocked_extract_entities(*args, **kwargs):
        # We explicitly inject "Laravel Developer" as both a SKILL and a ROLE
        # And "Huma-Volve" as both a SKILL and an ORG to test de-confliction
        return {
            "skills": ["Python", "Docker", "Laravel Developer", "Huma-Volve"],
            "roles": ["Laravel Developer"],
            "orgs": ["Huma-Volve"],
            "people": ["John Doe"]
        }

    old_spatial = orch_module.extract_spatial_text_from_pdf
    old_extract = orchestrator._ner.extract_entities
    
    orch_module.extract_spatial_text_from_pdf = mocked_extract_spatial
    orchestrator._ner.extract_entities = mocked_extract_entities

    try:
        res = orchestrator.process_cv(b"dummy code")
        skills = [s.name.lower() for s in res.skills.items]
        
        print(f"Extracted Skills output: {skills}")
        if "laravel developer" not in skills and "huma-volve" not in skills and "python" in skills:
            print("SUCCESS: Skills list successfully de-conflicted. Overlapping roles and orgs removed.")
        else:
            print("FAILURE: Skills overlapped with roles/orgs.")
            
    finally:
         orch_module.extract_spatial_text_from_pdf = old_spatial
         orchestrator._ner.extract_entities = old_extract

if __name__ == '__main__':
    verify()
