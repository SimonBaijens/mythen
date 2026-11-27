// Mythen: de lijst met verhalen, de figuren en de pantheons. De data komt uit data/verhalen.json (gebouwd door
// tools/mythen.py), data/figuren.json en data/pantheons.json. Een verhaal opent als eigen pagina in verhalen/.
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const datum = (iso) => { const [j, m, d] = iso.split("-"); return `${+d} ${MAANDEN[m - 1]} ${j}`; };
const WEERGAVEN = ["verhalen", "figuren", "pantheon"];

let verhalen = [], figuren = {}, pantheons = {}, personen = {}, filter = "Alle", weergave = "verhalen";

function bewaar() { try { localStorage.setItem("mythen", JSON.stringify({ filter, weergave })); } catch {} }
function herstel() {
  try { ({ filter = "Alle", weergave = "verhalen" } = JSON.parse(localStorage.getItem("mythen")) || {}); } catch {}
  if (!WEERGAVEN.includes(weergave)) weergave = "verhalen";
  const h = location.hash.slice(1);
  if (WEERGAVEN.includes(h)) weergave = h;
}

// ---------- personen: figuren met portret, aangevuld met de nog onbekende figuren uit de pantheons ----------
const KLEUR = { vuur: "#c4622d", water: "#3f7fa8", aarde: "#8f7c3e", bos: "#4f7d45", lucht: "#7f9ab0", licht: "#d6b052",
  zon: "#e09a32", maan: "#9aa6bf", duister: "#5d4c80", dood: "#6f6359", storm: "#4f6886", liefde: "#bf6f82",
  oorlog: "#a63c2c", wijsheid: "#7d73b0", ijs: "#8fbccf" };

function bouwPersonen() {
  personen = {};
  for (const [myth, p] of Object.entries(pantheons))
    for (const [id, x] of Object.entries(p.personen || {})) personen[id] = { ...x, mythologie: myth, id };
  for (const [id, f] of Object.entries(figuren))
    personen[id] = { ...(personen[id] || {}), ...f, id, portret: true };
}
const persoon = (id) => personen[id] || { id, naam: id, titel: "", beschrijving: "" };
const initiaal = (p) => p.teken || (p.naam.replace(/^(De|Het|Een) /, "")[0] || "?").toUpperCase();

function medaillon(id, klas = "") {
  const p = persoon(id);
  if (p.portret) return `<span class="med ${klas}"><img src="beelden/figuren/${esc(id)}.jpg" alt="" loading="lazy"></span>`;
  return `<span class="med leeg-med ${p.groep ? "groep" : ""} ${klas}" style="--k:${KLEUR[p.element] || "#7a6a55"}"><span>${esc(initiaal(p))}</span></span>`;
}

// ---------- verhalen en figuren ----------
function chips() {
  const soorten = ["Alle", ...new Set([...verhalen.map((v) => v.mythologie), ...Object.values(figuren).map((f) => f.mythologie), ...Object.keys(pantheons)])];
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
    <button class="figuur" data-p="${esc(id)}">
      <img src="beelden/figuren/${esc(id)}.jpg" alt="" loading="lazy">
      <strong>${esc(f.naam)}</strong><span>${esc(f.mythologie)}</span>
    </button>`).join("");
}

// ---------- familiebanden, afgeleid uit de stambomen ----------
function stambomen(myth) { return (pantheons[myth]?.weergaven || []).filter((w) => w.soort === "stamboom"); }

function familie(id) {
  const p = persoon(id), r = { ouders: [], pleegouders: [], partners: [], kinderen: [], pleegkinderen: [], broers: [], uitleg: [] };
  const voeg = (lijst, x) => { if (x !== id && !lijst.includes(x)) lijst.push(x); };
  for (const w of stambomen(p.mythologie)) {
    for (const g of w.gezinnen) {
      const pleeg = g.soort === "pleeg";
      if (g.kinderen.includes(id)) {
        g.ouders.forEach((o) => voeg(pleeg ? r.pleegouders : r.ouders, o));
        if (!pleeg) g.kinderen.forEach((k) => voeg(r.broers, k));
        if (g.uitleg) r.uitleg.push(g.uitleg);
      }
      if (g.ouders.includes(id)) {
        g.kinderen.forEach((k) => voeg(pleeg ? r.pleegkinderen : r.kinderen, k));
        if (!pleeg) g.ouders.forEach((o) => voeg(r.partners, o));
      }
    }
    for (const [a, b] of w.huwelijken || []) { if (a === id) voeg(r.partners, b); if (b === id) voeg(r.partners, a); }
  }
  return r;
}

function rollen(id) {
  const p = persoon(id), uit = { rijken: [], domein: "" };
  for (const w of pantheons[p.mythologie]?.weergaven || []) {
    if (w.soort === "werelden") w.zones.forEach((z) => z.bewoners.includes(id) && uit.rijken.push(z.naam));
    if (w.soort === "hof") {
      if (w.midden.id === id) uit.domein = w.midden.domein;
      w.kring.forEach((k) => { if (k.id === id) uit.domein = k.domein; });
    }
  }
  return uit;
}

function openPersoon(id) {
  const p = persoon(id), fam = familie(id), rol = rollen(id);
  const in_ = verhalen.filter((v) => v.figuren.includes(id));
  const knoppen = (ids) => `<div class="familie">${ids.map((x) => `<button data-p="${esc(x)}">${medaillon(x, "klein")}<span>${esc(persoon(x).naam)}</span></button>`).join("")}</div>`;
  const blok = (kop, ids) => ids.length ? `<h3>${kop}</h3>${knoppen(ids)}` : "";
  const beeld = p.portret ? `<img class="groot" src="beelden/figuren/${esc(id)}.jpg" alt="${esc(p.naam)}">` : medaillon(id, "groot");
  $("#sheetInhoud").innerHTML = `
    ${beeld}
    <h2>${esc(p.naam)}</h2>
    <p class="titel">${esc(p.titel)}${p.mythologie ? ` · ${esc(p.mythologie)}` : ""}</p>
    <p>${esc(p.beschrijving)}</p>
    ${fam.uitleg.map((u) => `<p class="noot">${esc(u)}</p>`).join("")}
    ${rol.domein ? `<h3>Domein</h3><p>${esc(rol.domein[0].toUpperCase() + rol.domein.slice(1))}</p>` : ""}
    ${rol.rijken.length ? `<h3>Woont in</h3><p>${rol.rijken.map(esc).join(", ")}</p>` : ""}
    ${blok("Ouders", fam.ouders)}${blok("Pleegouders", fam.pleegouders)}${blok("Partners", fam.partners)}
    ${blok("Kinderen", fam.kinderen)}${blok("Pleegkinderen", fam.pleegkinderen)}${blok("Broers en zussen", fam.broers)}
    <h3>Komt voor in</h3>
    ${in_.length ? `<ul>${in_.map((v) => `<li><a href="verhalen/${esc(v.slug)}.html#figuur-${esc(id)}">${esc(v.titel)}</a></li>`).join("")}</ul>`
      : `<p class="noot">Nog geen verhaal. Als er een verhaal over ${esc(p.naam)} komt, krijgt deze figuur een eigen portret.</p>`}`;
  $("#sheet").classList.remove("verborgen"); $("#sheetAchter").classList.remove("verborgen");
  $("#sheet").scrollTop = 0;
}
function sluitFiguur() { $("#sheet").classList.add("verborgen"); $("#sheetAchter").classList.add("verborgen"); }

// ---------- pantheon ----------
function toonPantheon() {
  const el = $("#pantheon");
  const p = pantheons[filter];
  if (!p) {
    const lijst = Object.entries(pantheons);
    el.innerHTML = `<p class="pintro">Per mythologie een eigen kaart van de goden: een stamboom waar de familiebanden duidelijk zijn, en anders de rijken en wie er woont. Figuren zonder portret hebben nog geen verhaal; die komen vanzelf in beeld als ze in een verhaal meedoen.</p>
      <div class="pkaarten">${lijst.map(([m, x]) => {
        const ids = Object.keys(x.personen).concat(Object.keys(figuren).filter((f) => figuren[f].mythologie === m));
        const met = ids.filter((i) => persoon(i).portret);
        return `<button class="pkaart" data-s="${esc(m)}">
          <p class="meta">${esc(m)}</p><h2>${esc(x.kop)}</h2>
          <p>${esc(x.weergaven.map((w) => w.titel).join(" · "))}</p>
          <div class="gezichten">${met.slice(0, 7).map((i) => medaillon(i)).join("")}</div>
          <p class="tel">${ids.length} figuren, ${met.length} met portret</p></button>`;
      }).join("")}</div>`;
    return;
  }
  el.innerHTML = `<header class="pkop"><p class="meta">${esc(filter)}</p><h2>${esc(p.kop)}</h2><p>${esc(p.intro)}</p></header>` +
    p.weergaven.map((w, i) => `<section class="weergave" data-i="${i}"><h3>${esc(w.titel)}</h3>${w.intro ? `<p class="wintro">${esc(w.intro)}</p>` : ""}<div class="winhoud"></div></section>`).join("");
  el.querySelectorAll(".weergave").forEach((s) => {
    const w = p.weergaven[s.dataset.i], doel = s.querySelector(".winhoud");
    if (w.soort === "stamboom") tekenBoom(w, doel);
    else if (w.soort === "werelden") tekenWerelden(w, doel);
    else if (w.soort === "hof") tekenHof(w, doel);
  });
}

function knoop(id, onder = "", klas = "") {
  const p = persoon(id);
  return `<button class="knoop ${p.portret ? "bekend" : "onbekend"} ${klas}" data-p="${esc(id)}" title="${esc(p.titel)}">
    ${medaillon(id)}<strong>${esc(p.naam)}</strong>${onder ? `<small>${esc(onder)}</small>` : ""}</button>`;
}

// Stamboom: elke figuur staat op een vaste plek [kolom, rij]. Een gezin hangt onder het paar als de ouders naast
// elkaar staan, en anders onder de eerste ouder (met de tweede ouder als bijschrift bij het kind).
const B = 108, H = 172, RAND = 28, PORT = 64;
function tekenBoom(w, doel) {
  const pl = w.plaats, ids = Object.keys(pl);
  const minK = Math.min(...ids.map((i) => pl[i][0])), maxK = Math.max(...ids.map((i) => pl[i][0]));
  const maxR = Math.max(...ids.map((i) => pl[i][1]));
  const X = (i) => RAND + (pl[i][0] - minK) * B + B / 2, Y = (i) => RAND + pl[i][1] * H;
  const breed = RAND * 2 + (maxK - minK + 1) * B, hoog = RAND * 2 + maxR * H + PORT + 56;
  const naast = (a, b) => pl[a] && pl[b] && pl[a][1] === pl[b][1] && Math.abs(pl[a][0] - pl[b][0]) <= 1.05;

  const onder = {}, lijnen = [], paren = new Set();
  const bijschrift = (k, t) => { if (t) (onder[k] ||= []).includes(t) || onder[k].push(t); };
  const groepen = new Map();
  for (const g of w.gezinnen) {
    if (g.verborgen) continue;
    const ouders = g.ouders.filter((o) => pl[o]), kids = g.kinderen.filter((k) => pl[k]);
    if (!ouders.length || !kids.length) continue;
    let sleutel, sx, sy;
    if (ouders.length > 1 && naast(ouders[0], ouders[1])) {
      sleutel = [...ouders].sort().join("+"); sx = (X(ouders[0]) + X(ouders[1])) / 2; sy = Y(ouders[0]) + PORT / 2;
      paren.add(sleutel);
    } else {
      sleutel = ouders[0]; sx = X(ouders[0]); sy = Y(ouders[0]) + PORT + 50;
    }
    const tweede = g.ouders.length > 1 && !naast(g.ouders[0], g.ouders[1]) ? persoon(g.ouders[1]).naam : "";
    kids.forEach((k) => bijschrift(k, g.label || (tweede ? `met ${tweede}` : "")));
    const gr = groepen.get(sleutel) || { sx, sy, kids: [] };
    kids.forEach((k) => gr.kids.push({ k, stippel: !!g.stippel }));
    groepen.set(sleutel, gr);
  }
  // gestapelde horizontale balken per kinderrij, zodat ze elkaar niet raken
  const perRij = {};
  for (const gr of groepen.values()) {
    const rij = Math.min(...gr.kids.map((c) => pl[c.k][1]));
    (perRij[rij] ||= []).push(gr); gr.rij = rij;
  }
  for (const lijst of Object.values(perRij)) {
    lijst.sort((a, b) => a.sx - b.sx).forEach((gr, i) => {
      const balk = RAND + gr.rij * H - 16 - (i % 3) * 9;
      const xs = gr.kids.map((c) => X(c.k)).concat(gr.sx);
      const alles = gr.kids.every((c) => c.stippel);
      lijnen.push(`<path class="lijn ${alles ? "stip" : ""}" d="M${gr.sx} ${gr.sy}V${balk}M${Math.min(...xs)} ${balk}H${Math.max(...xs)}"/>`);
      gr.kids.forEach((c) => lijnen.push(`<path class="lijn ${c.stippel ? "stip" : ""}" d="M${X(c.k)} ${balk}V${Y(c.k) - 2}"/>`));
    });
  }
  // huwelijken: naast elkaar een rechte lijn, verder weg een gouden draad
  const huw = w.gezinnen.filter((g) => !g.verborgen && g.ouders.length > 1).map((g) => g.ouders.slice(0, 2)).concat(w.huwelijken || []);
  const gedaan = new Set();
  for (const [a, b] of huw) {
    const s = [a, b].sort().join("+");
    if (gedaan.has(s) || !pl[a] || !pl[b]) continue;
    gedaan.add(s);
    if (naast(a, b)) {
      const [l, r] = X(a) < X(b) ? [a, b] : [b, a];
      lijnen.push(`<path class="huw" d="M${X(l) + PORT / 2} ${Y(l) + PORT / 2}H${X(r) - PORT / 2}"/>`);
    } else if ((w.huwelijken || []).some(([p, q]) => [p, q].sort().join("+") === s)) {
      const [x1, y1, x2] = [X(a), Y(a) + PORT + 48, X(b)];
      if (pl[a][1] === pl[b][1]) {
        lijnen.push(`<path class="draad" d="M${x1} ${y1}C${x1} ${y1 + 26} ${x2} ${y1 + 26} ${x2} ${y1}"/>`);
      } else {
        const zij = x2 > x1 ? -1 : 1, ey = Y(b) + PORT / 2, ex = x2 + zij * (PORT / 2 + 3);
        lijnen.push(`<path class="draad" d="M${x1} ${y1}C${x1} ${ey} ${ex + zij * 30} ${ey} ${ex} ${ey}"/>`);
      }
    }
  }
  const knopen = ids.map((i) => `<div class="plek" style="left:${X(i) - B / 2 + 4}px;top:${Y(i)}px">${knoop(i, (onder[i] || []).join(" · "))}</div>`).join("");
  doel.innerHTML = `
    <div class="boombalk"><button data-z="-1" aria-label="Uitzoomen">−</button><button data-z="1" aria-label="Inzoomen">+</button><button data-z="0">Passend</button></div>
    <div class="boomvenster"><div class="boommaat"><div class="boom" style="width:${breed}px;height:${hoog}px">
      <svg width="${breed}" height="${hoog}" aria-hidden="true">${lijnen.join("")}</svg>${knopen}</div></div></div>`;
  zoombaar(doel, breed, hoog, w.start && pl[w.start] ? [X(w.start), Y(w.start) + PORT / 2] : null);
}

function zoombaar(doel, breed, hoog, focus) {
  const venster = doel.querySelector(".boomvenster"), maat = doel.querySelector(".boommaat"), boom = doel.querySelector(".boom");
  let schaal = 1;
  const passend = () => Math.max(0.25, Math.min(1, (venster.clientWidth - 4) / breed));
  const zet = (s, cx = venster.clientWidth / 2, cy = venster.clientHeight / 2) => {
    const fx = (venster.scrollLeft + cx) / schaal, fy = (venster.scrollTop + cy) / schaal;
    schaal = Math.max(0.25, Math.min(1.6, s));
    boom.style.transform = `scale(${schaal})`;
    maat.style.width = `${breed * schaal}px`; maat.style.height = `${hoog * schaal}px`;
    venster.style.height = `${Math.min(hoog * schaal + 4, window.innerHeight * 0.72)}px`;
    venster.scrollLeft = fx * schaal - cx; venster.scrollTop = fy * schaal - cy;
  };
  zet(Math.max(passend(), 0.72));
  if (focus) { venster.scrollLeft = focus[0] * schaal - venster.clientWidth / 2; venster.scrollTop = focus[1] * schaal - 90; }
  doel.querySelector(".boombalk").onclick = (e) => {
    const z = e.target.closest("button")?.dataset.z; if (z === undefined) return;
    if (z === "0") { zet(passend()); venster.scrollLeft = 0; } else zet(schaal * (z === "1" ? 1.25 : 0.8));
  };
  venster.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return; e.preventDefault();
    const r = venster.getBoundingClientRect(); zet(schaal * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // slepen met de muis (aanraken scrolt al vanzelf)
  let sleep = null;
  venster.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    sleep = { x: e.clientX, y: e.clientY, l: venster.scrollLeft, t: venster.scrollTop, bewogen: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!sleep) return;
    const dx = e.clientX - sleep.x, dy = e.clientY - sleep.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { sleep.bewogen = true; venster.classList.add("sleept"); }
    venster.scrollLeft = sleep.l - dx; venster.scrollTop = sleep.t - dy;
  });
  window.addEventListener("pointerup", () => {
    if (sleep?.bewogen) venster.addEventListener("click", (e) => e.stopPropagation(), { capture: true, once: true });
    sleep = null; venster.classList.remove("sleept");
  });
}

function tekenWerelden(w, doel) {
  doel.innerHTML = `<div class="werelden">${w.zones.map((z) => `
    <div class="zone toon-${esc(z.toon || "aarde")}">
      <h4>${esc(z.naam)}</h4>${z.sub ? `<p class="sub">${esc(z.sub)}</p>` : ""}
      <p>${esc(z.tekst)}</p>
      <div class="bewoners">${z.bewoners.map((i) => knoop(i)).join("")}</div>
    </div>`).join("")}</div>`;
}

function tekenHof(w, doel) {
  const n = w.kring.length;
  doel.innerHTML = `<div class="hof">
    <div class="hofplek midden">${knoop(w.midden.id, w.midden.domein, "groot")}</div>
    ${w.kring.map((k, i) => {
      const a = (i / n) * 2 * Math.PI;
      return `<div class="hofplek" style="--x:${(50 + 41 * Math.sin(a)).toFixed(2)}%;--y:${(50 - 41 * Math.cos(a)).toFixed(2)}%">${knoop(k.id, k.domein)}</div>`;
    }).join("")}</div>${w.noot ? `<p class="noot">${esc(w.noot)}</p>` : ""}`;
}

// ---------- algemeen ----------
function render() {
  for (const w of WEERGAVEN) {
    const knop = $(`#tab${w[0].toUpperCase()}${w.slice(1)}`);
    knop.classList.toggle("actief", weergave === w); knop.setAttribute("aria-selected", weergave === w);
    $(`#${w}`).classList.toggle("verborgen", weergave !== w);
  }
  document.body.classList.toggle("breed", weergave === "pantheon");
  chips();
  ({ verhalen: toonVerhalen, figuren: toonFiguren, pantheon: toonPantheon })[weergave]();
  bewaar();
}

for (const w of WEERGAVEN) $(`#tab${w[0].toUpperCase()}${w.slice(1)}`).onclick = () => { weergave = w; history.replaceState(null, "", `#${w}`); render(); };
$("#chips").onclick = (e) => { const b = e.target.closest("button"); if (b) { filter = b.dataset.s; render(); } };
document.addEventListener("click", (e) => {
  const kaart = e.target.closest(".pkaart");
  if (kaart) { filter = kaart.dataset.s; render(); window.scrollTo({ top: 0 }); return; }
  const b = e.target.closest("[data-p]");
  if (b) openPersoon(b.dataset.p);
});
$("#sluit").onclick = sluitFiguur;
$("#sheetAchter").onclick = sluitFiguur;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") sluitFiguur(); });

(async () => {
  herstel();
  try {
    const [v, f, p] = await Promise.all(["data/verhalen.json", "data/figuren.json", "data/pantheons.json"]
      .map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.json())));
    verhalen = v; figuren = f; pantheons = p;
  } catch {
    $("#verhalen").innerHTML = `<p class="leeg">De verhalen konden niet geladen worden.</p>`;
  }
  bouwPersonen();
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
