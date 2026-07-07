import json
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.projects.models import Project, Scene, SceneStatus
from app.projects.streaming import publish_project_event
from app.tools.router import _mr_outline, _mr_expand, _alloc_bible, _overlay_cast, _resolve_style_lock, _bible_blob, _reduce_scenes, _sanitize
from app.crypto import dec
import logging
from app.auth.models import User

log = logging.getLogger("veo3.generator")
MAX_MR_CONCURRENCY = 3

async def run_extract_outline(project_id: str, user_id: str, gemini_key_enc: str, idea: str, scene_count: int, language: str, aspect_ratio: str, parse_mode: bool, cast: list | None = None):
    """Background task: Chạy _mr_outline, lưu nhân vật vào Project và bắn event OUTLINE_READY"""
    try:
        api_key = dec(gemini_key_enc)
        idea = _sanitize(idea)
        lang_label = "tiếng Việt" if language == "vi" else "English"
        # Process cast from DB if not provided
        if cast is None:
            from app.projects.router import _project_chars
            async with AsyncSessionLocal() as db:
                chars = await _project_chars(db, project_id)
                cast = [{"name": c.name, "anchor": c.image_url} for c in chars]
                
        await publish_project_event(project_id, "LOG_UPDATE", "Đang phân tích kịch bản và trích xuất nhân vật...")
        
        # Chạy outline
        data = await asyncio.to_thread(_mr_outline, api_key, idea, scene_count, lang_label, aspect_ratio, parse_mode, cast)
        
        # Process bible
        bible, name_index = _alloc_bible(data.get("characters") or [])
        _overlay_cast(bible, name_index, cast)
        
        # Save to DB
        async with AsyncSessionLocal() as db:
            proj = await db.get(Project, project_id)
            if proj:
                proj.status = "waiting_review"
                proj.character_bible = json.dumps(list(bible.values()), ensure_ascii=False)
                # Save beats temporarily in part_scripts so we can use them in phase 2
                proj.part_scripts = json.dumps({
                    "beats": data.get("beats") or [],
                    "style_lock": data.get("style_lock", ""),
                    "suggested_style": data.get("suggested_style", "")
                }, ensure_ascii=False)
                await db.commit()
                
        await publish_project_event(project_id, "LOG_UPDATE", "Trích xuất nhân vật hoàn tất.")
        await publish_project_event(project_id, "OUTLINE_READY", {"characters": list(bible.values())})
        
    except Exception as e:
        log.exception(f"Error in extract outline for project {project_id}: {e}")
        await publish_project_event(project_id, "ERROR", str(e))
        async with AsyncSessionLocal() as db:
            proj = await db.get(Project, project_id)
            if proj:
                proj.status = "failed"
                await db.commit()


async def run_generate_scenes(project_id: str, user_id: str, gemini_key_enc: str, language: str, aspect_ratio: str, charVoices: dict[str, str] = {}):
    """Background task: Chạy _mr_expand song song, tạo Scene vào DB và bắn event liên tục"""
    try:
        api_key = dec(gemini_key_enc)
        lang_label = "tiếng Việt" if language == "vi" else "English"
        
        async with AsyncSessionLocal() as db:
            proj = await db.get(Project, project_id)
            if not proj: return
            
            bible = json.loads(proj.character_bible or "[]")
            bible_dict = {c["name"]: c for c in bible}
            name_index = {c["name"].lower(): c["name"] for c in bible}
            
            part_scripts = json.loads(proj.part_scripts or "{}")
            beats = part_scripts.get("beats", [])
            style_lock = _resolve_style_lock(proj.style, part_scripts.get("suggested_style", ""), part_scripts.get("style_lock", ""))
            
            proj.status = "generating_scenes"
            await db.commit()
            
        bible_blob = _bible_blob(bible_dict)
        chunk_size = 10
        chunks = [(i, beats[i:i+chunk_size]) for i in range(0, len(beats), chunk_size)]
        sem = asyncio.Semaphore(MAX_MR_CONCURRENCY)
        
        await publish_project_event(project_id, "LOG_UPDATE", f"Bắt đầu sinh {len(beats)} cảnh chia làm {len(chunks)} luồng song song...")
        
        async def _do_chunk(start_i: int, sl: list):
            async with sem:
                await publish_project_event(project_id, "LOG_UPDATE", f"[Luồng {start_i//chunk_size + 1}] Đang sinh cảnh {start_i+1} đến {start_i+len(sl)}...")
                try:
                    d = await asyncio.to_thread(_mr_expand, api_key, sl, start_i, style_lock, bible_blob, lang_label, aspect_ratio, True)
                    scs = d.get("scenes") or []
                    
                    # Giảm cấu trúc cảnh
                    raw_scenes = []
                    for j, sc in enumerate(scs):
                        if not isinstance(sc, dict): continue
                        raw_scenes.append(sc)
                        
                    reduced = _reduce_scenes(raw_scenes, bible_dict, name_index, style_lock, True, cap=len(sl))
                    
                    # Lưu vào DB ngay lập tức
                    scene_resps = []
                    async with AsyncSessionLocal() as db:
                        p = await db.get(Project, project_id)
                        for k, r_sc in enumerate(reduced.scenes):
                            # Xác định giọng nói
                            assigned_voice = p.voice
                            narration = reduced.narrations[k] if k < len(reduced.narrations) else None
                            if narration:
                                # Nếu narration bắt đầu bằng "Tên Nhân Vật: ", chúng ta gán giọng tương ứng
                                for c_name, c_voice in charVoices.items():
                                    if narration.startswith(f"{c_name}:") or narration.startswith(f"{c_name} :"):
                                        assigned_voice = c_voice
                                        break
                                        
                            db_sc = Scene(
                                project_id=project_id, user_id=user_id, index=start_i+k, part=1,
                                prompt=r_sc.prompt,
                                narration=narration,
                                model_key=p.model_key, aspect_ratio=p.aspect_ratio,
                                duration_seconds=p.duration_seconds,
                                status=SceneStatus.pending,
                                voice=assigned_voice
                            )
                            db.add(db_sc)
                            await db.flush()
                            scene_resps.append({
                                "id": db_sc.id, "index": db_sc.index, "prompt": db_sc.prompt,
                                "narration": db_sc.narration, "status": "pending"
                            })
                        await db.commit()
                        
                    await publish_project_event(project_id, "LOG_UPDATE", f"[Luồng {start_i//chunk_size + 1}] ✔️ Đã tạo xong {len(scene_resps)} cảnh.")
                    await publish_project_event(project_id, "SCENES_CHUNK_READY", {"scenes": scene_resps})
                    return True
                except Exception as e:
                    log.warning(f"map-reduce expand @{start_i} lỗi: {e}")
                    await publish_project_event(project_id, "LOG_UPDATE", f"[Luồng {start_i//chunk_size + 1}] ❌ Lỗi: {e}")
                    return False
        
        tasks = [_do_chunk(i, sl) for i, sl in chunks]
        await asyncio.gather(*tasks)
        
        async with AsyncSessionLocal() as db:
            p = await db.get(Project, project_id)
            if p:
                p.status = "draft" # Hoàn tất, trả về trạng thái bình thường để auto render có thể quét
                await db.commit()
                
        await publish_project_event(project_id, "LOG_UPDATE", "🎉 Hoàn tất sinh toàn bộ kịch bản!")
        await publish_project_event(project_id, "GENERATION_COMPLETE", {})
        
    except Exception as e:
        log.exception(f"Error generating scenes for project {project_id}: {e}")
        await publish_project_event(project_id, "ERROR", str(e))
        async with AsyncSessionLocal() as db:
            p = await db.get(Project, project_id)
            if p:
                p.status = "failed"
                await db.commit()
