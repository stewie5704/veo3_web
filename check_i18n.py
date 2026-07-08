import json

with open('frontend/src/locales/vi.json', 'r', encoding='utf-8') as f:
    vi = json.load(f)

with open('frontend/src/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

vi_keys = set(vi.keys())
en_keys = set(en.keys())

missing_in_en = vi_keys - en_keys
print(f"Total keys in vi: {len(vi_keys)}")
print(f"Total keys in en: {len(en_keys)}")
print(f"Missing in en: {len(missing_in_en)}")
print(f"Sample missing keys: {list(missing_in_en)[:20]}")
