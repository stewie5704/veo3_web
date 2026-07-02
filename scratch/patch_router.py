import codecs

with codecs.open("backend/app/tools/router.py", "r", encoding="utf-8-sig") as f:
    content = f.read()

old_rules = """QUY TẮC TỐI QUAN TRỌNG VỀ NGƯỜI VÀ SẢN PHẨM (ĐỒNG BỘ MẶT + SẢN PHẨM - BẮT BUỘC):
- Sử dụng CHÍNH XÁC 100% người trong ảnh tham chiếu KOL và sản phẩm trong ảnh tham chiếu Product.
- Trong prompt PHẢI nhắc rõ: "the exact product from the @Product reference image(s)" và "the person exactly as shown in the @KOL reference image(s)".
- Luôn chèn đầy đủ Product Lock: "keep the product the EXACT same item as the reference image — identical colour, material and finish, surface pattern/print, logo and on-pack text (same wording, font and placement), label, shape and proportions; NEVER recolour, restyle, relabel, resize, swap, distort, morph or regenerate it...".
- Luôn chèn KOL Lock: "Keep the person's face, hairstyle, skin tone, body proportions and clothing 100% identical to the KOL reference image in EVERY frame and angle".
- TUYỆT ĐỐI KHÔNG tả ngoại hình, giới tính, tuổi tác bằng text. KHÔNG bịa người mới."""

new_rules = """QUY TẮC TỐI QUAN TRỌNG VỀ NGƯỜI VÀ SẢN PHẨM (ĐỒNG BỘ MẶT + SẢN PHẨM):
- Dùng ĐÚNG tên nhân vật KOL và Sản phẩm đã cung cấp. TUYỆT ĐỐI KHÔNG mô tả giới tính, tuổi, khuôn mặt, tóc, vóc dáng, ngoại hình. Chỉ gọi "the person" / "they".
- BẮT BUỘC dùng TÊN ĐỘNG (có mã suffix) trong prompt hình ảnh. TUYỆT ĐỐI tuân thủ tên mà Bối cảnh cung cấp.
- Sản phẩm phải 100% giống ảnh reference: "the exact product from the {TÊN_SẢN_PHẨM_CÓ_MÃ} reference image".
- BẮT BUỘC chèn: keep the product the EXACT same item as the reference image — ... (full lock) + "Keep the person's face, hairstyle and appearance identical to the {TÊN_KOL_CÓ_MÃ} reference image in every single frame".
- KHÔNG bịa người mới, KHÔNG viết "a woman"/"a man"."""

if old_rules in content:
    content = content.replace(old_rules, new_rules)
    print("Patch applied to router.py")
else:
    print("Could not find the old rules string in router.py")

with codecs.open("backend/app/tools/router.py", "w", encoding="utf-8") as f:
    f.write(content)
