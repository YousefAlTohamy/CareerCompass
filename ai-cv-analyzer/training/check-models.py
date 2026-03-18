import os
from dotenv import load_dotenv
from google import genai

load_dotenv(override=True)
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ API Key not found!")
    exit()

client = genai.Client(api_key=api_key)

print("🔍 Models available for YOUR specific API Key:")
try:
    # جلب جميع الموديلات المتاحة لهذا المفتاح
    models = client.models.list()
    available_models = [m.name for m in models]
    
    if not available_models:
        print("⚠️ Your API key cannot access any models. Check your AI Studio project permissions or billing status.")
    else:
        for name in available_models:
            print(f"- {name}")
            
except Exception as e:
    print(f"❌ Error fetching models: {e}")