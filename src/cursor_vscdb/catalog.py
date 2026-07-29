from __future__ import annotations

from dataclasses import dataclass

RISK_HIGH = "high"
RISK_MEDIUM = "medium"
RISK_LOW = "low"

# (prefix, category, risk, composer_from_segment_index or None)
# For "bubbleId:composerId:rest" composer is segment 1
_RULES: list[tuple[str, str, str, int | None]] = [
    ("bubbleId:", "bubbleId", RISK_HIGH, 1),
    ("agentKv:", "agentKv", RISK_LOW, None),
    ("composer.content.", "composer.content", RISK_MEDIUM, None),
    ("checkpointId:", "checkpointId", RISK_MEDIUM, 1),
    ("composerData:", "composerData", RISK_HIGH, 1),
    ("ofsContent:", "ofsContent", RISK_MEDIUM, 1),
    ("inlineDiff:", "inlineDiff", RISK_MEDIUM, 1),
    ("codeBlockPartialInlineDiffFates:", "codeBlockPartialInlineDiffFates", RISK_MEDIUM, 1),
    ("codeBlockDiff:", "codeBlockDiff", RISK_MEDIUM, 1),
    ("messageRequestContext:", "messageRequestContext", RISK_MEDIUM, 1),
    ("composerVirtualRowHeights:", "composerVirtualRowHeights", RISK_LOW, 1),
]


@dataclass(frozen=True)
class KeyInfo:
    key: str
    category: str
    risk: str
    composer_id: str | None


def categorize_key(key: str) -> KeyInfo:
    for prefix, category, risk, composer_idx in _RULES:
        if key.startswith(prefix):
            composer_id = None
            if composer_idx is not None:
                parts = key.split(":")
                if len(parts) > composer_idx:
                    composer_id = parts[composer_idx] or None
            return KeyInfo(key=key, category=category, risk=risk, composer_id=composer_id)
    return KeyInfo(key=key, category="other", risk=RISK_MEDIUM, composer_id=None)


def known_categories() -> list[str]:
    cats = [c for _, c, _, _ in _RULES]
    return cats + ["other"]
