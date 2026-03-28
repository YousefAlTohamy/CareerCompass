import json

with open("training/train_ner.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

# Update Step 5: TrainingArgs
# Find the cell that starts with from transformers import TrainingArguments
for cell in nb["cells"]:
    if cell["cell_type"] == "code" and "TrainingArguments" in "".join(cell["source"]):
        source = cell["source"]
        new_source = []
        for line in source:
            if "eval_strategy=" in line or "evaluation_strategy=" in line:
                new_source.append('    evaluation_strategy="epoch",\n')
            elif "eval_steps=" in line:
                continue # remove eval_steps
            elif "save_strategy=" in line:
                new_source.append('    save_strategy="epoch",\n')
            elif "save_steps=" in line:
                continue # remove save_steps
            else:
                new_source.append(line)
        cell["source"] = new_source

# Inject the Verification cell just before Step 4 (after Step 3 tokenization mapping)
verification_source = [
    "print(\"\\n--- Verification: Checking Token-Label Alignment ---\")\n",
    "sample = tokenized_datasets[\"train\"][0]\n",
    "tokens = tokenizer.convert_ids_to_tokens(sample[\"input_ids\"])\n",
    "print(f\"\\nSample Text:\\n{dataset['train'][0]['text']}\\n\")\n",
    "print(f\"{'-'*30}\")\n",
    "print(f\"{'Token':<20} | {'Label':<15}\")\n",
    "print(f\"{'-'*30}\")\n",
    "for tok, lbl_id in zip(tokens, sample[\"labels\"]):\n",
    "    if lbl_id == -100:\n",
    "        label_str = 'IGNORED (-100)'\n",
    "    else:\n",
    "        label_str = id2label[lbl_id]\n",
    "    if tok not in ['[PAD]', '[CLS]', '[SEP]'] or lbl_id != -100:\n",
    "        print(f\"{tok:<20} | {label_str:<15}\")\n"
]

verify_cell = {
    "cell_type": "code",
    "execution_count": None,
    "metadata": {},
    "outputs": [],
    "source": verification_source
}

# Find index to insert
insert_idx = 0
for i, cell in enumerate(nb["cells"]):
    if cell["cell_type"] == "markdown" and "Step 4: Model Initialization" in "".join(cell["source"]):
        insert_idx = i
        break

if insert_idx > 0:
    nb["cells"].insert(insert_idx, verify_cell)

with open("training/train_ner.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)
    # Append a newline manually to keep git happy if needed
    f.write("\n")
print("Notebook patched successfully!")
