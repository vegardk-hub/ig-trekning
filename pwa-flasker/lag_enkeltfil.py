"""Bygger flaskespill.html: hele spillet i én fil som kan dobbeltklikkes.

PWA-mappen er kilden. Dette skriptet limer css og js rett inn i html-en, så
enkeltfila aldri kommer ut av takt med den. Kjør det på nytt etter endringer:

    python pwa-flasker/lag_enkeltfil.py
"""

import base64
import re
from pathlib import Path

HER = Path(__file__).parent
UT = HER.parent / "flaskespill.html"


def les(navn):
    return (HER / navn).read_text(encoding="utf-8")


def bygg():
    html = les("index.html")
    css = les("styles.css")
    # Samme rekkefølge som i index.html: app.js leser både Spill og Figurer
    # ved oppstart, så de to må være definert først.
    js = les("js/spill.js") + "\n" + les("js/figurer.js") + "\n" + les("js/app.js")

    # Service worker-registreringen gir bare en 404 uten sw.js ved siden av.
    js = re.sub(r"[ \t]*/\* enkeltfil: start.*?enkeltfil: slutt \*/\n",
                "", js, flags=re.S)

    ikon = base64.b64encode((HER / "icon-192.png").read_bytes()).decode()
    ikon_url = "data:image/png;base64," + ikon

    # Manifest og service worker finnes ikke i enkeltfila; ikonet legges inn
    # som data-url så fanen og hjemskjermen får riktig bilde likevel.
    html = html.replace('<link rel="manifest" href="manifest.json">\n', "")
    html = html.replace('<link rel="apple-touch-icon" href="apple-touch-icon.png">',
                        '<link rel="apple-touch-icon" href="%s">' % ikon_url)
    html = html.replace('<link rel="icon" href="icon-192.png">',
                        '<link rel="icon" href="%s">' % ikon_url)
    html = html.replace('<link rel="stylesheet" href="styles.css">',
                        "<style>\n%s</style>" % css)
    html = html.replace('<script src="js/spill.js"></script>\n'
                        '<script src="js/figurer.js"></script>\n'
                        '<script src="js/app.js"></script>',
                        "<script>\n%s</script>" % js)

    for rest in ('href="styles.css"', 'src="js/'):
        if rest in html:
            raise SystemExit("fant fortsatt en ekstern referanse: " + rest)

    UT.write_text(html, encoding="utf-8")
    print("skrev %s (%.0f kB)" % (UT.name, len(html.encode("utf-8")) / 1024))


if __name__ == "__main__":
    bygg()
