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

## Lokaal bekijken

```
python -m http.server 8093
```

en dan open je http://localhost:8093.

## Geheimen

De Gemini-sleutel staat **niet** in deze (publieke) repo. Het script haalt hem uit `GEMINI_API_KEY`, uit
`geheim.env` of uit `../dnd-dungeonmaster/instellingen.env`. De stijlvoorbeelden uit het D&D-boek (`stijl/`)
blijven ook lokaal. Zonder die map gebruikt het script de eigen portretten van Zeus en Rhea als stijlanker.
