import os
import json
import urllib.request
import urllib.error

api_key = os.environ.get("GROQ_API_KEY")
if not api_key:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GROQ_API_KEY="):
                    api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                    break

models = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "openai/gpt-oss-20b",
    "groq/compound-mini",
    "groq/compound"
]

url = "https://api.groq.com/openai/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

for m in models:
    print(f"Trying model: {m}...")
    payload = {
        "model": m,
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
            data = json.loads(resp.read().decode('utf-8'))
            content = data['choices'][0]['message']['content']
            print(f"✅ SUCCESS with model {m}!")
            print(content[:200])
            break
    except urllib.error.HTTPError as e:
        print(f"❌ Model {m} HTTP Error {e.code}: {e.reason}")
    except Exception as e:
        print(f"❌ Model {m} Exception: {e}")
