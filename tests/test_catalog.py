from cursor_flash.catalog import categorize_key, RISK_HIGH


def test_bubble_id():
    c = categorize_key("bubbleId:comp-old:b1")
    assert c.category == "bubbleId"
    assert c.composer_id == "comp-old"
    assert c.risk == RISK_HIGH


def test_agent_kv_no_composer():
    c = categorize_key("agentKv:blob:aaa")
    assert c.category == "agentKv"
    assert c.composer_id is None


def test_composer_content_dot_prefix():
    c = categorize_key("composer.content.abc123")
    assert c.category == "composer.content"


def test_unknown_other():
    c = categorize_key("totally.unknown.key")
    assert c.category == "other"
