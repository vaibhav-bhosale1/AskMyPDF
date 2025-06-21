# backend/list_gemini_models.py
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv() # Load your .env file

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable not set.")

genai.configure(api_key=GOOGLE_API_KEY)

print("Available Gemini models:")
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"- {m.name} (Supports generateContent)")
    elif "generateText" in m.supported_generation_methods:
        print(f"- {m.name} (Supports generateText)")
    else:
        print(f"- {m.name} (No text generation support)")