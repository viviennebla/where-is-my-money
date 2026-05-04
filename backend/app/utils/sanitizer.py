def sanitize_for_ai(rows: list[list[str]]) -> list[list[str]]:
    """
    Only keep header row + sample rows with descriptions.
    Strip amounts and account identifiers before sending to AI.
    """
    if not rows:
        return rows

    sanitized = [rows[0]]

    for row in rows[1:]:
        sanitized.append([_mask_if_numeric(cell) for cell in row])

    return sanitized


def _mask_if_numeric(value: str) -> str:
    stripped = value.strip().replace(",", "").replace("¥", "").replace("$", "")
    try:
        float(stripped)
        return "[AMOUNT]"
    except ValueError:
        return value
