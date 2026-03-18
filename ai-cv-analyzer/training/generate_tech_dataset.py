import json
import time
import os
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path, override=True)
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

target_total_samples = 5000
samples_per_batch = 10
filename = 'train_real_tech.json'
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
    
    # 3. قائمة بأفضل الموديلات المتاحة في حسابك لتوليد النصوص
    available_models = [
        # عائلة 2.5
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        # عائلة 2.0
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
        # الأسماء العامة (Latest)
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-pro-latest',
        # عائلة 3 و 3.1 (النسخ التجريبية المتاحة في حسابك)
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-pro-preview',
        'gemini-3-flash-preview'
    ]
    
    current_model_idx = 0
    models_tried_this_batch = 0

    while batch_idx < batches_needed:
        active_model = available_models[current_model_idx]
        
        try:
            response = client.models.generate_content(
                model=active_model, 
                contents=system_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.85)
            )
            
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
                
            # لو نجحنا، ننتقل للباتش اللي بعده ونصفر عداد المحاولات
            batch_idx += 1
            models_tried_this_batch = 0
            time.sleep(4) 
            
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg or "limit: 0" in error_msg:
                models_tried_this_batch += 1
                
                # لو جربنا كل الموديلات في القائمة وكلهم رفضوا، نريح دقيقة كاملة
                if models_tried_this_batch >= len(available_models):
                    print("⚠️ All models are currently exhausted! Cooling down for 60 seconds...")
                    time.sleep(60)
                    models_tried_this_batch = 0 # تصفير العداد بعد الراحة
                else:
                    # ننقل على الموديل اللي عليه الدور في القائمة
                    current_model_idx = (current_model_idx + 1) % len(available_models)
                    print(f"   ⚠️ {active_model} busy. Switching to {available_models[current_model_idx]}...")
                    time.sleep(2) # انتظار بسيط قبل تجربة الموديل الجديد
            else:
                print(f"[{batch_idx+1}/{batches_needed}] ❌ Error, retrying... ({e})")
                time.sleep(5)

print(f"🎉 DONE! Successfully reached {total_saved_now} diverse tech resume samples.")