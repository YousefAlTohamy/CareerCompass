import json
import time
import requests
import sys
import os

LARAVEL_URL = "http://127.0.0.1:8000"
PDF_PATH = "ai-cv-analyzer/test.pdf"

def main():
    print("="*60)
    print("🚀 E2E CV Upload Debug Tracer")
    print("="*60)
    
    # Step 1: Login to get token
    print("\n[1] Authenticating as careercompassadmin@gmail.com...")
    login_start = time.time()
    try:
        login_res = requests.post(
            f"{LARAVEL_URL}/api/login",
            json={
                "email": "careercompassadmin@gmail.com",
                "password": "CareerCompassAdmin2026"
            },
            headers={"Accept": "application/json"}
        )
    except requests.exceptions.ConnectionError:
        print("❌ Failed to connect to Laravel. Is php artisan serve running on port 8000?")
        sys.exit(1)
        
    print(f"    Elapsed: {time.time() - login_start:.2f}s")
    print(f"    Status:  {login_res.status_code}")
    
    if login_res.status_code != 200:
        print("❌ Login failed. Response:")
        print(login_res.text)
        sys.exit(1)
        
    data = login_res.json()
    token = data.get("token") or (data.get("data", {})).get("token")
    if not token:
        print("❌ Failed to extract token from response.")
        print(login_res.text)
        sys.exit(1)
        
    print("✅ Authenticated successfully.")
    
    # Step 2: Upload CV
    if not os.path.exists(PDF_PATH):
        print(f"❌ Cannot find test CV at {PDF_PATH}")
        sys.exit(1)
        
    print(f"\n[2] Uploading '{PDF_PATH}' to Laravel...")
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    upload_start = time.time()
    try:
        with open(PDF_PATH, "rb") as f:
            files = {"cv": (os.path.basename(PDF_PATH), f, "application/pdf")}
            upload_res = requests.post(f"{LARAVEL_URL}/api/upload-cv", headers=headers, files=files, timeout=305)
    except requests.exceptions.Timeout:
        print(f"❌ Request timed out after 305 seconds.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Upload failed with exception: {e}")
        sys.exit(1)
        
    elapsed = time.time() - upload_start
    print(f"    Elapsed: {elapsed:.2f}s")
    print(f"    Status:  {upload_res.status_code}")
    
    print("\n[3] Response JSON:")
    try:
        print(json.dumps(upload_res.json(), indent=2))
    except json.JSONDecodeError:
        print("⚠️ Response is not valid JSON. Raw output:")
        print(upload_res.text)

if __name__ == "__main__":
    main()
