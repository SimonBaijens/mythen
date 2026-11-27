# Mythen

Een groeiende verzameling mythologische verhalen: elke ochtend een nieuw, goed onderzocht verhaal met
geschilderde portretten van de goden en figuren erin. Je leest ze op de Kobo (via Instapaper) en bladert er
in de app doorheen.

## Hoe het werkt

1. **Verhaal schrijven:** `bron/<datum>-<slug>.md`. In de kop staan titel, ondertitel, mythologie, datum,
   figuren, samenvatting en `scene` (een Engelse beschrijving van het openingsbeeld). Daaronder komt `---`,
   en dan de tekst in eenvoudige Markdown (`## kopjes`, `*cursief*`, `**vet**`, `- lijstjes`, `[link](url)`).
   Een regel `[[figuur:zeus]]` zet daar het portret van Zeus neer. Het verhaal eindigt met **Achtergrond** en **Bronnen**.
2. **Figuren:** `data/figuren.json` bevat elke god of figuur één keer: naam, titel, korte beschrijving en
   een Engelse `prompt` voor het portret. Elk portret wordt één keer gemaakt en daarna overal hergebruikt.
3. **Plaatjes:** `python tools/mythen.py beelden` maakt ontbrekende portretten en openingsbeelden met
   Google Gemini, in dezelfde schilderstijl als de AI Dungeon Master. Een plaatje kost ongeveer 5 cent.
4. **Bouwen:** `python tools/mythen.py bouw` maakt `verhalen/<slug>.html` (de leespagina, die Instapaper
   goed kan lezen) en `data/verhalen.json` (de lijst voor de app).
5. **Online:** de map staat op GitHub Pages. Na een push staat het verhaal binnen een paar minuten online.
6. **Naar de Kobo:** een mail met de link van het verhaal als onderwerp naar de IFTTT-trigger, en die zet hem in
   Instapaper. Dezelfde route als de nieuwsbrieven.

## Pantheon

Het tabblad **Pantheon** toont per mythologie een eigen kaart van de goden, uit `data/pantheons.json`. Per
mythologie staan daar een `kop`, een `intro`, de `personen` die nog geen portret hebben (naam, titel,
beschrijving en een `element` voor de kleur van de lege plek; een groep krijgt `groep: true` en `aantal`), en een of meer `weergaven`:

- `stamboom`: elke figuur op een vaste plek `[kolom, rij]` (halve kolommen mogen). `gezinnen` hebben `ouders`
  en `kinderen`, en optioneel een `label` (bijschrift onder het kind), `stippel` + `uitleg` (de bronnen zijn het
  oneens), `soort: "pleeg"` en `verborgen` (alleen in het infovenster, niet getekend). Staan de twee ouders
  naast elkaar, dan hangt het gezin onder het paar; anders onder de eerste ouder, met "met ..." bij het kind.
  `huwelijken` die niet naast elkaar staan, worden een gouden stippeldraad. `start` is de figuur waar de boom
  op opent.
- `werelden`: `zones` van boven naar beneden, elk met `naam`, `sub`, `toon` (hemel, nacht, zee, aarde, bos, ijs,
  heuvel, onderwereld, diepte), `tekst` en `bewoners`.
- `hof`: een kring rond de oppergod (`midden`) met per god een `domein`.

Komt een figuur uit het pantheon in een verhaal, geef hem in `figuren.json` **hetzelfde id**. Dan verschijnt het
portret vanzelf in de stamboom. `python tools/mythen.py bouw` controleert de namen en meldt welke teksten in
`pantheons.json` dan weg kunnen.

## Lokaal bekijken

```
python -m http.server 8093
```

en dan open je http://localhost:8093.

## Geheimen

De Gemini-sleutel staat **niet** in deze (publieke) repo. Het script haalt hem uit `GEMINI_API_KEY`, uit
`geheim.env` of uit `../dnd-dungeonmaster/instellingen.env`. De stijlvoorbeelden uit het D&D-boek (`stijl/`)
blijven ook lokaal. Zonder die map gebruikt het script de eigen portretten van Zeus en Rhea als stijlanker.
