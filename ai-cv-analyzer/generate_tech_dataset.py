import json
import time
import os
from dotenv import load_dotenv  # استدعاء المكتبة
from google import genai
from google.genai import types

# تحميل المتغيرات من ملف .env
load_dotenv()

print("🚀 Starting Smart AI-Driven Dataset Generation (gemini-2.0-flash)...")

# قراءة المفتاح بأمان من الذاكرة المخفية
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("❌ GEMINI_API_KEY is missing! Please add it to your .env file.")

client = genai.Client(api_key=api_key)

system_prompt = """
You are an expert Tech Recruiter and Data Annotator.
Generate 20 completely unique, realistic, and slightly messy snippets from Technical Resumes.
Vary the domains (e.g., Backend, Frontend, DevOps, Mobile, Data Science, Cyber Security).
CRITICAL: Make them look like real human CVs. Include real-world noise: bullet points, dates, URLs, percentages, and varied sentence structures. DO NOT use rigid templates.

For each snippet, perform strict NER annotation.
Categories: SKILL (tech skills only), ROLE (job titles), EDU (degrees/majors), CERT (certifications).
Ignore soft skills, dates, percentages, and URLs (mark them as 0).

Mapping: O=0, B-SKILL=1, I-SKILL=2, B-ROLE=3, I-ROLE=4, B-EDU=5, I-EDU=6, B-CERT=7, I-CERT=8.

Output MUST be a valid JSON array of objects. Example:
[
  {
    "tokens": ["•", "Worked", "as", "a", "Senior", "Flutter", "Developer", "using", "Dart", "and", "Bloc", "."],
    "ner_tags": [0, 0, 0, 0, 3, 4, 4, 0, 1, 0, 1, 0]
  }
]
"""

# ==========================================
# 1. إعدادات الاستئناف التلقائي وحماية البيانات
# ==========================================
target_total_samples = 1000
samples_per_batch = 20
filename = 'train_real_tech_1000.json'
existing_samples = 0

# قراءة الملف لو موجود لمعرفة العدد الحالي وعدم مسحه
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

# ==========================================
# 2. بدء التوليد والحفظ الفوري (Append Mode)
# ==========================================
# استخدام 'a' للكتابة فوق البيانات الموجودة بدون مسحها
with open(filename, 'a', encoding='utf-8') as f:
    batch_idx = 0
    total_saved_now = existing_samples
    
    while batch_idx < batches_needed:
        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash', 
                contents=system_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.8
                )
            )
            
            batch_data = json.loads(response.text)
            
            if isinstance(batch_data, list):
                # حفظ فوري لكل سيرة ذاتية في الملف
                for entry in batch_data:
                    f.write(json.dumps(entry) + '\n')
                
                f.flush()  # إجبار النظام على الكتابة في الهارد ديسك فوراً لحماية البيانات من الـ Crashes
                os.fsync(f.fileno())
                
                total_saved_now += len(batch_data)
                print(f"[{batch_idx+1}/{batches_needed}] Generated {len(batch_data)} snippets. (Total saved: {total_saved_now})")
                
            batch_idx += 1
            time.sleep(5) # راحة 5 ثواني لتجنب تخطي 15 طلب في الدقيقة
            
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "Quota" in error_msg or "exhausted" in error_msg.lower():
                print(f"⚠️ Rate limit hit! Cooling down for 60 seconds before retrying batch {batch_idx+1}...")
                time.sleep(60) # راحة أطول لضمان تجديد الكوتا بشكل سليم
            else:
                print(f"[{batch_idx+1}/{batches_needed}] ❌ Error parsing JSON, retrying... ({e})")
                time.sleep(5)

print(f"🎉 DONE! Successfully reached {total_saved_now} diverse tech resume samples.")