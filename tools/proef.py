"""Proefplaatjes: dezelfde schilderstijl, drie richtingen voor hoe bovennatuurlijk de goden eruitzien. Uitvoer in proef/."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import mythen  # noqa: E402

UIT = mythen.ROOT / "proef"

RICHTINGEN = {
    "A-kolossaal": ("Epic, colossal and mythic: the figure is a towering, larger-than-life being with an imposing, "
                    "monumental build, glowing eyes and subtle divine energy, ornate ancient armor and relics, a sense of "
                    "immense scale (tiny clouds, birds or ruins near the figure to show how gigantic it is), dramatic "
                    "rim light. Clearly a god or titan, not a normal human."),
    "B-elementair": ("Elemental: the body itself is partly made of the god's domain, as if nature and the god are one: "
                     "materials like stone, water, seaweed, coral, roots, moss, flame or starlight grow out of and replace "
                     "parts of skin, hair and beard, with mythic ornaments. Clearly a god or titan, not a normal human."),
    "C-gestileerd": ("Stylized and characterful like classic hand-drawn animated mythology films: bold, exaggerated "
                     "heroic proportions and silhouettes, expressive and slightly caricatured faces, magical effects as "
                     "part of the character (flame hair, swirling water, glowing patterns), still painted with soft visible "
                     "brushwork. Clearly a god or titan, not a normal human."),
    "D-strijdgod": ("Heroic god-champion like the splash art of a mythological battle arena game: a powerful, dynamic "
                    "pose ready for battle, ornate and oversized fantasy armor and weapons with gold, gems and glowing "
                    "runes, a strong divine aura of the god's element swirling around the body (water, earth, fire, light), "
                    "vivid saturated colors and high contrast, idealized superhuman physique. Clearly a god or titan, not "
                    "a normal human."),
}

FIGUREN = {
    "poseidon": "Poseidon, god of the sea: a beard and hair of flowing seaweed and sea foam, patches of shimmering fish "
                "scales on his arms and shoulders, sea-green glowing eyes, a crown of coral, holding a bronze trident.",
    "kronos": "Kronos, king of the Titans: a gigantic ancient titan, skin like weathered bronze-grey stone with cracks of "
              "golden light, a long iron-grey beard, a heavy golden crown, holding an enormous harvest sickle. "
              "Brooding and paranoid.",
    "gaia": "Gaia, primordial goddess of the Earth: a gigantic titaness made of earth, rock and living plants, hair of "
            "grass, vines and flowers, moss and roots across her body, eyes glowing warm green, motherly but immense "
            "and ancient.",
}

if __name__ == "__main__":
    UIT.mkdir(exist_ok=True)
    vb = mythen.stijlvoorbeelden("portret")
    for rid, richting in RICHTINGEN.items():
        for fid, figuur in FIGUREN.items():
            pad = UIT / f"{rid}-{fid}.jpg"
            if pad.is_file():
                continue
            print(f"  {rid} {fid} ...", flush=True)
            prompt = "\n".join([
                f"A character portrait of {figuur}",
                f"Character design direction: {richting}",
                "Composition: head, shoulders and upper body, the face turned slightly toward the viewer, the painted "
                "figure fading softly into a plain light parchment background, like the character art in the style "
                "reference images.",
                f"The {len(vb)} attached images are style references: use them only for the painting style, the colors "
                "and the light, and never copy what is in them.",
                f"Style: {mythen.STIJL}"])
            try:
                mythen.bewaar(mythen.teken(prompt, vb, "1:1"), pad, 900)
            except Exception as fout:  # één mislukt plaatje mag de rest niet tegenhouden
                print(f"  mislukt: {fout}", flush=True)
