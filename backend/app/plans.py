"""Subscription plan catalog (time-based). Edit prices/durations here.
`days` = how long the plan stays active after purchase. Buying again EXTENDS the expiry.
"""
PLANS = {
    "basic":    {"label": "Basic · 1 tháng", "days": 30,  "price": 99000,   "currency": "VND"},
    "pro":      {"label": "Pro · 1 tháng",   "days": 30,  "price": 199000,  "currency": "VND"},
    "pro_year": {"label": "Pro · 1 năm",     "days": 365, "price": 1990000, "currency": "VND"},
}


def get_plan(plan_id: str) -> dict | None:
    return PLANS.get(plan_id)
