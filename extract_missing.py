import json
import urllib.request

with open('frontend/src/locales/vi.json', 'r', encoding='utf-8') as f:
    vi = json.load(f)

with open('frontend/src/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

missing = {k: v for k, v in vi.items() if k not in en}

print("We have 124 missing keys. Writing them to a file missing.json so I can translate them.")

with open('missing.json', 'w', encoding='utf-8') as f:
    json.dump(missing, f, indent=2, ensure_ascii=False)
