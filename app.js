// Mythen: de lijst met verhalen en de figuren. De data komt uit data/verhalen.json (gebouwd door tools/mythen.py)
// en data/figuren.json. Een verhaal opent als eigen pagina in verhalen/.
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const datum = (iso) => { const [j, m, d] = iso.split("-"); return `${+d} ${MAANDEN[m - 1]} ${j}`; };

let verhalen = [], figuren = {}, filter = "Alle", weergave = "verhalen";

function bewaar() { try { localStorage.setItem("mythen", JSON.stringify({ filter, weergave })); } catch {} }
function herstel() { try { ({ filter = "Alle", weergave = "verhalen" } = JSON.parse(localStorage.getItem("mythen")) || {}); } catch {} }

function chips() {
  const soorten = ["Alle", ...new Set([...verhalen.map((v) => v.mythologie), ...Object.values(figuren).map((f) => f.mythologie)])];
  if (!soorten.includes(filter)) filter = "Alle";
  $("#chips").classList.toggle("verborgen", soorten.length <= 2);
  $("#chips").innerHTML = soorten.map((s) => `<button class="${s === filter ? "actief" : ""}" data-s="${esc(s)}">${esc(s)}</button>`).join("");
}

function toonVerhalen() {
  const lijst = verhalen.filter((v) => filter === "Alle" || v.mythologie === filter);
  if (!lijst.length) { $("#verhalen").innerHTML = `<p class="leeg">Nog geen verhalen hier.</p>`; return; }
  $("#verhalen").innerHTML = lijst.map((v, i) => `
    <a class="kaart ${i === 0 ? "nieuw" : ""}" href="verhalen/${esc(v.slug)}.html">
      <div class="beeld" style="${v.beeld ? `background-image:url('${esc(v.beeld)}')` : ""}">${i === 0 ? `<span class="label">Nieuwste</span>` : ""}</div>
      <div class="tekst">
        <p class="meta">${esc(v.mythologie)} · ${datum(v.datum)} · ${v.leestijd} min</p>
        <h2>${esc(v.titel)}</h2>
        ${v.ondertitel ? `<p class="ondertitel">${esc(v.ondertitel)}</p>` : ""}
        ${i === 0 && v.samenvatting ? `<p class="samenvatting">${esc(v.samenvatting)}</p>` : ""}
        <div class="gezichten">${v.figuren.map((f) => `<img src="beelden/figuren/${esc(f)}.jpg" alt="${esc(figuren[f]?.naam || f)}" loading="lazy">`).join("")}</div>
      </div>
    </a>`).join("");
}

function toonFiguren() {
  const metBeeld = new Set(verhalen.flatMap((v) => v.figuren));
  const lijst = Object.entries(figuren).filter(([id, f]) => metBeeld.has(id) && (filter === "Alle" || f.mythologie === filter));
  if (!lijst.length) { $("#figuren").innerHTML = `<p class="leeg">Nog geen figuren hier.</p>`; return; }
  lijst.sort((a, b) => a[1].naam.localeCompare(b[1].naam, "nl"));
  $("#figuren").innerHTML = lijst.map(([id, f]) => `
    <button class="figuur" data-id="${esc(id)}">
      <img src="beelden/figuren/${esc(id)}.jpg" alt="" loading="lazy">
      <strong>${esc(f.naam)}</strong><span>${esc(f.mythologie)}</span>
    </button>`).join("");
}

function openFiguur(id) {
  const f = figuren[id];
  const in_ = verhalen.filter((v) => v.figuren.includes(id));
  $("#sheetInhoud").innerHTML = `
    <img src="beelden/figuren/${esc(id)}.jpg" alt="${esc(f.naam)}">
    <h2>${esc(f.naam)}</h2>
    <p class="titel">${esc(f.titel)}</p>
    <p>${esc(f.beschrijving)}</p>
    <h3>Komt voor in</h3>
    <ul>${in_.map((v) => `<li><a href="verhalen/${esc(v.slug)}.html#figuur-${esc(id)}">${esc(v.titel)}</a></li>`).join("")}</ul>`;
  $("#sheet").classList.remove("verborgen"); $("#sheetAchter").classList.remove("verborgen");
}
function sluitFiguur() { $("#sheet").classList.add("verborgen"); $("#sheetAchter").classList.add("verborgen"); }

function render() {
  $("#tabVerhalen").classList.toggle("actief", weergave === "verhalen");
  $("#tabFiguren").classList.toggle("actief", weergave === "figuren");
  $("#tabVerhalen").setAttribute("aria-selected", weergave === "verhalen");
  $("#tabFiguren").setAttribute("aria-selected", weergave === "figuren");
  $("#verhalen").classList.toggle("verborgen", weergave !== "verhalen");
  $("#figuren").classList.toggle("verborgen", weergave !== "figuren");
  chips();
  weergave === "verhalen" ? toonVerhalen() : toonFiguren();
  bewaar();
}

$("#tabVerhalen").onclick = () => { weergave = "verhalen"; render(); };
$("#tabFiguren").onclick = () => { weergave = "figuren"; render(); };
$("#chips").onclick = (e) => { const b = e.target.closest("button"); if (b) { filter = b.dataset.s; render(); } };
$("#figuren").onclick = (e) => { const b = e.target.closest(".figuur"); if (b) openFiguur(b.dataset.id); };
$("#sluit").onclick = sluitFiguur;
$("#sheetAchter").onclick = sluitFiguur;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") sluitFiguur(); });

(async () => {
  herstel();
  try {
    const [v, f] = await Promise.all(["data/verhalen.json", "data/figuren.json"].map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
    verhalen = v; figuren = f;
  } catch {
    $("#verhalen").innerHTML = `<p class="leeg">De verhalen konden niet geladen worden.</p>`;
  }
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
