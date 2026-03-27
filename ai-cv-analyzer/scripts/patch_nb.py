import json

notebook_path = "d:/Graduation/Graduation-project/ai-cv-analyzer/training/train_ner.ipynb"

with open(notebook_path, "r", encoding="utf-8") as f:
    nb = json.load(f)

# Update Tokenization cell (index 6, assuming structure matches)
tok_cell = next(c for c in nb["cells"] if "from transformers import AutoTokenizer" in "".join(c["source"]))
tok_cell["source"] = [
    "from transformers import AutoTokenizer\n",
    "\n",
    "model_checkpoint = \"bert-base-cased\"\n",
    "tokenizer = AutoTokenizer.from_pretrained(model_checkpoint)\n",
    "\n",
    "def tokenize_and_align_labels(examples):\n",
    "    tokenized_inputs = tokenizer(\n",
    "        examples[\"text\"], \n",
    "        truncation=True, \n",
    "        max_length=512,\n",
    "        return_offsets_mapping=True\n",
    "    )\n",
    "\n",
    "    labels = []\n",
    "    for i, entity_list in enumerate(examples[\"entities\"]):\n",
    "        word_ids = tokenized_inputs.word_ids(batch_index=i)\n",
    "        offsets = tokenized_inputs[\"offset_mapping\"][i]\n",
    "        label_ids = [0] * len(word_ids)\n",  # default to O
    "\n",
    "        seen_chars = set()\n",
    "        for ent in entity_list:\n",
    "            ent_text = ent[\"text\"]\n",
    "            ent_label = ent[\"label\"]\n",
    "            start_char = examples[\"text\"][i].find(ent_text)\n",
    "            if start_char == -1: continue\n",
    "            end_char = start_char + len(ent_text)\n",
    "            \n",
    "            b_label = label2id.get(f\"B-{ent_label}\", 0)\n",
    "            i_label = label2id.get(f\"I-{ent_label}\", 0)\n",
    "            \n",
    "            first = True\n",
    "            for idx, (tok_start, tok_end) in enumerate(offsets):\n",
    "                if tok_start == tok_end: continue # special token\n",
    "                if tok_start >= start_char and tok_end <= end_char:\n",
    "                    if first:\n",
    "                        label_ids[idx] = b_label\n",
    "                        first = False\n",
    "                    else:\n",
    "                        label_ids[idx] = i_label\n",
    "                    seen_chars.add(idx)\n",
    "\n",
    "        for idx, wid in enumerate(word_ids):\n",
    "            if wid is None:\n",
    "                label_ids[idx] = -100\n",
    "\n",
    "        labels.append(label_ids)\n",
    "    tokenized_inputs.pop(\"offset_mapping\")\n",
    "    tokenized_inputs[\"labels\"] = labels\n",
    "    return tokenized_inputs\n",
    "\n",
    "tokenized_datasets = dataset.map(tokenize_and_align_labels, batched=True)\n",
    "print(\"✅ Tokenization and Offset Mapping Complete!\")\n"
]

# Update Training Arguments cell
train_cell = next(c for c in nb["cells"] if "TrainingArguments" in "".join(c["source"]))
train_cell["source"] = [
    "from transformers import TrainingArguments, Trainer, EarlyStoppingCallback\n",
    "\n",
    "training_args = TrainingArguments(\n",
    "    output_dir=\"./results\",\n",
    "    eval_strategy=\"steps\",\n",
    "    eval_steps=1000,\n",
    "    learning_rate=2e-5,\n",
    "    per_device_train_batch_size=16,\n",
    "    per_device_eval_batch_size=16,\n",
    "    num_train_epochs=3,\n",
    "    weight_decay=0.01,\n",
    "    save_strategy=\"steps\",\n",
    "    save_steps=1000,\n",
    "    load_best_model_at_end=True,\n",
    "    fp16=True,\n",
    "    metric_for_best_model=\"f1\"\n",
    ")\n",
    "\n",
    "trainer = Trainer(\n",
    "    model=model,\n",
    "    args=training_args,\n",
    "    train_dataset=tokenized_datasets[\"train\"],\n",
    "    eval_dataset=tokenized_datasets[\"test\"],\n",
    "    processing_class=tokenizer,  \n",
    "    data_collator=data_collator,\n",
    "    compute_metrics=compute_metrics,\n",
    "    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]\n",
    ")\n"
]

with open(notebook_path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1)

print("Notebook patched successfully!")
