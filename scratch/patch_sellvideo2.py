import codecs

with codecs.open("frontend/src/components/SellVideo.tsx", "r", encoding="utf-8-sig") as f:
    content = f.read()

# Fix hasKol -> kolMatch
old_enforce_2 = """        if (hasKol && !/keep the person's face|the person from the .*reference|@kol/i.test(lower)) {"""
new_enforce_2 = """        if (kolMatch && !/keep the person's face|the person from the .*reference|@kol/i.test(lower)) {"""
content = content.replace(old_enforce_2, new_enforce_2)

with codecs.open("frontend/src/components/SellVideo.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied to SellVideo.tsx")
