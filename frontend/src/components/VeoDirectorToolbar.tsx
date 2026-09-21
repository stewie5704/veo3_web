import { useState } from 'react'
import { Sparkles, Video, Aperture, Sun, Wind, Check, Loader2 } from 'lucide-react'
import { toolsApi } from '../api/client'
import { useT } from '../i18n'
import './VeoDirectorToolbar.css'

interface VeoDirectorToolbarProps {
  prompt: string
  onUpdatePrompt: (newPrompt: string) => void
  aspectRatio?: string
  style?: string
  compact?: boolean
}

// Cú máy điện ảnh (Camera Movements from Snubroot)
const CAMERA_PRESETS = [
  { id: 'pov', label: '👀 POV Thứ Nhất', text: "first-person POV perspective from the viewer's direct eye-level, hands visible in foreground" },
  { id: 'dolly_in', label: '🎬 Dolly In', text: 'slow dolly-in push toward subject' },
  { id: 'low_angle', label: '📐 Góc thấp (Hero)', text: 'low-angle tracking shot moving forward at waist height' },
  { id: 'orbit', label: '🔄 Orbit 360°', text: 'smooth 360-degree orbital arc shot around the subject' },
  { id: 'handheld', label: '📱 Quay tay (UGC)', text: 'handheld camera with subtle realistic organic shake' },
  { id: 'fpv_drone', label: '🦅 FPV Drone', text: 'dynamic FPV drone dive and swoop through the scene' },
  { id: 'static', label: '🔒 Cố định (Tripod)', text: 'cinematic static locked-off tripod shot' },
]

// Ống kính & Xóa phông (Lens & Bokeh)
const LENS_PRESETS = [
  { id: '50mm', label: '50mm f/1.4 Bokeh', text: '50mm prime lens at f/1.4 with creamy shallow depth of field' },
  { id: '35mm', label: '35mm Anamorphic', text: '35mm anamorphic lens with subtle horizontal blue lens flares' },
  { id: '85mm', label: '85mm Portrait', text: '85mm portrait lens with hyper-sharp subject separation' },
  { id: '24mm', label: '24mm Wide Angle', text: '24mm wide-angle lens with deep focus and wide perspective' },
  { id: 'macro', label: 'Macro 100mm (Chi tiết)', text: '100mm macro lens revealing extreme fine textures' },
]

// Ánh sáng & Màu sắc (Lighting)
const LIGHTING_PRESETS = [
  { id: 'golden_hour', label: '🌅 Golden Hour 3200K', text: 'warm golden hour sunlight at 3200K from low angle' },
  { id: 'cyberpunk', label: '🌆 Cyberpunk Neon', text: 'cyberpunk teal and magenta neon rim lighting with reflections' },
  { id: 'noir', label: '🕵️ Noir Chiaroscuro', text: 'high-contrast chiaroscuro lighting with deep shadows' },
  { id: 'soft_window', label: '🪟 Ánh sáng cửa sổ', text: 'diffused window daylight at 5600K with soft falloff' },
  { id: 'god_rays', label: '✨ Tia sáng (God Rays)', text: 'volumetric atmospheric god rays streaming through dust motes' },
]

// Hiệu ứng môi trường & Vật lý (Physics Anchors)
const ATMOS_PRESETS = [
  { id: 'rain', label: '🌧️ Mưa loang nước', text: 'rain-slicked glossy pavement reflecting ambient lights' },
  { id: 'dust', label: '💨 Hạt bụi trong nắng', text: 'fine dust motes drifting lazily through a beam of light' },
  { id: 'wind', label: '🍃 Gió thổi bay tóc', text: 'gentle gust of wind rustling loose fabric and hair' },
  { id: 'steam', label: '☕ Hơi khói bốc', text: 'delicate wisps of steam curling upward in cool air' },
]

export default function VeoDirectorToolbar({
  prompt,
  onUpdatePrompt,
  aspectRatio = '16:9',
  style = '',
  compact = false,
}: VeoDirectorToolbarProps) {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [selectedCam, setSelectedCam] = useState('')
  const [selectedLens, setSelectedLens] = useState('')
  const [selectedLight, setSelectedLight] = useState('')
  const [selectedAtmos, setSelectedAtmos] = useState('')

  // 1-Click Magic Prompt Enhancer
  const handleEnhance = async () => {
    if (!prompt.trim()) {
      setStatusMsg(t('veo_flow.enter_prompt_first') || 'Nhập ý tưởng trước khi bấm tối ưu!')
      setTimeout(() => setStatusMsg(''), 3000)
      return
    }

    setLoading(true)
    setStatusMsg('')
    try {
      const res = await toolsApi.enhancePrompt({
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        camera_move: selectedCam ? CAMERA_PRESETS.find(p => p.id === selectedCam)?.text : undefined,
        lens: selectedLens ? LENS_PRESETS.find(p => p.id === selectedLens)?.text : undefined,
        lighting: selectedLight ? LIGHTING_PRESETS.find(p => p.id === selectedLight)?.text : undefined,
        atmos: selectedAtmos ? ATMOS_PRESETS.find(p => p.id === selectedAtmos)?.text : undefined,
        style: style || undefined,
      })

      if (res && res.enhanced_prompt) {
        onUpdatePrompt(res.enhanced_prompt)
        setStatusMsg('✨ ' + (t('veo_flow.enhanced_success') || 'Đã chuẩn hoá theo chuẩn Veo 3 Flow!'))
        setTimeout(() => setStatusMsg(''), 4000)
      }
    } catch (err: any) {
      console.error('Enhance prompt failed:', err)
      setStatusMsg('⚠️ ' + (err.response?.data?.detail || 'Lỗi khi tối ưu prompt'))
      setTimeout(() => setStatusMsg(''), 4000)
    } finally {
      setLoading(false)
    }
  }

  // Toggle hoặc chèn trực tiếp chip preset
  const handleChipClick = (
    type: 'cam' | 'lens' | 'light' | 'atmos',
    presetId: string,
    presetText: string
  ) => {
    if (type === 'cam') {
      const isAct = selectedCam === presetId
      setSelectedCam(isAct ? '' : presetId)
      if (!isAct && !prompt.includes(presetText)) {
        onUpdatePrompt(prompt ? `${prompt}, ${presetText}` : presetText)
      }
    } else if (type === 'lens') {
      const isAct = selectedLens === presetId
      setSelectedLens(isAct ? '' : presetId)
      if (!isAct && !prompt.includes(presetText)) {
        onUpdatePrompt(prompt ? `${prompt}, ${presetText}` : presetText)
      }
    } else if (type === 'light') {
      const isAct = selectedLight === presetId
      setSelectedLight(isAct ? '' : presetId)
      if (!isAct && !prompt.includes(presetText)) {
        onUpdatePrompt(prompt ? `${prompt}, ${presetText}` : presetText)
      }
    } else if (type === 'atmos') {
      const isAct = selectedAtmos === presetId
      setSelectedAtmos(isAct ? '' : presetId)
      if (!isAct && !prompt.includes(presetText)) {
        onUpdatePrompt(prompt ? `${prompt}, ${presetText}` : presetText)
      }
    }
  }

  return (
    <div className={`veo-toolbar ${compact ? 'compact' : ''}`}>
      <div className="veo-toolbar-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="veo-badge">
            <Sparkles size={13} />
            Veo 3 Flow Director
          </span>
          {statusMsg && <span className="veo-status-msg">{statusMsg}</span>}
        </div>

        <button
          type="button"
          className="veo-magic-btn"
          onClick={handleEnhance}
          disabled={loading || !prompt.trim()}
          title={t('veo_flow.magic_btn_tooltip') || 'Dùng AI đạo diễn phân tích và biến ý tưởng ngắn thành Prompt Veo 3 chuẩn Hollywood 5 thành phần'}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="spinner" />
              <span>Đang tối ưu Veo 3 Flow...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>🪄 Tối ưu Veo 3 Flow</span>
            </>
          )}
        </button>
      </div>

      <div className="veo-presets-row">
        {/* Nhóm Cú máy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <span className="veo-group-label"><Video size={12} /> Cú máy:</span>
          <div className="veo-chips">
            {CAMERA_PRESETS.slice(0, compact ? 3 : 5).map(p => (
              <button
                key={p.id}
                type="button"
                className={`veo-chip ${selectedCam === p.id ? 'active' : ''}`}
                onClick={() => handleChipClick('cam', p.id, p.text)}
                title={p.text}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nhóm Ống kính */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <span className="veo-group-label"><Aperture size={12} /> Lens:</span>
          <div className="veo-chips">
            {LENS_PRESETS.slice(0, compact ? 2 : 4).map(p => (
              <button
                key={p.id}
                type="button"
                className={`veo-chip ${selectedLens === p.id ? 'active' : ''}`}
                onClick={() => handleChipClick('lens', p.id, p.text)}
                title={p.text}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nhóm Ánh sáng */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <span className="veo-group-label"><Sun size={12} /> Ánh sáng:</span>
          <div className="veo-chips">
            {LIGHTING_PRESETS.slice(0, compact ? 2 : 3).map(p => (
              <button
                key={p.id}
                type="button"
                className={`veo-chip ${selectedLight === p.id ? 'active' : ''}`}
                onClick={() => handleChipClick('light', p.id, p.text)}
                title={p.text}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nhóm Vật lý / Khí quyển */}
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="veo-group-label"><Wind size={12} /> Vật lý:</span>
            <div className="veo-chips">
              {ATMOS_PRESETS.slice(0, 3).map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`veo-chip ${selectedAtmos === p.id ? 'active' : ''}`}
                  onClick={() => handleChipClick('atmos', p.id, p.text)}
                  title={p.text}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
