# 📚 CareerCompass Model Training Guide

To achieve the "Computer Science Edge" for your Graduation Project, you need to prove your AI model is fine-tuned, not just an API call. We created `train_ner.ipynb` for this exact purpose.

Follow these steps exactly to run the Cloud Training using Google's free GPUs:

## Step 1: Access Google Colab
1. Open your web browser and go to [Google Colab](https://colab.research.google.com/).
2. You will be prompted to sign in with your Google account.

## Step 2: Upload Files
1. When the Colab welcome popup appears, click on the **"Upload"** tab.
2. Click **"Browse"** and upload the following two files from your local `ai-cv-analyzer` folder:
   - `train_ner.ipynb` (The notebook)
   - `train_real_tech_1000.json` (The critical training dataset)
3. Colab will open the notebook automatically. Ensure `train_real_tech_1000.json` is visible in the file sidebar.

## Step 3: Enable the Free GPU (Critical)
Training an AI Model on a CPU takes days. We must enable the Tesla T4 GPU.
1. In the top menu bar of Colab, click on **Runtime**.
2. Select **Change runtime type**.
3. Under the "Hardware accelerator" dropdown, select **T4 GPU** (or just GPU).
4. Click **Save**.

## Step 4: Run the Training Process
1. Look at the top menu bar again and click on **Runtime**.
2. Select **Run all** (or press `Ctrl+F9`).
3. Google Colab will execute the code cell by cell:
   - It installs the libraries.
   - **Data Alignment**: It loads `train_real_tech_1000.json` and prepares the 11 labels (including Soft Skills).
   - It begins the **10 epochs** of mathematical training using these generated samples.
4. **Wait:** This process will take approximately 30-45 minutes. DO NOT close the tab. You will see progress bars indicating loss and accuracy metrics.

## Step 5: Automated Export
1. Once the training reaches Epoch 10/10 and evaluation results appear, the final cell will execute.
2. **Auto-Download**: The notebook is programmed to automatically zip the folder `career_compass_ner_final` and trigger a browser download for `career_compass_ner_final.zip`.
3. If the download doesn't trigger, right-click `career_compass_ner_final.zip` in the sidebar and select **Download**.

## Step 6: Add to Your Graduation Project
1. Extract the downloaded `career_compass_ner_final.zip`.
2. Go to your local machine: `Graduation-project \ ai-cv-analyzer \ models \ ner_weights \`.
3. Paste the `career_compass_ner_final` folder right there.
4. Restart your FastAPI server on port `8002`. The NER engine (`advanced_ner.py`) will automatically detect your custom model, proving your technical depth to the committee!

### 🎯 Categories Recognized
Your model is now fine-tuned to extract:
- **SKILL**: Hard technical skills.
- **SOFT**: Interpersonal traits.
- **ROLE**: Professional titles.
- **EDU**: Educational degrees.
- **CERT**: Industry certifications.
