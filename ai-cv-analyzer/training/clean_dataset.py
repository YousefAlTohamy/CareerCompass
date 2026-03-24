import json

input_file = 'train_real_tech.json'
output_file = 'train_real_tech_cleaned.json'

unique_lines = set()
duplicates_count = 0
invalid_count = 0

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        line_str = line.strip()
        if not line_str:
            continue
            
        # 1. فحص التكرار (Exact Duplicates)
        if line_str in unique_lines:
            duplicates_count += 1
            continue
            
        # 2. فحص جودة واكتمال البيانات (Data Validation)
        try:
            data = json.loads(line_str)
            
            # التأكد من وجود المفاتيح المطلوبة
            if "tokens" not in data or "ner_tags" not in data:
                invalid_count += 1
                continue
            
            tokens = data["tokens"]
            tags = data["ner_tags"]
            
            # التأكد أن القوائم ليست فارغة
            if not isinstance(tokens, list) or not isinstance(tags, list) or len(tokens) == 0:
                invalid_count += 1
                continue
                
            # الشرط الأهم للـ NER: تطابق عدد الكلمات مع عدد الـ Tags
            if len(tokens) != len(tags):
                invalid_count += 1
                continue
                
            # التأكد أن جميع الـ tags هي أرقام صحيحة ضمن النطاق (0 إلى 10 كما حددت في الـ Prompt)
            if not all(isinstance(t, int) and 0 <= t <= 10 for t in tags):
                invalid_count += 1
                continue
                
            # إذا اجتازت العينة جميع الفحوصات، يتم إضافتها
            unique_lines.add(line_str)
            
        except json.JSONDecodeError:
            # تخطي السطر إذا كان الـ JSON تالفاً
            invalid_count += 1
            continue

# حفظ البيانات المفلترة في الملف الجديد
with open(output_file, 'w', encoding='utf-8') as f:
    for line in unique_lines:
        f.write(line + '\n')

print(f"🔍 Total lines processed: {len(unique_lines) + duplicates_count + invalid_count}")
print(f"🗑️ Duplicates found and removed: {duplicates_count}")
print(f"⚠️ Invalid or corrupted lines removed: {invalid_count}")
print(f"✅ Clean, valid, and unique lines saved to {output_file}: {len(unique_lines)}")