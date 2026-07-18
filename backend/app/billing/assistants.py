"""AI-assistant pool: load from assistants.json, gift N to a user (once per user)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Place assistants.json one directory above the app package (i.e. backend/assistants.json)
ASSISTANTS_FILE = Path(__file__).parent.parent.parent / "assistants.json"


def load_assistants() -> list:
    if not ASSISTANTS_FILE.exists():
        return []
    try:
        return json.loads(ASSISTANTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


async def gift_assistants_if_eligible(
    db: AsyncSession,
    user_id: str,
    payment_id: str,
    count: int,
) -> list | None:
    """Gift `count` assistants to the user.

    Returns the gifted list on success, None if the user was already gifted before.
    This function does NOT commit — the caller is responsible.
    """
    from app.billing.models import AssistantGift

    all_assistants = load_assistants()
    if not all_assistants:
        return []

    # Get all previously gifted assistants for this user
    gifts = (await db.execute(
        select(AssistantGift).where(AssistantGift.user_id == user_id)
    )).scalars().all()

    owned_ids = set()
    for g in gifts:
        try:
            arr = json.loads(g.assistants_json)
            for a in arr:
                if "id" in a:
                    owned_ids.add(a["id"])
        except Exception:
            pass

    # Find available assistants in the pool
    available = [a for a in all_assistants if a.get("id") not in owned_ids]
    if not available:
        return []  # User has already exhausted the entire pool of ~100 assistants

    import random
    to_gift_pool = list(available)
    random.shuffle(to_gift_pool)
    to_gift = to_gift_pool[:count]

    # Vì `user_id` là UNIQUE, không được INSERT bản ghi thứ 2 (sẽ raise IntegrityError
    # rollback cả `mark_paid_and_activate` → payment kẹt pending vĩnh viễn). Nếu user
    # đã có 1 gift → UPDATE cộng dồn danh sách; chưa có → INSERT.
    existing = (await db.execute(
        select(AssistantGift).where(AssistantGift.user_id == user_id)
    )).scalar_one_or_none()
    if existing is None:
        db.add(AssistantGift(
            user_id=user_id,
            payment_id=payment_id,
            count=len(to_gift),
            assistants_json=json.dumps(to_gift, ensure_ascii=False),
        ))
    else:
        try:
            prev = json.loads(existing.assistants_json or "[]")
            if not isinstance(prev, list):
                prev = []
        except Exception:
            prev = []
        merged = prev + to_gift
        existing.assistants_json = json.dumps(merged, ensure_ascii=False)
        existing.count = len(merged)
        # payment_id giữ nguyên bản đầu — cột không có ý nghĩa referential ngoài audit.
    return to_gift
