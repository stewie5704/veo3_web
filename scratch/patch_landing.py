import codecs
import re

with codecs.open("frontend/src/pages/Landing.tsx", "r", encoding="utf-8-sig") as f:
    content = f.read()

# Normalize newlines
content = content.replace("\r\n", "\n")

# Use regex to find SAMPLES and CAPABILITIES
samples_match = re.search(r'(        \{/\* SAMPLES \*/\}.*?        </section>\n)', content, re.DOTALL)
if samples_match:
    samples_section = samples_match.group(1)
    content = content.replace(samples_section, "")
else:
    print("SAMPLES section not found.")

caps_match = re.search(r'(        \{/\* CAPABILITIES \+ STATS \*/\}.*?        </div>\n)', content, re.DOTALL)
if caps_match:
    # Need to match the entire CAPABILITIES div, which has 2 nested divs (capstrip, statstrip) inside caps-wrap.
    # The end of caps-wrap is a bit tricky, let's just match up to the end of the reveal div
    caps_section_full = re.search(r'(        \{/\* CAPABILITIES \+ STATS \*/\}.*?          </div>\n        </div>\n)', content, re.DOTALL)
    if caps_section_full:
        caps_section = caps_section_full.group(1)
        if samples_match:
            content = content.replace(caps_section, samples_section)
    else:
        print("CAPABILITIES section end not found properly.")
else:
    print("CAPABILITIES section not found.")

# Remove variables
content = re.sub(r'// Spark icon.*?const Spark = \(\) => \([^)]+\)\n', '', content, flags=re.DOTALL)
content = re.sub(r'// Capabilities under hero\nconst CAPABILITIES = \[.*?\n\]\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'// Numbers strip\nconst STATS = \[.*?\n\]\n\n', '', content, flags=re.DOTALL)

with codecs.open("frontend/src/pages/Landing.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Landing.tsx successfully patched with regex.")
