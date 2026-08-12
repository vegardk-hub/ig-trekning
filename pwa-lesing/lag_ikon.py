"""Lager appikonene til Monstergiret: et monstertruckhjul sett rett forfra.

Skriver PNG-ene selv med zlib og struct. Pillow er ikke installert i
skyøkta, og et ikon er ikke grunn god nok til å innføre en avhengighet i et
repo som ikke har noen.

Hvert bilde tegnes tre ganger så stort og skaleres ned til slutt – det er
det som gir glatte kanter uten et eneste bibliotek.

    python3 pwa-lesing/lag_ikon.py
"""

import math
import struct
import zlib
from pathlib import Path

HER = Path(__file__).parent / "icons"
SKALA = 3

BAKGRUNN = (0x14, 0x16, 0x1A)
DEKK = (0x2E, 0x32, 0x37)
MONSTER = (0xFF, 0x9F, 0x2E)   # aksentfargen fra appen
FELG = (0xF2, 0xC9, 0x4C)
NAV = (0x5D, 0xDC, 0x82)       # samme grønt som et lest ord

LUGGER = 12


def farge_i(x, y, midt, ytre):
    """Fargen i ett punkt. Hele ikonet er én funksjon av avstand og vinkel,
    så det trengs ingen tegneflate å male på."""
    dx = x - midt
    dy = y - midt
    r = math.hypot(dx, dy)

    if r > ytre:
        return BAKGRUNN

    # Mønsterklossene stikker ut av dekket hele veien rundt.
    if r > ytre * 0.88:
        vinkel = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
        if (vinkel * LUGGER) % 1.0 > 0.45:
            return BAKGRUNN
        return DEKK

    if r > ytre * 0.60:
        return DEKK
    if r > ytre * 0.54:
        return MONSTER
    if r > ytre * 0.22:
        return FELG
    return NAV


def lag(storrelse, andel, filnavn):
    s = storrelse * SKALA
    midt = s / 2.0
    ytre = s * andel / 2.0

    stor = bytearray(s * s * 3)
    for y in range(s):
        rad = y * s * 3
        yc = y + 0.5
        for x in range(s):
            r, g, b = farge_i(x + 0.5, yc, midt, ytre)
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
    # innenfor den trygge sirkelen Android klipper til, derfor 0.62.
    lag(192, 0.90, "icon-192.png")
    lag(512, 0.90, "icon-512.png")
    lag(512, 0.62, "icon-maskable-512.png")
