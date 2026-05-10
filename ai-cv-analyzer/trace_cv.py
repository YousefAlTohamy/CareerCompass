import os
import sys
import json
import time
from datetime import date
from typing import Dict, Any

# Add workspace to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.layer1_understanding.orchestrator import CVOrchestrator
from core.layer2_classification.orchestrator import ClassificationOrchestrator
from core.layer2_classification.domain_engine import DomainEngine
from core.layer2_classification.seniority_engine import SeniorityEngine
from core.layer2_classification.skill_engine import SkillEngine
from core.layer3_matching.similarity import IntelligentMatcher
from core.layer3_matching.job_description_engine import JobDescriptionEngine

def deep_trace_cv(cv_path: str):
    if not os.path.exists(cv_path):
        print(f"ERROR: File not found: {cv_path}")
        return

    print(f"\n[START] Starting Deep Trace for: {os.path.basename(cv_path)}")
    print("=" * 60)

    # Initialize Layer 1
    orchestrator = CVOrchestrator()
    
    # Access the classifier from orchestrator if needed, or create new one
    from core.layer2_classification.classifier import CVDomainClassifier
    classifier = CVDomainClassifier()
    
    # Initialize Layer 2
    domain_engine = DomainEngine(classifier=classifier)
    seniority_engine = SeniorityEngine(embedder=classifier.embedder)
    skill_engine = SkillEngine()
    
    # Initialize Layer 3
    matcher = IntelligentMatcher(embedder=classifier.embedder, domain_engine=domain_engine)
    jd_engine = JobDescriptionEngine(domain_engine=domain_engine, seniority_engine=seniority_engine)

    # ---------------------------------------------------------
    # STEP 1: LAYER 1 (Extraction)
    # ---------------------------------------------------------
    print("\n[STEP 1] Layer 1: Spatial Understanding & Extraction")
    print("-" * 57)
    with open(cv_path, "rb") as f:
        pdf_bytes = f.read()
        
    result_raw = orchestrator.process_cv(pdf_bytes, filename=os.path.basename(cv_path))
    result = json.loads(result_raw.model_dump_json())
    
    print(f"DONE: Text Extracted Successfully.")
    print(f"INFO: Full Name Detected: {result.get('profile', {}).get('full_name')}")

    # ---------------------------------------------------------
    # STEP 2: LAYER 2 (Classification)
    # ---------------------------------------------------------
    print("\n[STEP 2] Layer 2: Modular Classification (Engines)")
    print("-" * 57)
    
    domain_scores = domain_engine.predict_domain(result)
    primary_domain = max(domain_scores, key=domain_scores.get)
    
    seniority_data = seniority_engine.analyze_seniority(result)
    
    cv_skills = result.get("skills", {}).get("items", [])
    skills_categorized = skill_engine.categorize_skills(cv_skills)
    
    # Get total years from Layer 1 metadata
    total_years = result.get("analysis", {}).get("metadata", {}).get("experience", {}).get("total_experience_years", 0.0)

    # Update result with Layer 2 info for matcher
    result["analysis"].update({
        "primary_domain": primary_domain,
        "seniority": seniority_data["level"],
        "domain_scores": domain_scores
    })

    print(f"RESULT: Domain Detected: {primary_domain} (Confidence: {domain_scores[primary_domain]:.2f})")
    print(f"RESULT: Seniority: {seniority_data['level']} (Years: {total_years})")
    print(f"RESULT: Top Hard Skills: {', '.join(skills_categorized['hard_skills'][:5])}")

    # ---------------------------------------------------------
    # STEP 3: LAYER 3 (Matchmaking)
    # ---------------------------------------------------------
    print("\n[STEP 3] Layer 3: Decision Intelligence Matchmaking")
    print("-" * 57)
    
    # Target JD: Senior Software Engineer (Hypothetical for Stress Test)
    target_jd = """
    Senior Software Engineer (6+ years)
    Requirements:
    - Deep expertise in React and Node.js.
    - Strong communication and leadership skills.
    - 6+ years of professional experience.
    """
    
    jd_data = jd_engine.parse_jd(target_jd)
    print(f"INFO: Matching against JD: 'Senior Software Engineer (6+ years)'")
    
    match_result = matcher.calculate_match(result, jd_data)
    
    fit_analysis = match_result['fit_analysis']
    print(f"RESULT: Match Score: {match_result['match_score']}%")
    print(f"RESULT: Verdict: {fit_analysis['verdict']}")
    
    print("\nFIT ANALYSIS BREAKDOWN:")
    print(f"STRENGTHS: {fit_analysis['strengths']}")
    print(f"GAPS: {fit_analysis['gaps']}")
    print(f"RED FLAGS: {fit_analysis['red_flags']}")

    # Save Trace
    output_filename = f"tests/trace_{os.path.basename(cv_path).replace(' ', '_')}.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print("\n" + "=" * 60)
    print(f"FINISH: Deep Trace Completed. Full JSON saved to {output_filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python trace_cv.py <path_to_pdf>")
    else:
        deep_trace_cv(sys.argv[1])
