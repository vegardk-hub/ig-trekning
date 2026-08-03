"""Lager appikonene til Fargeflasker: en flaske med tre fargestriper.

Tegnes fire ganger så stort som nødvendig og skaleres ned til slutt – da blir
kantene glatte uten at vi trenger noe mer enn Pillow.
"""

from PIL import Image, ImageDraw
from pathlib import Path

HER = Path(__file__).parent
SKALA = 4

BAKGRUNN = (27, 36, 80)
GLASS = (255, 255, 255)
INNI = (255, 255, 255, 26)
STRIPER = [(47, 116, 232), (255, 198, 26), (244, 72, 60)]  # blå, gul, rød – nedenfra


def lag(storrelse, marg_andel, filnavn):
    s = storrelse * SKALA
    bilde = Image.new("RGBA", (s, s), BAKGRUNN + (255,))
    tegn = ImageDraw.Draw(bilde, "RGBA")

    marg = s * marg_andel
    h = s - 2 * marg                       # flaskens høyde
    b = h * 0.44                            # flaskens bredde
    x0 = (s - b) / 2
    y0 = marg
    strek = max(2, int(h * 0.045))

    # Hals og kropp. Halsen tegnes først, så kroppen dekker skjøten.
    hals_b = b * 0.34
    hals = [x0 + (b - hals_b) / 2, y0, x0 + (b + hals_b) / 2, y0 + h * 0.26]
    kropp = [x0, y0 + h * 0.20, x0 + b, y0 + h]

    tegn.rounded_rectangle(hals, radius=hals_b * 0.3, fill=INNI,
                           outline=GLASS + (255,), width=strek)
    tegn.rounded_rectangle(kropp, radius=b * 0.26, fill=BAKGRUNN + (255,))

    # Fargestripene fyller kroppen nedenfra og opp.
    innside = [kropp[0] + strek, kropp[1] + strek, kropp[2] - strek, kropp[3] - strek]
    fyll = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    fyll_tegn = ImageDraw.Draw(fyll)
    hoyde = (innside[3] - innside[1]) / len(STRIPER)
    for i, farge in enumerate(STRIPER):
        topp = innside[3] - hoyde * (i + 1)
        fyll_tegn.rectangle([innside[0], topp, innside[2], innside[3] - hoyde * i],
                            fill=farge + (255,))

    maske = Image.new("L", (s, s), 0)
    ImageDraw.Draw(maske).rounded_rectangle(innside, radius=b * 0.22, fill=255)
    bilde.paste(fyll, (0, 0), maske)

    tegn.rounded_rectangle(kropp, radius=b * 0.26, outline=GLASS + (255,), width=strek)

    bilde.resize((storrelse, storrelse), Image.LANCZOS).save(HER / filnavn)
    print("skrev", filnavn)


if __name__ == "__main__":
    # Vanlige ikoner fyller nesten hele flaten. Maskable trenger klaring til
    # sikkerhetssonen, ellers klipper Android av toppen av flasken.
    lag(512, 0.11, "icon-512.png")
    lag(192, 0.11, "icon-192.png")
    lag(180, 0.11, "apple-touch-icon.png")
    lag(512, 0.24, "icon-maskable-512.png")
