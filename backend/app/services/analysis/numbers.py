def _numeric(value: bool | int | float) -> float:
    return float(value)  # booleans become 0/1, so their mean is a rate


def _sign(x: float) -> int:
    return (x > 0) - (x < 0)


def _r(x: float, digits: int = 3) -> float:
    return round(x, digits)
