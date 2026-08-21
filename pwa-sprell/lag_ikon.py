"""Lager appikonene til Sprellemaskinen: en strekfigur midt i et sprett.

Skriver PNG-ene selv med zlib og struct. Pillow er ikke installert i skyøkta,
og et ikon er ikke grunn god nok til å innføre en avhengighet i et repo som
ikke har noen.

Hvert bilde tegnes tre ganger så stort og skaleres ned til slutt – det er det
som gir glatte kanter uten et eneste bibliotek.

    python3 pwa-sprell/lag_ikon.py
"""

import math
import struct
import zlib
from pathlib import Path

HER = Path(__file__).parent / "icons"
SKALA = 3

BAKGRUNN = (0xFF, 0xFF, 0xFF)
STREK = (0x00, 0x00, 0x00)

# Figuren i enhetskoordinater, 0–1 med y nedover: hode, kropp, armer opp,
# beina ut til siden. Samme svart-hvitt som appen selv.
HODE = (0.50, 0.235, 0.105)
STREKER = [
    ((0.50, 0.34), (0.50, 0.585)),   # kropp
    ((0.50, 0.40), (0.22, 0.20)),    # venstre arm
    ((0.50, 0.40), (0.78, 0.20)),    # høyre arm
    ((0.50, 0.585), (0.26, 0.83)),   # venstre bein
    ((0.50, 0.585), (0.74, 0.83)),   # høyre bein
]
TYKKELSE = 0.048   # halv strekbredde


def avstand_til_strek(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    lengde = dx * dx + dy * dy
    t = 0.0 if lengde == 0 else ((px - ax) * dx + (py - ay) * dy) / lengde
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def farge_i(u, v):
    """Fargen i ett punkt, gitt i enhetskoordinater. Hele ikonet er én
    funksjon av avstand til hodet og til strekene, så det trengs ingen
    tegneflate å male på."""
    if math.hypot(u - HODE[0], v - HODE[1]) <= HODE[2]:
        return STREK
    for a, b in STREKER:
        if avstand_til_strek(u, v, a, b) <= TYKKELSE:
            return STREK
    return BAKGRUNN


def lag(storrelse, andel, filnavn):
    s = storrelse * SKALA
    stor = bytearray(s * s * 3)
    for y in range(s):
        rad = y * s * 3
        # andel < 1 krymper figuren mot midten uten å endre tegningen.
        v = ((y + 0.5) / s - 0.5) / andel + 0.5
        for x in range(s):
            u = ((x + 0.5) / s - 0.5) / andel + 0.5
            r, g, b = farge_i(u, v)
            i = rad + x * 3
            stor[i] = r
            stor[i + 1] = g
            stor[i + 2] = b

    # Boksnedskalering: gjennomsnittet av SKALA x SKALA piksler.
    n = SKALA * SKALA
    rader = []
    for y in range(storrelse):
        rad = bytearray(storrelse * 3 + 1)   # første byte er filtertype 0
        for x in range(storrelse):
            sum_r = sum_g = sum_b = 0
            for oy in range(SKALA):
                base = ((y * SKALA + oy) * s + x * SKALA) * 3
                for ox in range(SKALA):
                    i = base + ox * 3
                    sum_r += stor[i]
                    sum_g += stor[i + 1]
                    sum_b += stor[i + 2]
            o = 1 + x * 3
            rad[o] = sum_r // n
            rad[o + 1] = sum_g // n
            rad[o + 2] = sum_b // n
        rader.append(bytes(rad))

    skriv_png(HER / filnavn, storrelse, storrelse, b"".join(rader))
    print("skrev", filnavn)


def bit(navn, innhold):
    return (struct.pack(">I", len(innhold)) + navn + innhold
            + struct.pack(">I", zlib.crc32(navn + innhold) & 0xFFFFFFFF))


def skriv_png(sti, bredde, hoyde, raadata):
    ihdr = struct.pack(">IIBBBBB", bredde, hoyde, 8, 2, 0, 0, 0)
    data = (b"\x89PNG\r\n\x1a\n"
            + bit(b"IHDR", ihdr)
            + bit(b"IDAT", zlib.compress(raadata, 9))
            + bit(b"IEND", b""))
    sti.write_bytes(data)


if __name__ == "__main__":
    HER.mkdir(parents=True, exist_ok=True)
    # Vanlige ikoner fyller nesten hele flata. Det maskerbare må holde seg
    # innenfor sirkelen Android klipper til, derfor 0.66.
    lag(192, 0.95, "icon-192.png")
    lag(512, 0.95, "icon-512.png")
    lag(512, 0.66, "icon-maskable-512.png")
