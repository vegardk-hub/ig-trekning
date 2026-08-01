"""Lager appikonene til Sudoku-PWA-en: et lite rutenett med noen tall."""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

HER = Path(__file__).parent

BAKGRUNN = (47, 111, 179)     # --aksent
PAPIR = (250, 248, 243)
TYNN = (185, 178, 164)
TYKK = (60, 68, 80)
BLEKK = (38, 44, 53)

# Et lite mønster som gir ikonet karakter uten å bli rotete.
TALL = {(0, 0): 5, (1, 4): 8, (2, 2): 3, (3, 7): 1,
        (4, 4): 7, (5, 1): 9, (6, 6): 4, (8, 8): 2}


def finn_font(px):
    for navn in ("segoeuib.ttf", "arialbd.ttf", "seguisb.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(navn, px)
        except OSError:
            continue
    return ImageFont.load_default()


def lag(storrelse, marg_andel, avrunding, filnavn):
    bilde = Image.new("RGBA", (storrelse, storrelse), BAKGRUNN + (255,))
    tegn = ImageDraw.Draw(bilde)

    marg = int(storrelse * marg_andel)
    side = storrelse - 2 * marg
    celle = side / 9

    tegn.rounded_rectangle(
        [marg, marg, marg + side, marg + side],
        radius=int(side * avrunding), fill=PAPIR,
    )

    tynn = max(1, int(storrelse * 0.006))
    tykk = max(2, int(storrelse * 0.018))

    for n in range(1, 9):
        pos = marg + celle * n
        bredde = tykk if n % 3 == 0 else tynn
        farge = TYKK if n % 3 == 0 else TYNN
        tegn.line([pos, marg, pos, marg + side], fill=farge, width=bredde)
        tegn.line([marg, pos, marg + side, pos], fill=farge, width=bredde)

    tegn.rounded_rectangle(
        [marg, marg, marg + side, marg + side],
        radius=int(side * avrunding), outline=TYKK, width=tykk,
    )

    font = finn_font(int(celle * 0.72))
    for (rad, kol), tall in TALL.items():
        midt = (marg + celle * (kol + 0.5), marg + celle * (rad + 0.5))
        tegn.text(midt, str(tall), font=font, fill=BLEKK, anchor="mm")

    bilde.save(HER / filnavn)
    print("skrev", filnavn)


if __name__ == "__main__":
    # Vanlige ikoner: nesten hele flaten. Maskable: god klaring til sikkerhetssonen.
    lag(512, 0.10, 0.045, "icon-512.png")
    lag(192, 0.10, 0.045, "icon-192.png")
    lag(180, 0.10, 0.045, "apple-touch-icon.png")
    lag(512, 0.22, 0.05, "icon-maskable-512.png")
