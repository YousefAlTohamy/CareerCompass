from transformers import pipeline

# المسار اللي إنت حطيت فيه الموديل
model_path = "../models/ner_weights/career_compass_ner_final"

print("⏳ Loading Career Compass AI Model...")
# بنستخدم aggregation_strategy عشان يجمع أجزاء الكلمات لو اتقسمت
nlp_pipeline = pipeline("ner", model=model_path, tokenizer=model_path, aggregation_strategy="simple")

# سيرة ذاتية للتجربة
sample_cv = """
I am Yousef Altohamy, a Backend Developer with a solid background in Computer Science. 
I specialize in building scalable APIs using PHP and Laravel following SOLID principles. 
My experience includes optimizing databases with MySQL and preventing SQL injection.
"""

print("🔍 Analyzing CV...\n")
results = nlp_pipeline(sample_cv)

print("✅ Extracted Entities:")
print("-" * 40)
for entity in results:
    # فلترة عشان نعرض المهارات والمسميات الوظيفية بس
    if entity['entity_group'] in ['SKILL', 'ROLE']:
        print(f"🔸 {entity['entity_group']:<7} : {entity['word']} (Confidence: {entity['score']:.2%})")