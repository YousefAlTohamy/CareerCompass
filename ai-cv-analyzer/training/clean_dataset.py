import json

input_file = 'train_real_tech.json'
output_file = 'train_real_tech_cleaned.json'

unique_lines = set()
duplicates_count = 0

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        line_str = line.strip()
        if line_str in unique_lines:
            duplicates_count += 1
        else:
            unique_lines.add(line_str)

# حفظ البيانات الصافية في ملف جديد
with open(output_file, 'w', encoding='utf-8') as f:
    for line in unique_lines:
        f.write(line + '\n')

print(f"🔍 Total lines checked: {len(unique_lines) + duplicates_count}")
print(f"🗑️ Duplicates found and removed: {duplicates_count}")
print(f"✅ Unique lines saved to {output_file}: {len(unique_lines)}")