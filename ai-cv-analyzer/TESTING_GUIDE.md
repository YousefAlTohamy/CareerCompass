# 🧪 Testing Your Custom AI Engine (Guide)

Now that your "AI Brain" is trained and active, here is how you can perform a real-world test using any CV file (PDF, Image, or Word).

### Option 1: Using the Terminal (Fastest)

Open a **new** terminal (keep the one running `main.py` open) and run this command:

```bash
# Replace 'my_cv.pdf' with the actual path to your CV
curl -X POST "http://127.0.0.1:8002/api/v2/analyze-cv" -H "accept: application/json" -H "Content-Type: multipart/form-data" -F "file=@my_cv.pdf"
```

### Option 2: Using the Python Test Script (Recommended)

I have created a script called `test_cv.py` in your folder. It will format the JSON output into a readable report.

1.  Place a CV file (e.g., `test.pdf`) in the `ai-engine-v2` folder.
2.  Run:
    ```bash
    python test_cv.py test.pdf
    ```

### Option 3: Using a Web Browser (Swagger UI)

FastAPI comes with a built-in testing interface:
1.  Open your browser and go to: `http://127.0.0.1:8002/docs`
2.  Click on the **POST /api/v2/analyze-cv** button.
3.  Click **Try it out**.
4.  Choose your CV file and click **Execute**.

---

## 📈 What to look for in the results:
*   **layer1_understanding**: Check if the `skills` and `roles` match what's actually in your CV. This is where your **Custom Fine-Tuned Model** is working!
*   **layer2_classification**: See if the `primary_domain` correctly identifies your career path (e.g., *Frontend Developer*).
*   **extraction_method**: If it's an image, it should say `easyocr`. If it's a PDF, it should say `fitz`.
