"""Lager appikonene til Stuntgarasjen: en loop med et dollartegn inni.

Skriver PNG-ene selv med zlib og struct. Pillow er ikke installert i
skyøkta, og et ikon er ikke grunn god nok til å innføre en avhengighet i et
repo som ikke har noen.

Hvert bilde tegnes tre ganger så stort og skaleres ned til slutt – det er
det som gir glatte kanter uten et eneste bibliotek.

    python3 pwa-stunt/lag_ikon.py
"""

import math
import struct
import zlib
from pathlib import Path

HER = Path(__file__).parent / "icons"
SKALA = 3

BAKGRUNN = (0x16, 0x1C, 0x2E)
ASFALT = (0x39, 0x41, 0x4F)
KANT = (0x20, 0x24, 0x2C)
STIPLET = (0xFF, 0xC6, 0x1A)
PENGER = (0x4D, 0xFC, 0x9A)

STIPLER = 14


def farge_i(x, y, midt, ytre):
    """Fargen i ett punkt. Hele ikonet er én funksjon av avstand og vinkel,
    så det trengs ingen tegneflate å male på."""
    dx = x - midt
    dy = y - midt
    r = math.hypot(dx, dy)

    # Loopen: asfaltring med mørk kant og gul midtstripe.
    if ytre * 0.60 <= r <= ytre * 1.00:
        if r >= ytre * 0.96 or r <= ytre * 0.64:
            return KANT
        if abs(r - ytre * 0.80) < ytre * 0.022:
            vinkel = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
            if (vinkel * STIPLER) % 1.0 < 0.55:
                return STIPLET
        return ASFALT

    if dollartegn(dx, dy, ytre):
        return PENGER

    return BAKGRUNN


def dollartegn(dx, dy, ytre):
    """S-en med streken gjennom, satt sammen av to halvbuer og et rektangel.

    Buene klippes mot hver sin halvplan, ellers blir S-en to hele ringer."""
    a = ytre * 0.20          # radius i hver bue
    t = ytre * 0.062         # strektykkelse
    h = ytre * 0.50          # høyden på den loddrette streken

    if abs(dx) < t * 0.62 and abs(dy) < h / 2:
        return True

    # Øvre bue: åpen ned mot høyre.
    d = math.hypot(dx, dy + a)
    if abs(d - a) < t and (dy + a < 0 or dx < 0):
        return True

    # Nedre bue: åpen opp mot venstre.
    d = math.hypot(dx, dy - a)
    if abs(d - a) < t and (dy - a > 0 or dx > 0):
        return True

    return False


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
    lag(192, 0.88, "icon-192.png")
    lag(512, 0.88, "icon-512.png")
    lag(512, 0.62, "icon-maskable-512.png")
    lag(180, 0.88, "apple-touch-icon.png")
