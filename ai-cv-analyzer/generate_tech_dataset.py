import json
import time
import os
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(override=True)
print("🚀 Starting Smart AI-Driven Dataset Generation (Enterprise Edition)...")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ GEMINI_API_KEY is missing! Please add it to your .env file.")

client = genai.Client(api_key=api_key)

# 1. تطوير الـ Prompt (إضافة Soft Skills وعشوائية لارافيل والمجالات الأخرى)
system_prompt = """
You are an expert Tech Recruiter and Data Annotator.
Generate 10 completely unique, highly realistic, and visually messy snippets from Technical Resumes.
CRITICAL REQUIREMENTS:
1. Domains: Ensure an EQUAL and RANDOM distribution across ALL tech fields (e.g., Backend, Frontend, DevOps, Mobile, AI/Data Science, Cyber Security, Cloud Computing, QA, Networking). DO NOT favor any specific technology or framework.
2. Realism: Mimic human CVs exactly. Include dates, URLs, percentages, bullet points (•, -, *), weird spacings, typos, and imperfect grammar.
3. Soft Skills: DO NOT ignore soft skills. Include them naturally (e.g., "Leadership", "Excellent Communication", "Problem Solving").

Perform strict NER annotation on the tokens.
Categories:
- SKILL: Technical skills, tools, languages, frameworks (e.g., "React", "Python", "Docker", "Figma", "AWS").
- SOFT: Soft skills and interpersonal traits (e.g., "Teamwork", "Agile leadership").
- ROLE: Job titles (e.g., "Senior Cloud Architect").
- EDU: Degrees and majors (e.g., "B.Sc. Computer Science").
- CERT: Certifications (e.g., "AWS Certified Solutions Architect").

Mapping: O=0, B-SKILL=1, I-SKILL=2, B-ROLE=3, I-ROLE=4, B-EDU=5, I-EDU=6, B-CERT=7, I-CERT=8, B-SOFT=9, I-SOFT=10.

Output MUST be a valid JSON array of objects. Example:
[
  {
    "tokens": ["•", "Led", "a", "team", "of", "Flutter", "Devs", "with", "strong", "communication", "."],
    "ner_tags": [0, 0, 0, 0, 0, 1, 3, 0, 9, 10, 0]
  }
]
"""

# 2. دالة تنظيف الـ JSON (لحماية السكربت من فزلكة الموديل)
def clean_json_response(text):
    text = text.strip()
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    return text.strip()

target_total_samples = 1000
samples_per_batch = 10
filename = 'train_real_tech_1000.json'
existing_samples = 0

if os.path.exists(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                existing_samples += 1

print(f"📦 Found {existing_samples} existing samples in '{filename}'.")

if existing_samples >= target_total_samples:
    print("🎉 Target already reached! No need to generate more data.")
    exit()

remaining_samples = target_total_samples - existing_samples
batches_needed = (remaining_samples + samples_per_batch - 1) // samples_per_batch
print(f"🎯 Target: {target_total_samples}. Need {remaining_samples} more. Running {batches_needed} batches...")

with open(filename, 'a', encoding='utf-8') as f:
    batch_idx = 0
    total_saved_now = existing_samples
    
    while batch_idx < batches_needed:
        try:
            # 3. نظام الموديل البديل (Fallback System)
            active_model = 'gemini-2.0-flash'
            try:
                response = client.models.generate_content(
                    model=active_model, 
                    contents=system_prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.85)
                )
            except Exception as e:
                if "429" in str(e) or "404" in str(e) or "quota" in str(e).lower():
                    print(f"   ⚠️ {active_model} is busy/exhausted. Falling back to gemini-1.5-flash...")
                    active_model = 'gemini-1.5-flash'
                    response = client.models.generate_content(
                        model=active_model, 
                        contents=system_prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.85)
                    )
                else:
                    raise e
            
            # تنظيف وتحويل النص
            clean_text = clean_json_response(response.text)
            batch_data = json.loads(clean_text)
            
            if isinstance(batch_data, list):
                for entry in batch_data:
                    f.write(json.dumps(entry) + '\n')
                
                f.flush()
                os.fsync(f.fileno())
                total_saved_now += len(batch_data)
                print(f"[{batch_idx+1}/{batches_needed}] ✅ Generated {len(batch_data)} snippets via {active_model}. (Total: {total_saved_now})")
                
            batch_idx += 1
            time.sleep(5) 
            
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "Quota" in error_msg or "exhausted" in error_msg.lower():
                print(f"⚠️ Both models hit rate limit! Cooling down for 60s...")
                time.sleep(60)
            else:
                print(f"[{batch_idx+1}/{batches_needed}] ❌ JSON Parse Error, retrying... ({e})")
                time.sleep(5)

print(f"🎉 DONE! Successfully reached {total_saved_now} diverse tech resume samples.")