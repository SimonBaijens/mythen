"""Mythen: bouwt de verzameling mythologische verhalen.

    python tools/mythen.py beelden   # maakt ontbrekende plaatjes met Gemini (kost geld)
    python tools/mythen.py bouw      # maakt verhalen/*.html en data/verhalen.json
    python tools/mythen.py alles     # allebei

Een verhaal staat in bron/<datum>-<slug>.md: kopregels (sleutel: waarde), dan een regel '---', dan de tekst in eenvoudige
Markdown. Een regel [[figuur:zeus]] zet daar het portret van die figuur neer (uit data/figuren.json). Elk portret wordt
maar één keer gemaakt en daarna in elk verhaal hergebruikt, zodat Zeus er overal hetzelfde uitziet.

De Gemini-sleutel komt uit de omgevingsvariabele GEMINI_API_KEY, of uit geheim.env (GEMINI_API_KEY=...), of uit
../dnd-dungeonmaster/instellingen.env. Alleen de standaardbibliotheek en Pillow zijn nodig.
"""
import base64
import html
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRON = ROOT / "bron"
DATA = ROOT / "data"
VERHALEN = ROOT / "verhalen"
FIGUURBEELDEN = ROOT / "beelden" / "figuren"
SCENEBEELDEN = ROOT / "beelden" / "scenes"
STIJL_MAP = ROOT / "stijl"
FIGUREN = DATA / "figuren.json"
INDEX = DATA / "verhalen.json"
PANTHEONS = DATA / "pantheons.json"

API = os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com")
MODEL = os.environ.get("MYTHEN_BEELDMODEL", "gemini-nano-banana-2.1")
DENKEN = {"gemini-nano-banana-2.1": "minimal"}
SITE = os.environ.get("MYTHEN_SITE", "https://simonbaijens.github.io/mythen/")

# Dezelfde schilderstijl als de plaatjes van de AI Dungeon Master, toegespitst op mythen.
STIJL = ("Painted fantasy illustration in the style of the Dungeons & Dragons Starter Set (Heroes of the Borderlands): a "
         "digital painting with soft, visible brushwork, crisp detail on faces and focal points and looser strokes toward "
         "the edges, warm natural earth tones (browns, ochres, olive greens) with small teal accents, golden light with cool "
         "lavender-blue shadows and soft atmospheric haze, expressive faces, realistic proportions, clothing, jewelry, "
         "armor and objects full of detail that fit the ancient culture of the myth. Heroic, mythic and family-friendly, "
         "not grimdark, no gore. Not photorealistic, not anime, not a 3D render. No text, no letters, no frame, no watermark.")

# Gekozen ontwerp (proef B, 25 nov 2026): goden en titanen zijn deels gemaakt van hun eigen element.
RICHTING = ("Elemental character design: the body itself is partly made of the god's domain, as if nature and the god are "
            "one: materials like stone, earth, water, seaweed, coral, roots, moss, storm clouds, lightning, flame, smoke or "
            "starlight grow out of and replace parts of skin, hair and beard, with mythic ornaments and softly glowing eyes. "
            "Gods and titans are clearly supernatural beings, not normal humans; titans are colossal. Mortal humans look "
            "normal. No letters, runes or symbols that look like writing.")

# Stijlvoorbeelden: lokaal de plaatjes uit het D&D-boek (staan niet in de publieke repo). Zijn die er niet (zoals in de
# cloud), dan gaan de eerste portretten uit deze verzameling zelf mee als stijlanker.
STIJL_PORTRET = ("mallyn.webp", "kalista.webp")
STIJL_SCENE = ("wildernis.webp", "kalista.webp")
STIJLANKERS = ("zeus.jpg", "rhea.jpg")
MIME = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


# ---------------------------------------------------------------- bronnen lezen

def lees_verhaal(pad: Path) -> dict:
    tekst = pad.read_text(encoding="utf-8")
    kop, _, lijf = tekst.partition("\n---\n")
    meta = {}
    for regel in kop.splitlines():
        if ":" in regel:
            sleutel, _, waarde = regel.partition(":")
            meta[sleutel.strip()] = waarde.strip()
    meta["figuren"] = [f.strip() for f in meta.get("figuren", "").split(",") if f.strip()]
    meta["slug"] = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", pad.stem)
    meta["lijf"] = lijf.strip()
    for verplicht in ("titel", "mythologie", "datum"):
        if not meta.get(verplicht):
            raise SystemExit(f"{pad.name}: '{verplicht}' ontbreekt in de kop")
    return meta


def alle_verhalen() -> list:
    # Nieuwste eerst; twee verhalen op dezelfde dag staan op volgorde van het moment dat het bronbestand ontstond.
    paden = sorted(BRON.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    return sorted((lees_verhaal(p) for p in paden), key=lambda v: v["datum"], reverse=True)


def figuren() -> dict:
    return json.loads(FIGUREN.read_text(encoding="utf-8"))


def figuren_in(verhaal: dict) -> list:
    """Alle figuren uit de kop én uit [[figuur:...]]-regels, in volgorde, zonder dubbele."""
    ids = verhaal["figuren"] + re.findall(r"\[\[figuur:([a-z0-9_-]+)\]\]", verhaal["lijf"])
    return list(dict.fromkeys(ids))


# ---------------------------------------------------------------- Gemini

def sleutel() -> str:
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    for pad in (ROOT / "geheim.env", ROOT.parent / "dnd-dungeonmaster" / "instellingen.env"):
        if pad.is_file():
            for regel in pad.read_text(encoding="utf-8").splitlines():
                if regel.startswith("GEMINI_API_KEY="):
                    return regel.split("=", 1)[1].strip()
    raise SystemExit("Geen Gemini-sleutel gevonden (GEMINI_API_KEY, geheim.env of de D&D-instellingen).")


def stijlvoorbeelden(soort: str) -> list:
    namen = STIJL_PORTRET if soort == "portret" else STIJL_SCENE
    paden = [STIJL_MAP / n for n in namen if (STIJL_MAP / n).is_file()]
    if not paden:
        paden = [FIGUURBEELDEN / n for n in STIJLANKERS if (FIGUURBEELDEN / n).is_file()]
    return paden


def plaatje_uit(antwoord: dict):
    blokken = [blok for stap in antwoord.get("steps") or [] if isinstance(stap, dict) and stap.get("type") == "model_output"
               for blok in stap.get("content") or []]
    if isinstance(antwoord.get("output_image"), dict):
        blokken.append(antwoord["output_image"])
    for kandidaat in antwoord.get("candidates") or []:
        for deel in ((kandidaat or {}).get("content") or {}).get("parts") or []:
            inline = deel.get("inlineData") or deel.get("inline_data")
            if inline:
                blokken.append({"type": "image", "data": inline.get("data")})
    for blok in reversed(blokken):
        if isinstance(blok, dict) and blok.get("type") == "image" and blok.get("data"):
            return base64.b64decode(blok["data"])
    return None


def teken(prompt: str, voorbeelden: list, verhouding: str) -> bytes:
    invoer = [{"type": "text", "text": prompt}]
    for pad in voorbeelden:
        invoer.append({"type": "image", "mime_type": MIME.get(pad.suffix.lower(), "image/png"),
                       "data": base64.b64encode(pad.read_bytes()).decode()})
    body = {"model": MODEL, "input": invoer, "store": False,
            "response_format": {"type": "image", "mime_type": "image/jpeg", "aspect_ratio": verhouding, "image_size": "1K"}}
    if MODEL in DENKEN:
        body["generation_config"] = {"thinking_level": DENKEN[MODEL]}
    vraag = urllib.request.Request(f"{API}/v1beta/interactions", data=json.dumps(body).encode(), method="POST",
                                   headers={"x-goog-api-key": sleutel(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(vraag, timeout=240) as r:
            antwoord = json.loads(r.read())
    except urllib.error.HTTPError as fout:
        raise RuntimeError(f"Gemini gaf {fout.code}: {fout.read()[:400].decode(errors='replace')}") from fout
    data = plaatje_uit(antwoord if isinstance(antwoord, dict) else {})
    if not data:
        raise RuntimeError("Gemini gaf geen plaatje terug (filter?): " + json.dumps(antwoord)[:400])
    return data


def bewaar(data: bytes, pad: Path, breedte: int):
    """Verkleind en als lichte JPEG: prettig voor Instapaper, de Kobo en de telefoon."""
    from PIL import Image
    beeld = Image.open(io.BytesIO(data)).convert("RGB")
    if beeld.width > breedte:
        beeld = beeld.resize((breedte, round(beeld.height * breedte / beeld.width)), Image.LANCZOS)
    pad.parent.mkdir(parents=True, exist_ok=True)
    beeld.save(pad, "JPEG", quality=82, optimize=True, progressive=True)


def portret_prompt(figuur: dict, aantal: int) -> str:
    delen = [f"A character portrait of {figuur['prompt']}",
             f"Character design: {RICHTING}",
             "Composition: a head-and-shoulders vignette, the face in the upper middle and turned slightly toward the "
             "viewer, the painted figure fading softly into a plain light parchment background, like the character art in "
             "the style reference images."]
    if aantal:
        delen.append(f"The {aantal} attached images are style references: use them only for the painting style, the "
                     "colors and the light, and never copy what is in them.")
    delen.append(f"Style: {STIJL}")
    return "\n".join(delen)


def scene_figuren(verhaal: dict) -> list:
    """Figuren die in het openingsbeeld staan (kopregel 'scenefiguren:'), met een bestaand portret."""
    ids = [f.strip() for f in verhaal.get("scenefiguren", "").split(",") if f.strip()]
    return [f for f in ids if (FIGUURBEELDEN / f"{f}.jpg").is_file()]


def scene_prompt(verhaal: dict, personages: list, aantal_stijl: int) -> str:
    """personages: [(naam, beschrijving)] in dezelfde volgorde als de portretten die als eerste meegaan."""
    delen = [f"A scene from {verhaal['mythologie']} mythology: {verhaal['scene']}",
             "Composition: a wide, cinematic scene with a clear focal point, showing both the place and the characters, "
             "with depth and soft atmospheric haze.",
             f"Character design: {RICHTING}"]
    if personages:
        regels = "; ".join(f"image {i + 1} is {naam}" for i, (naam, _) in enumerate(personages))
        delen.append(f"The first {len(personages)} attached images are character portraits from the same story ({regels}). "
                     "These characters must look exactly like their portraits in this scene: the same face, hair, beard, "
                     "skin, elemental features, colors, clothing, crown and objects. Where the scene text describes a "
                     "character differently, follow the portrait. Only pose, expression and lighting may change.")
    if aantal_stijl:
        delen.append(f"The last {aantal_stijl} attached images are style references: use them only for the painting "
                     "style, the colors and the light, and never copy what is in them.")
    delen.append(f"Style: {STIJL}")
    return "\n".join(delen)


def maak_beelden(alleen: str = "") -> None:
    alle = figuren()
    for verhaal in alle_verhalen():
        if alleen and verhaal["slug"] != alleen:
            continue
        for fid in figuren_in(verhaal):
            if fid not in alle:
                raise SystemExit(f"{verhaal['slug']}: figuur '{fid}' staat niet in data/figuren.json")
            pad = FIGUURBEELDEN / f"{fid}.jpg"
            if pad.is_file():
                continue
            print(f"  portret {fid} ...", flush=True)
            vb = stijlvoorbeelden("portret")
            bewaar(teken(portret_prompt(alle[fid], len(vb)), vb, "1:1"), pad, 900)
        pad = SCENEBEELDEN / f"{verhaal['slug']}.jpg"
        if verhaal.get("scene") and not pad.is_file():
            print(f"  openingsbeeld {verhaal['slug']} ...", flush=True)
            # Eerst de portretten (hierboven gemaakt), zodat iedereen in het openingsbeeld er hetzelfde uitziet.
            ids = scene_figuren(verhaal)
            portretten = [FIGUURBEELDEN / f"{f}.jpg" for f in ids]
            vb = stijlvoorbeelden("scene")[:1] if portretten else stijlvoorbeelden("scene")
            personages = [(alle[f]["naam"], alle[f]["prompt"]) for f in ids]
            bewaar(teken(scene_prompt(verhaal, personages, len(vb)), portretten + vb, "16:9"), pad, 1400)


# ---------------------------------------------------------------- pagina's bouwen

def inline(tekst: str) -> str:
    t = html.escape(tekst, quote=False)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", lambda m: f'<a href="{html.escape(m[2])}">{m[1]}</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    return t


def figuur_html(fid: str, alle: dict, pad_terug: str) -> str:
    f = alle[fid]
    if not (FIGUURBEELDEN / f"{fid}.jpg").is_file():
        return ""
    return (f'<figure class="figuur" id="figuur-{fid}"><img src="{pad_terug}beelden/figuren/{fid}.jpg" '
            f'alt="{html.escape(f["naam"])}" width="900" height="900" loading="lazy">'
            f'<figcaption><strong>{html.escape(f["naam"])}</strong> · {html.escape(f["titel"])}</figcaption></figure>')


def markdown(lijf: str, alle: dict, pad_terug: str) -> str:
    uit, alinea, lijst = [], [], []

    def sluit():
        if alinea:
            uit.append(f"<p>{inline(' '.join(alinea))}</p>")
            alinea.clear()
        if lijst:
            uit.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in lijst) + "</ul>")
            lijst.clear()

    for regel in lijf.splitlines():
        r = regel.strip()
        m = re.fullmatch(r"\[\[figuur:([a-z0-9_-]+)\]\]", r)
        if not r:
            sluit()
        elif m:
            sluit()
            uit.append(figuur_html(m[1], alle, pad_terug))
        elif r.startswith("## "):
            sluit()
            uit.append(f"<h2>{inline(r[3:])}</h2>")
        elif r.startswith("- "):
            if alinea:
                sluit()
            lijst.append(r[2:])
        else:
            if lijst:
                sluit()
            alinea.append(r)
    sluit()
    return "\n".join(x for x in uit if x)


MAANDEN = "januari februari maart april mei juni juli augustus september oktober november december".split()


def mooie_datum(iso: str) -> str:
    j, m, d = iso.split("-")
    return f"{int(d)} {MAANDEN[int(m) - 1]} {j}"


def leestijd(lijf: str) -> int:
    return max(1, round(len(re.sub(r"\[\[.*?\]\]", "", lijf).split()) / 240))


PAGINA = """<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titel} · Mythen</title>
<meta name="description" content="{samenvatting}">
<meta name="author" content="Mythen">
<meta property="og:type" content="article">
<meta property="og:title" content="{titel}">
<meta property="og:description" content="{samenvatting}">
{og_beeld}
<meta name="theme-color" content="#171310">
<link rel="stylesheet" href="../verhaal.css">
</head>
<body>
<nav class="terug"><a href="../">← Alle mythen</a></nav>
<article>
<header>
<p class="mythologie">{mythologie} · <time datetime="{datum}">{mooie_datum}</time> · {leestijd} min lezen</p>
<h1>{titel}</h1>
<p class="ondertitel">{ondertitel}</p>
</header>
{scene}
{lijf}
</article>
<footer class="voet"><a href="../">Mythen</a> · een verhaal per dag</footer>
</body>
</html>
"""


def bouw() -> None:
    alle = figuren()
    index = []
    VERHALEN.mkdir(exist_ok=True)
    for v in alle_verhalen():
        scene_pad = SCENEBEELDEN / f"{v['slug']}.jpg"
        scene = (f'<figure class="scene"><img src="../beelden/scenes/{v["slug"]}.jpg" alt="{html.escape(v["titel"])}" '
                 f'width="1400" height="788"></figure>') if scene_pad.is_file() else ""
        og = (f'<meta property="og:image" content="{SITE}beelden/scenes/{v["slug"]}.jpg">'
              if scene_pad.is_file() else "")
        lijf = markdown(v["lijf"], alle, "../")
        if scene:  # na het verhaal nog een keer het openingsbeeld, om rustig te bekijken
            slot = scene.replace('class="scene"', 'class="scene slot"', 1)
            lijf = (lijf.replace("<h2>Achtergrond</h2>", slot + "\n<h2>Achtergrond</h2>", 1)
                    if "<h2>Achtergrond</h2>" in lijf else lijf + "\n" + slot)
        lees = leestijd(v["lijf"])
        pagina = PAGINA.format(titel=html.escape(v["titel"]), ondertitel=html.escape(v.get("ondertitel", "")),
                               samenvatting=html.escape(v.get("samenvatting", "")), mythologie=html.escape(v["mythologie"]),
                               datum=v["datum"], mooie_datum=mooie_datum(v["datum"]), leestijd=lees, scene=scene,
                               og_beeld=og, lijf=lijf)
        (VERHALEN / f"{v['slug']}.html").write_text(pagina, encoding="utf-8")
        index.append({"slug": v["slug"], "titel": v["titel"], "ondertitel": v.get("ondertitel", ""),
                      "mythologie": v["mythologie"], "datum": v["datum"], "samenvatting": v.get("samenvatting", ""),
                      "leestijd": lees, "beeld": f"beelden/scenes/{v['slug']}.jpg" if scene_pad.is_file() else "",
                      "figuren": [f for f in figuren_in(v) if (FIGUURBEELDEN / f"{f}.jpg").is_file()]})
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  {len(index)} verhaal/verhalen gebouwd")


def controleer_pantheons() -> None:
    """Kijkt of elke naam in data/pantheons.json bestaat, en meldt figuren die nu een portret hebben.

    Een figuur die in een verhaal komt, krijgt in figuren.json hetzelfde id als in het pantheon. Dan verschijnt
    het portret vanzelf in de stamboom; de korte tekst in pantheons.json mag dan weg (figuren.json gaat voor)."""
    if not PANTHEONS.is_file():
        return
    alle = figuren()
    for myth, p in json.loads(PANTHEONS.read_text(encoding="utf-8")).items():
        bekend = set(p.get("personen", {})) | set(alle)
        namen = []
        for w in p.get("weergaven", []):
            namen += list(w.get("plaats", {}))
            for g in w.get("gezinnen", []):
                namen += g["ouders"] + g["kinderen"]
            for h in w.get("huwelijken", []):
                namen += h[:2]
            for z in w.get("zones", []):
                namen += z["bewoners"]
            if w.get("soort") == "hof":
                namen += [w["midden"]["id"]] + [k["id"] for k in w["kring"]]
        for n in sorted(set(namen) - bekend):
            print(f"  ! pantheon {myth}: '{n}' staat niet in personen of figuren.json")
        for n in sorted(set(p.get("personen", {})) & set(alle)):
            print(f"  · pantheon {myth}: '{n}' heeft nu een portret; de tekst in pantheons.json kan weg")


if __name__ == "__main__":
    actie = sys.argv[1] if len(sys.argv) > 1 else "alles"
    if actie in ("beelden", "alles"):
        maak_beelden(sys.argv[2] if len(sys.argv) > 2 else "")
    if actie in ("bouw", "alles"):
        bouw()
        controleer_pantheons()
