import os
import sys
import time
import tracemalloc

sys.path.append(os.path.dirname(__file__))

from core.layer1_understanding.orchestrator import CVOrchestrator
import core.layer1_understanding.orchestrator as orch_module
from core.layer1_understanding.spatial_parser import SpatialTextExtraction

def run_stress_test():
    print("--- 1. Initializing CVOrchestrator (Singleton Test) ---")
    tracemalloc.start()
    t0 = time.time()
    orchestrator1 = CVOrchestrator()
    orchestrator2 = CVOrchestrator()
    
    # Check if AdvancedNEREngine acts as singleton correctly
    if id(orchestrator1._ner) == id(orchestrator2._ner):
        print("SUCCESS: AdvancedNEREngine is a Singleton.")
    else:
        print("FAILURE: AdvancedNEREngine is NOT a Singleton.")
        
    print(f"Initialization took {time.time() - t0:.2f}s")
    
    print("\n--- 2. Massive File Test (Memory & Padding check) ---")
    # Simulate a massive CV text (e.g. 50,000 words ~ 300KB text equivalent to 10MB PDF)
    massive_text = ("John Doe\nExperience\nGoogle Software Engineer\n" + "bullet point " * 50) * 1000
    
    def mocked_extract_spatial(*args, **kwargs):
        return SpatialTextExtraction(status="ok", text=massive_text, page_count=10, word_count=len(massive_text.split()))
    
    old_spatial = orch_module.extract_spatial_text_from_pdf
    orch_module.extract_spatial_text_from_pdf = mocked_extract_spatial
    
    try:
        t1 = time.time()
        res = orchestrator1.process_cv(b"dummy")
        t2 = time.time()
        print(f"Massive file processing time: {t2 - t1:.2f}s")
        if (t2 - t1) < 10.0:
            print("SUCCESS: Model processed massive file efficiently without hanging.")
        else:
            print("WARNING: Processing took longer than expected.")
    except Exception as e:
        print(f"FAILURE: Model crashed on massive file! {e}")
        
    current, peak = tracemalloc.get_traced_memory()
    print(f"Memory Usage: Current={current / 10**6:.2f}MB, Peak={peak / 10**6:.2f}MB")
    tracemalloc.stop()

    print("\n--- 3. Error Handling Test (Fallback) ---")
    def mocked_extract_error(*args, **kwargs):
        raise ValueError("Corrupted PDF Simulator")
    
    orch_module.extract_spatial_text_from_pdf = mocked_extract_error
    try:
        res = orchestrator1.process_cv(b"dummy corrupt")
        if res.parsing_status == "error":
            print("SUCCESS: Graceful fallback on corrupted PDF. No crash.")
        else:
            print(f"FAILURE: Unexpected status: {res.parsing_status}")
    except Exception as e:
        print(f"FAILURE: Uncaught exception crashed the orchestrator: {e}")
        
    finally:
        orch_module.extract_spatial_text_from_pdf = old_spatial

    print("\n--- 4. Standard Response Time Test ---")
    standard_text = "John Doe\nSenior Backend Developer\nExperience\nHuma-Volve\nSept 2021 - Present\n- Built awesome APIs\nTech Stack: Python, Laravel, Redis, AWS"
    def mocked_extract_spatial_standard(*args, **kwargs):
        return SpatialTextExtraction(status="ok", text=standard_text, page_count=2, word_count=len(standard_text.split()))
    
    orch_module.extract_spatial_text_from_pdf = mocked_extract_spatial_standard
    try:
        t3 = time.time()
        res = orchestrator1.process_cv(b"dummy standard")
        t4 = time.time()
        print(f"Standard 2-page CV processing time: {t4 - t3:.2f}s")
        if (t4 - t3) <= 5.0:
            print("SUCCESS: Standard processing is under 5 seconds.")
        else:
            print("FAILURE: Standard processing is too slow.")
    finally:
        orch_module.extract_spatial_text_from_pdf = old_spatial

if __name__ == '__main__':
    run_stress_test()
