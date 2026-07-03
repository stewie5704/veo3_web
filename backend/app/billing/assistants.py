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

    result = await db.execute(
        select(AssistantGift).where(AssistantGift.user_id == user_id)
    )
    if result.scalar_one_or_none() is not None:
        return None  # already gifted — once per user

    all_assistants = load_assistants()
    if not all_assistants:
        return []

    # Mỗi user sẽ có một pool độc lập. Ta chọn ngẫu nhiên `count` trợ lí từ kho.
    import random
    to_gift_pool = list(all_assistants)
    random.shuffle(to_gift_pool)
    to_gift = to_gift_pool[:count]

    gift = AssistantGift(
        user_id=user_id,
        payment_id=payment_id,
        count=len(to_gift),
        assistants_json=json.dumps(to_gift, ensure_ascii=False),
    )
    db.add(gift)
    return to_gift
