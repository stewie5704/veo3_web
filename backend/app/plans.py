"""Subscription plan catalog. Edit prices/durations here — subscription.py reads PLANS directly."""

PLANS = {
    "m1": {
        "label": "1 tháng",
        "days": 30,
        "price": 249_000,
        "original_price": 249_000,
        "currency": "VND",
        "assistants": 10,
        "discount_pct": 0,
    },
    "m6": {
        "label": "6 tháng",
        "days": 180,
        "price": 1_419_000,          # 249k × 6 × 0.95
        "original_price": 1_494_000,
        "currency": "VND",
        "assistants": 50,
        "discount_pct": 5,
    },
    "m12": {
        "label": "12 tháng",
        "days": 365,
        "price": 2_599_000,          # 249k × 12 × 0.87
        "original_price": 2_988_000,
        "currency": "VND",
        "assistants": 100,
        "discount_pct": 13,
    },
}


def get_plan(plan_id: str) -> dict | None:
    return PLANS.get(plan_id)
