import json
import os

input_file = 'training/train_real_tech.json'
output_file = 'training/train_real_tech_cleaned.json'

# اتأكد إن المسارات صحيحة بناءً على مكان تشغيل السكريبت
if not os.path.exists(input_file):
    # تجربة المسار المباشر لو شغال من جوه فولدر training
    input_file = 'train_real_tech.json'
    output_file = 'train_real_tech_cleaned.json'

unique_texts = set()
processed_count = 0
duplicates_count = 0
invalid_count = 0
cleaned_data = []

print(f"🔍 Starting cleanup for: {input_file}")

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            processed_count += 1
            try:
                data = json.loads(line)
                
                # الفحص الجديد: التأكد من وجود النص والكيانات
                if 'text' in data and 'entities' in data and isinstance(data['entities'], list):
                    
                    # تنظيف النص من المسافات الزائدة
                    text = data['text'].strip()
                    
                    # فحص التكرار بناءً على النص
                    if text in unique_texts:
                        duplicates_count += 1
                        continue
                    
                    # فحص صحة الكيانات (لازم النص بتاع المهارة يكون موجود جوه الجملة)
                    valid_entities = []
                    for ent in data['entities']:
                        if 'text' in ent and 'label' in ent:
                            if ent['text'] in text: # تأكيد إن المهارة موجودة فعلياً في النص
                                valid_entities.append(ent)
                    
                    if valid_entities:
                        data['text'] = text
                        data['entities'] = valid_entities
                        cleaned_data.append(data)
                        unique_texts.add(text)
                    else:
                        invalid_count += 1
                else:
                    invalid_count += 1
                    
            except json.JSONDecodeError:
                invalid_count += 1

    # حفظ البيانات المنظفة
    with open(output_file, 'w', encoding='utf-8') as f:
        for entry in cleaned_data:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')

    print(f"\n✅ Done!")
    print(f"📊 Total lines processed: {processed_count}")
    print(f"♻️ Duplicates removed: {duplicates_count}")
    print(f"⚠️ Invalid or corrupted lines skipped: {invalid_count}")
    print(f"💾 Cleaned samples saved to {output_file}: {len(cleaned_data)}")

except FileNotFoundError:
    print(f"❌ Error: Could not find {input_file}")