import json
import re
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
greedy_entities_removed = 0
negative_samples_count = 0
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

                # الفحص الأساسي: التأكد من وجود النص والكيانات
                if 'text' in data and 'entities' in data and isinstance(data['entities'], list):

                    # ===== Whitespace Normalization (Aggressive) =====
                    # استبدال أي مسافة مخفية أو أكثر من مسافة واحدة بمسافة واحدة
                    text = data['text']
                    text = re.sub(r'[^\S\n]+', ' ', text)   # collapse multiple spaces/tabs/hidden chars
                    text = re.sub(r'\n{2,}', '\n', text)    # collapse multiple newlines
                    text = text.strip()

                    if not text:
                        invalid_count += 1
                        continue

                    # فحص التكرار بناءً على النص
                    if text in unique_texts:
                        duplicates_count += 1
                        continue

                    # ===== Handle Negative Samples (empty entities list) =====
                    # الـ Negative Samples صحيحة تماماً لو entities فاضية — لازم نحتفظ بيها
                    if len(data['entities']) == 0:
                        data['text'] = text
                        cleaned_data.append(data)
                        unique_texts.add(text)
                        negative_samples_count += 1
                        continue

                    # ===== Validate & Filter Entities for Positive Samples =====
                    valid_entities = []
                    for ent in data['entities']:
                        if 'text' not in ent or 'label' not in ent:
                            continue

                        ent_text = ent['text'].strip()
                        ent_label = ent['label']

                        # Rule 1: Entity text must exist in the sentence
                        if ent_text not in text:
                            continue

                        # Rule 2: SKILL entities must NOT exceed 3 words (prevents greedy merging)
                        if ent_label == 'SKILL':
                            word_count = len(ent_text.split())
                            if word_count > 3:
                                greedy_entities_removed += 1
                                continue  # Discard this entity only, keep the sentence

                        valid_entities.append(ent)

                    # Keep the sample if it has at least one valid entity
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
    print(f"♻️  Duplicates removed: {duplicates_count}")
    print(f"🎯 Negative (Decoy) samples preserved: {negative_samples_count}")
    print(f"✂️  Greedy SKILL entities removed (>3 words): {greedy_entities_removed}")
    print(f"⚠️  Invalid or corrupted lines skipped: {invalid_count}")
    print(f"💾 Cleaned samples saved to {output_file}: {len(cleaned_data)}")

except FileNotFoundError:
    print(f"❌ Error: Could not find {input_file}")