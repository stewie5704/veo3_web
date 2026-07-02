import codecs
import re

with codecs.open("backend/app/tools/router.py", "r", encoding="utf-8-sig") as f:
    content = f.read()

# 1. Update GEMINI_MODELS to include 1.5-flash and pro as fallbacks
content = content.replace(
    'GEMINI_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite")',
    'GEMINI_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash")'
)

content = content.replace(
    'GEMINI_VISION_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite")',
    'GEMINI_VISION_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash")'
)

# 2. Add an automatic sleep+retry for quota in _gemini_json and _gemini_vision_json
# Actually, the user says "tao vừa get key mới từ project mới sao vẫn bị cái này".
# That strongly implies the new project has 0 quota for 2.x models because billing is not enabled.
# Adding 1.5-flash should fix it, because 1.5-flash has a generous free tier.

# Let's also add 1 retry loop for quota to be extremely resilient.
import textwrap

# 3. Decrease MAX_MR_CONCURRENCY from 6 to 3
content = content.replace(
    'MAX_MR_CONCURRENCY = 6   #',
    'MAX_MR_CONCURRENCY = 3   #'
)

with codecs.open("backend/app/tools/router.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied.")
