import os
import json
import urllib.request

api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    # Try reading from .env
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("GROQ_API_KEY="):
                    api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                    break

print(f"GROQ_API_KEY present: {bool(api_key)}")

if api_key:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    payload = {
        "model": "groq/compound",
        "messages": [
            {"role": "system", "content": "You are a quiz generator. Output JSON format."},
            {"role": "user", "content": "Generate 1 sample question on Python Variables. Output JSON format: {\"questions\": [{\"id\":\"q1\", \"question\":\"...\", \"options\":[\"A\",\"B\",\"C\",\"D\"], \"correct\":0, \"explanation\":\"...\"}]}"}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7
    }
    
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode('utf-8')
            res_json = json.loads(data)
            content = res_json['choices'][0]['message']['content']
            print("SUCCESS! Generated content:")
            print(content)
    except Exception as e:
        print("API Error:", e)
