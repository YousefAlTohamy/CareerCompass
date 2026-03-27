import sys
import os
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from core.layer1_understanding.experience_engine import ExperienceEngine
from core.layer1_understanding.orchestrator import CVOrchestrator

def verify():
    print("--- 1. Verify Date Regex & total_years ---")
    engine = ExperienceEngine()
    text = "Sept 2021 - Present\nJan 2018 - Aug 2021\n05/2015 - 12/2017"
    ranges = engine.extract_date_ranges(text)
    print("Extracted Ranges:")
    for r in ranges:
        print(f"  {r.source_text} -> start: {r.start}, end: {r.end}")
        
    years = engine.calculate_total_experience_years(text)
    print(f"Total Years Calculated: {years}")
    
    # Assertions
    has_present = any(r.end == date.today() for r in ranges)
    if has_present:
        print("SUCCESS: 'Present' correctly mapped to date.today() (is_current test).")
    else:
        print("FAILURE: 'Present' not mapped correctly.")
        
    if years > 5.0:
        print("SUCCESS: Date calculation works with new varying formats (abbreviations, numeric).")
    else:
         print("FAILURE: Date calculation seems incorrect.")

    print("\n--- 2. Verify Description Scrubbing ---")
    orchestrator = CVOrchestrator()
    
    # Ensure NER produces a specific role and org
    original_extract = orchestrator._ner.extract_entities
    def mocked_extract(*args, **kwargs):
        return {
            "orgs": ["Google"],
            "roles": ["Backend Developer"]
        }
    orchestrator._ner.extract_entities = mocked_extract
    
    block_text = "Backend Developer\nGoogle\n- Developed scalable APIs\n- Managed database migrations"
    items = orchestrator._build_experience_items(block_text, predicted_title="Backend Developer")
    
    try:
        if items:
            item = items[0]
            print(f"Role: {item.title}, Company: {item.company}")
            print("Description Bullets:")
            for b in item.description:
                print(f"  - {b}")
            
            has_role_or_company_bullet = False
            for b in item.description:
                if "Backend Developer" in b or "Google" in b:
                    has_role_or_company_bullet = True
                    
            if not has_role_or_company_bullet and len(item.description) == 2:
                print("SUCCESS: Description scrubbed correctly. Redundant strings converted securely.")
            else:
                print("FAILURE: Description scrubbing failed. Found:", item.description)
        else:
            print("FAILURE: No items returned.")
    finally:
        orchestrator._ner.extract_entities = original_extract

if __name__ == '__main__':
    verify()
