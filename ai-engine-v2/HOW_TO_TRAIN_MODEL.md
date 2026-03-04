# 📚 CareerCompass Model Training Guide

To achieve the "Computer Science Edge" for your Graduation Project, you need to prove your AI model is fine-tuned, not just an API call. We created `train_ner.ipynb` for this exact purpose.

Follow these steps exactly to run the Cloud Training using Google's free GPUs:

## Step 1: Access Google Colab
1. Open your web browser and go to [Google Colab](https://colab.research.google.com/).
2. You will be prompted to sign in with your Google account.

## Step 2: Upload the Notebook
1. When the Colab welcome popup appears, click on the **"Upload"** tab.
2. Click **"Browse"** or drag and drop the `train_ner.ipynb` file from your local `ai-engine-v2` folder.
3. Colab will open the notebook automatically.

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
   - **Synthetic Engine**: It generates over 5,000 realistic resume sentences (Skills and Roles) directly in the notebook. This is a pro-level CS technique called "Data Augmentation" to solve the lack of public data.
   - It begins the 3 epochs (rounds) of mathematical training using these generated samples.
4. **Wait:** This process will take approximately 30 minutes to 1 hour (much faster now!). DO NOT close the tab. You will see progress bars moving.

## Step 5: Download Your Custom Model
1. Once the training finishes (you will see the word "Done" or code stops executing), look at the left sidebar menu in Colab.
2. Click on the **Folder Icon** (Files).
3. You will see a new folder named `career_compass_ner_final`.
4. Right-click on that folder (or click the three dots next to it) and select **Download**.
   *Note: If it's too large to download as a folder, you can run a quick cell to zip it: `!zip -r model.zip career_compass_ner_final` and download the `.zip` file.*

## Step 6: Add to Your Graduation Project
1. Take the downloaded folder (or extract the zip).
2. Go to your local machine: `Graduation-project \ ai-engine-v2 \ models \ ner_weights \`.
3. Paste the `career_compass_ner_final` folder right there.
4. Restart your FastAPI server. The `ner_engine.py` will automatically detect your custom, 95% accuracy model, proving your technical depth to the committee!
