import requests
import sys
import json

def test_cv_analysis(file_path):
    url = "http://127.0.0.1:8002/api/v2/analyze-cv"
    
    print(f"🚀 Sending '{file_path}' to AI Engine v2...")
    
    try:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, files=files)
            
        if response.status_code == 200:
            result = response.json()
            print("\n✅ Analysis Successful!\n")
            print("="*50)
            print(f"📄 Filename: {result['metadata']['filename']}")
            print(f"🔍 method: {result['metadata']['extraction_method']}")
            print("-" * 50)
            print(f"🛠️ Layer 1 (NER Skills): {', '.join(result['layer1_understanding']['skills'][:10])}...")
            print(f"💼 Layer 1 (NER Roles): {', '.join(result['layer1_understanding']['roles'][:5])}...")
            print("-" * 50)
            print(f"🌐 Layer 2 (Domain): {result['layer2_classification']['primary_domain']}")
            print("="*50)
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            
    except FileNotFoundError:
        print(f"❌ Error: File '{file_path}' not found.")
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_cv.py <path_to_cv_file>")
    else:
        test_cv_analysis(sys.argv[1])
