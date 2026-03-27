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

# 1. قراءة جميع المفاتيح كقائمة
api_keys_str = os.getenv("GEMINI_API_KEYS")
if not api_keys_str:
    raise ValueError("❌ GEMINI_API_KEYS is missing! Please add them to your .env file separated by commas.")

api_keys = [key.strip() for key in api_keys_str.split(',') if key.strip()]
if not api_keys:
    raise ValueError("❌ No valid keys found in GEMINI_API_KEYS!")

print(f"🔑 Loaded {len(api_keys)} API keys.")
current_key_idx = 0

# تهيئة الاتصال بأول مفتاح
client = genai.Client(api_key=api_keys[current_key_idx])

# إعداد الـ Prompt
system_prompt = """
You are an expert Tech Recruiter and Data Annotator.
Generate 10 completely unique, highly realistic, and visually messy snippets from Technical Resumes.
CRITICAL REQUIREMENTS:
1. Domains: Ensure an EQUAL and RANDOM distribution across ALL tech fields (e.g., Backend, Frontend, DevOps, Mobile, AI/Data Science, Cyber Security, Cloud Computing, QA, Networking). DO NOT favor any specific technology or framework.
2. Realism: Mimic human CVs exactly. Include dates, URLs, percentages, bullet points (•, -, *), weird spacings, typos, and imperfect grammar.
3. Soft Skills: DO NOT ignore soft skills. Include them naturally (e.g., "Leadership", "Excellent Communication", "Problem Solving").
4. Realistic Noise: Introduce occasional typos, varied bullet point styles, missing punctuation, and non-standard section headers (e.g., "Work Hist.", "Tech Stack") to make the model robust against imperfect resumes.

Generate high-quality, full sentences (CV snippets). Do NOT pre-tokenize the text.
For each snippet, provide the full text and a list of exact entity strings with their types.
Categories:
- SKILL: Technical skills, tools, languages, frameworks (e.g., "React", "Python", "Docker", "Figma", "AWS").
- SOFT: Soft skills and interpersonal traits (e.g., "Teamwork", "Agile leadership").
- ROLE: Job titles (e.g., "Senior Cloud Architect").
- EDU: Degrees and majors (e.g., "B.Sc. Computer Science").
- CERT: Certifications (e.g., "AWS Certified Solutions Architect").

Output MUST be a valid JSON array of objects. Example:
[
  {
    "text": "• Led a team of Flutter Devs with strong communication.",
    "entities": [
      {"text": "Flutter", "label": "SKILL"},
      {"text": "Devs", "label": "ROLE"},
      {"text": "communication", "label": "SOFT"}
    ]
  }
]
"""

def clean_json_response(text):
    text = text.strip()
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    return text.strip()

target_total_samples = 50000
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
    
    available_models = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-pro-latest',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-3-pro-preview',
        'gemini-3-flash-preview'
    ]
    
    current_model_idx = 0
    exhausted_models = set() 
    unavailable_counts = {} # لتتبع عدد أخطاء 503 لكل موديل

    while batch_idx < batches_needed:
        active_model = available_models[current_model_idx]
        
        try:
            response = client.models.generate_content(
                model=active_model, 
                contents=system_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.85)
            )
            
            # تصفير العداد إذا نجح الموديل في توليد الرد
            if active_model in unavailable_counts:
                unavailable_counts[active_model] = 0

            clean_text = clean_json_response(response.text)
            batch_data = json.loads(clean_text)
            
            if isinstance(batch_data, list):
                for entry in batch_data:
                    f.write(json.dumps(entry) + '\n')
                
                f.flush()
                os.fsync(f.fileno())
                total_saved_now += len(batch_data)
                print(f"[{batch_idx+1}/{batches_needed}] ✅ Generated {len(batch_data)} snippets via {active_model} (Key #{current_key_idx + 1}). (Total: {total_saved_now})")
                
            batch_idx += 1
            time.sleep(4) 
            
        except Exception as e:
            error_msg = str(e).lower()
            
            is_quota = "429" in error_msg or "quota" in error_msg or "exhausted" in error_msg or "limit: 0" in error_msg
            is_unavailable = "503" in error_msg or "unavailable" in error_msg or "high demand" in error_msg
            
            # معالجة خطأ 503
            if is_unavailable:
                unavailable_counts[active_model] = unavailable_counts.get(active_model, 0) + 1
                if unavailable_counts[active_model] < 3:
                    print(f"[{batch_idx+1}/{batches_needed}] ⚠️ 503 Error ({unavailable_counts[active_model]}/3). Retrying in 5s... ({active_model})")
                    time.sleep(5)
                    continue # إعادة المحاولة مع نفس الموديل
                else:
                    print(f"🚨 {active_model} returned 503 error 3 times! Treating it as exhausted and switching...")
                    is_quota = True # تفعيل منطق التحويل للموديل أو المفتاح التالي

            if is_quota:
                exhausted_models.add(active_model)
                
                if len(exhausted_models) >= len(available_models):
                    current_key_idx += 1
                    
                    if current_key_idx < len(api_keys):
                        print(f"🔄 All models exhausted for Key #{current_key_idx}. Switching to API Key #{current_key_idx + 1}...")
                        client = genai.Client(api_key=api_keys[current_key_idx])
                        exhausted_models.clear() 
                        unavailable_counts.clear() 
                        current_model_idx = 0        
                    else:
                        print("⚠️ All API Keys AND all models are currently exhausted! Cooling down for 60 seconds...")
                        time.sleep(60)
                        exhausted_models.clear()
                        unavailable_counts.clear()
                        current_key_idx = 0 
                        current_model_idx = 0 
                        client = genai.Client(api_key=api_keys[current_key_idx])
                else:
                    while available_models[current_model_idx] in exhausted_models:
                        current_model_idx = (current_model_idx + 1) % len(available_models)
                        
                    print(f"   ⚠️ Switching from {active_model} to {available_models[current_model_idx]}...")
                    time.sleep(2)
            
            elif not is_unavailable:
                # أخطاء أخرى غير 503 و غير الـ Quota
                print(f"[{batch_idx+1}/{batches_needed}] ❌ Error, retrying... ({e})")
                time.sleep(5)

print(f"🎉 DONE! Successfully reached {total_saved_now} diverse tech resume samples.")