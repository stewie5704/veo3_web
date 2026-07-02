import codecs

with codecs.open("frontend/src/components/SellVideo.tsx", "r", encoding="utf-8-sig") as f:
    content = f.read()

# 1. Update prodName and kolName to include stamp to avoid "Product already exists"
content = content.replace(
    "const prodName = pairs.length > 1 ? `Product_${pTag}` : 'Product'",
    "const prodName = pairs.length > 1 ? `Product_${pTag}_${stamp}` : `Product_${stamp}`"
)

content = content.replace(
    "const kolName = pairs.length > 1 ? `KOL_${pTag}` : 'KOL'",
    "const kolName = pairs.length > 1 ? `KOL_${pTag}_${stamp}` : `KOL_${stamp}`"
)

# 2. Update briefWithChars to use dynamic name
old_brief = "const briefWithChars = `${text}\\n\\nLưu ý dùng tên nhân vật và sản phẩm này trong kịch bản: ${charRefsForAI.join(', ')}. Trong prompt HÌNH ẢNH phải nhắc rõ \"the product from the @Product reference image\" và \"the person from the @KOL reference image\" (nếu có).`"
new_brief = "const briefWithChars = `${text}\\n\\nLưu ý dùng tên nhân vật và sản phẩm này trong kịch bản: ${charRefsForAI.join(', ')}. Trong prompt HÌNH ẢNH phải nhắc rõ \"the product from the ${charRefsForAI.find(c => /product/i.test(c)) || '@Product'} reference image\" và \"the person from the ${charRefsForAI.find(c => /kol/i.test(c)) || '@KOL'} reference image\" (nếu có).`"
content = content.replace(old_brief, new_brief)

# 3. Update enforceRefLocks to use dynamic names
old_enforce = """        const hasProd = charRefsForAI.some(r => /product/i.test(r))
        const hasKol = charRefsForAI.some(r => /kol/i.test(r))

        if (hasProd && !/product.*@?product|the product from the .*reference/i.test(lower)) {
          out = out.replace(/keep the product the EXACT/i, 'the exact product from the @Product reference image — keep the product the EXACT')
        }"""
new_enforce = """        const prodMatch = charRefsForAI.find(r => /product/i.test(r))
        const kolMatch = charRefsForAI.find(r => /kol/i.test(r))

        if (prodMatch && !/product.*@?product|the product from the .*reference/i.test(lower)) {
          out = out.replace(/keep the product the EXACT/i, `the exact product from the ${prodMatch} reference image — keep the product the EXACT`)
        }"""
content = content.replace(old_enforce, new_enforce)

# 4. Add cleanup in catch block
old_catch = """    } catch (e: any) {
      setError(e?.message || 'Có lỗi xảy ra (thử F5 hoặc nhập ít cảnh hơn)')
    } finally {"""
new_catch = """    } catch (e: any) {
      setError(e?.message || 'Có lỗi xảy ra (thử F5 hoặc nhập ít cảnh hơn)')
      Promise.allSettled(charsToDelete.map(cid => charactersApi.delete(cid)))
    } finally {"""
content = content.replace(old_catch, new_catch)

with codecs.open("frontend/src/components/SellVideo.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied to SellVideo.tsx")
