import re
import codecs

# Đọc file với utf-8, loại bỏ BOM nếu có
with codecs.open("frontend/src/pages/Projects.tsx", "r", encoding="utf-8-sig") as f:
    content = f.read()

# 1. Add step state
if "const [step, setStep]" not in content:
    content = re.sub(
        r"const \[error, setError\] = useState\(''\)",
        r"const [error, setError] = useState('')\n  const [step, setStep] = useState<'setup' | 'review'>('setup')",
        content
    )

# 2. Add directCreate to genPrompts
content = re.sub(
    r"async function genPrompts\(\) {",
    r"async function genPrompts(directCreate = true) {",
    content
)
content = re.sub(
    r"(pushLog\(`Đã viết kịch bản \${n} cảnh`\)\s+)const cost = (modelObjNew\.cost \* n\s+if \(cost > 0 && !window\.confirm\(`Tạo \${n} cảnh — tốn khoảng \${cost} 💎\. Tiếp tục\?`\)\) \{ setLoadingPrompts\(false\); return \}\s+await createNew\(true, \{ scenes: res\.scenes \|\| \[\], prompts: res\.prompts \|\| \[\], narrations: res\.narrations \|\| \[\], bible: bc, charVoices: cv \}\))",
    r"\1if (directCreate) {\n        const cost = \2\n      } else {\n        setStep('review')\n        setLoadingPrompts(false)\n      }",
    content
)

# 3. Add directCreate to parseScript
content = re.sub(
    r"async function parseScript\(\) {",
    r"async function parseScript(directCreate = true) {",
    content
)
content = re.sub(
    r"(pushLog\(`Đã phân tích kịch bản \${n} cảnh`\)\s+)const cost = (modelObjNew\.cost \* n\s+if \(cost > 0 && !window\.confirm\(`Tạo \${n} cảnh — tốn khoảng \${cost} 💎\. Tiếp tục\?`\)\) \{ setLoadingPrompts\(false\); return \}\s+await createNew\(true, \{ scenes: res\.scenes \|\| \[\], prompts: res\.prompts \|\| \[\], narrations: res\.narrations \|\| \[\], bible: bc, charVoices: cv \}\))",
    r"\1if (directCreate) {\n        const cost = \2\n      } else {\n        setStep('review')\n        setLoadingPrompts(false)\n      }",
    content
)

# 4. Add directCreate to parsePromptsLocally
content = re.sub(
    r"async function parsePromptsLocally\(\) {",
    r"async function parsePromptsLocally(directCreate = true) {",
    content
)
content = re.sub(
    r"(pushLog\(`Đã đọc \${n} prompts`\)\s+)const cost = (modelObjNew\.cost \* n\s+if \(cost > 0 && !window\.confirm\(`Tạo \${n} cảnh — tốn khoảng \${cost} 💎\. Tiếp tục\?`\)\) \{ return \}\s+await createNew\(true, \{ scenes: \[\], prompts: lines, narrations: new Array\(n\)\.fill\(''\), bible: \[\], charVoices: \{\} \}\))",
    r"\1if (directCreate) {\n        const cost = \2\n      } else {\n        setPrompts(lines)\n        setNarrations(new Array(n).fill(''))\n        setScenes([])\n        setStep('review')\n      }",
    content
)

# 5. Add directCreate to readStoryboard
content = re.sub(
    r"async function readStoryboard\(\) {",
    r"async function readStoryboard(directCreate = true) {",
    content
)
content = re.sub(
    r"(if \(!n\) \{ setError\('Không đọc được khung nào từ storyboard — thử ảnh rõ hơn\.'\); setLoadingPrompts\(false\); return \}\s+)const cost = (modelObjNew\.cost \* n\s+if \(cost > 0 && !window\.confirm\(`Tạo \${n} cảnh — tốn khoảng \${cost} 💎\. Tiếp tục\?`\)\) \{ setLoadingPrompts\(false\); return \}\s+await createNew\(true, \{ scenes: res\.scenes \|\| \[\], prompts: res\.prompts \|\| \[\], narrations: res\.narrations \|\| \[\], bible: bc, charVoices: cv \}\))",
    r"\1if (directCreate) {\n        const cost = \2\n      } else {\n        setStep('review')\n        setLoadingPrompts(false)\n      }",
    content
)

# 6. Add review ui components to the render block
if "{/* ─── BƯỚC 1: THIẾT LẬP ─── */}\n          {step === 'setup' && (<>" not in content:
    content = content.replace(
        r"{/* ─── BƯỚC 1: THIẾT LẬP ─── */}",
        "{/* ─── BƯỚC 1: THIẾT LẬP ─── */}\n          {step === 'setup' && (<>"
    )

# Replace the action bar
old_action_bar = """            <div className="cmp-actionbar">
              <div className="cmp-est">
                <span className="big">~{fmtLen(setupLenSec)}</span>
                <span className="meta">· {sceneCount}×{duration}s ·</span>
                <span className={modelObjNew.cost === 0 ? 'free' : ''}>{modelObjNew.cost === 0 ? 'FREE' : `${modelObjNew.cost * sceneCount} 💎`}</span>
              </div>
              <div style={{ flex: 1 }} />
              <button className="cmp-cta"
                onClick={() => {
                  if (mode === 'storyboard') readStoryboard()
                  else if (mode === 'manual') parseScript()
                  else if (mode === 'prompts') parsePromptsLocally()
                  else genPrompts()
                }}
                disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                {loadingPrompts || creating
                  ? <><Loader2 size={14} className="spin" /> {mode === 'storyboard' ? 'Đang đọc storyboard...' : mode === 'manual' ? 'Đang phân tích & tạo...' : 'Đang tạo...'}</>
                  : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {mode === 'storyboard' ? 'Đọc storyboard & tạo phim →' : mode === 'manual' ? 'Phân tích & tạo phim →' : mode === 'prompts' ? 'Tạo phim từ Prompts →' : 'AI viết & tạo phim →'}</>}
              </button>
            </div>"""

new_action_bar = """            <div className="cmp-actionbar">
              <div className="cmp-est">
                <span className="big">~{fmtLen(setupLenSec)}</span>
                <span className="meta">· {sceneCount}×{duration}s ·</span>
                <span className={modelObjNew.cost === 0 ? 'free' : ''}>{modelObjNew.cost === 0 ? 'FREE' : `${modelObjNew.cost * sceneCount} 💎`}</span>
              </div>
              <div style={{ flex: 1 }} />
              
              {mode !== 'prompts' && (
                <button className="cmp-ghost" style={{ marginRight: 8 }}
                  onClick={() => {
                    if (mode === 'storyboard') readStoryboard(false)
                    else if (mode === 'manual') parseScript(false)
                    else genPrompts(false)
                  }}
                  disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                  Kiểm tra kịch bản chi tiết
                </button>
              )}

              <button className="cmp-cta"
                onClick={() => {
                  if (mode === 'storyboard') readStoryboard(true)
                  else if (mode === 'manual') parseScript(true)
                  else if (mode === 'prompts') parsePromptsLocally(true)
                  else genPrompts(true)
                }}
                disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                {loadingPrompts || creating
                  ? <><Loader2 size={14} className="spin" /> {mode === 'storyboard' ? 'Đang đọc storyboard...' : mode === 'manual' ? 'Đang phân tích & tạo...' : 'Đang tạo...'}</>
                  : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {mode === 'storyboard' ? 'Đọc storyboard & tạo phim →' : mode === 'manual' ? 'Phân tích & tạo phim →' : mode === 'prompts' ? 'Tạo phim từ Prompts →' : 'AI viết & tạo phim →'}</>}
              </button>
            </div>
          </>)}"""

content = content.replace(old_action_bar, new_action_bar)

# 7. Add Review UI from old2_utf8.tsx
if "{/* ─── BƯỚC 2: DUYỆT KỊCH BẢN ─── */}" not in content:
    with codecs.open("old2_utf8.tsx", "r", encoding="utf-8-sig") as f2:
        old_content = f2.read()

    review_start = "{/* ─── BƯỚC 2: DUYỆT KỊCH BẢN ─── */}"
    review_end = "          </>)}\n        </div>\n      )}\n\n      {/* TỪ PROMPT"

    start_idx = old_content.find(review_start)
    end_idx = old_content.find(review_end) + len("          </>)}")
    if start_idx != -1 and end_idx != -1:
        review_ui = old_content[start_idx:end_idx]

        # insert it after the setup block
        content = content.replace(
            "          </>)}\n        </div>\n      )}\n\n      {/* TỪ PROMPT",
            "          </>)}\n\n          " + review_ui + "\n        </div>\n      )}\n\n      {/* TỪ PROMPT"
        )
        
        # In the review UI, the "Save Draft" button triggers createNew(false)
        # We need to make sure the "🚀 Tạo & Ghép video" button triggers createNew(true)
        # Wait, the code in review_ui already has `createNew(true)`.

with codecs.open("frontend/src/pages/Projects.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done patching Projects.tsx")
