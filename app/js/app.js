/* =========================================================
   Detona Park App — protótipo navegável
   Sem servidor: o estado fica no navegador (localStorage) e o
   "relógio do parque" é simulado para dar para demonstrar um
   dia inteiro em poucos minutos.
   ========================================================= */
(() => {
  "use strict";

  const { ISLANDS, FAQ, ORDERS, icon } = window.PARK;
  const { ATTRACTIONS, SCHEDULE, TICKETS, REWARDS, island } = window.APP;

  /* ---------- utilidades ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.floor(m % 60))}`;
  const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const uid = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  const ascii = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const attr = (id) => ATTRACTIONS.find((a) => a.id === id);
  const ev = (id) => SCHEDULE.find((e) => e.id === id);
  const ttype = (id) => TICKETS.find((t) => t.id === id);
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "visitante";
  const initial = (n) => first(n).charAt(0).toUpperCase();
  const OPEN = 9 * 60, CLOSE = 18 * 60, ERUPT = 17 * 60;
  const RING = ISLANDS.map((i) => i.id);

  const dayISO = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const todayISO = () => dayISO(0);
  function dateLabel(iso) {
    if (iso === dayISO(0)) return "Hoje";
    if (iso === dayISO(1)) return "Amanhã";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  }

  /* ---------- estado ---------- */
  const KEY = "dp-app-v1";
  const fresh = () => ({
    v: 1, onboarded: false, user: null, group: [], tickets: [],
    wallet: { balance: 0, tokens: 0, history: [] }, earned: 0,
    queue: null, reservations: [], reminders: {}, plan: null,
    watch: { paired: false, id: null, vibrate: true, gps: true, pay: true, ticket: true },
    notif: { fila: true, agenda: true, dicas: true },
    notes: [], redeemed: [], done: [], seen: {}, rating: 0,
    clock: 10 * 60 + 20, speed: 20,
  });
  let S = load();
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) return { ...fresh(), ...s };
    } catch (e) { /* sem armazenamento: começa do zero */ }
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignora */ } }

  // rascunhos de fluxos com várias etapas (não precisam ser salvos)
  let D = { filter: "all", buy: null, plan: null, pair: 0, topup: null, slot: null, face: "auto", ob: 0 };

  /* ---------- regras do parque ---------- */
  const todays = () => S.tickets.filter((t) => t.date === todayISO());
  const hasToday = () => todays().length > 0;
  const party = () => Math.max(1, todays().length);
  const resLimit = () => todays().reduce((m, t) => Math.max(m, ttype(t.type).reservas), 0);
  const liveRes = () => S.reservations.filter((r) => r.status === "booked" || r.status === "ready");
  const groupMinH = () => (S.group.length ? Math.min(...S.group.map((g) => g.h)) : 170);
  const blocked = (a) => S.group.filter((g) => g.h < a.minH);

  // Espera simulada: pico no meio da tarde + variação a cada 15 min
  function waitOf(a, t = S.clock) {
    if (t < OPEN || t >= CLOSE) return null;
    const h = t / 60;
    const peak = 0.5 + 0.8 * Math.exp(-((h - 14.5) ** 2) / 5);
    const x = Math.sin(Math.floor(t / 15) * 12.9898 + a.base * 7.233 + a.id.length * 3.1) * 43758.5453;
    const n = x - Math.floor(x);
    return Math.max(0, Math.round((a.base * (peak + (n - 0.5) * 0.35)) / 5) * 5);
  }
  const waitCls = (w) => (w == null ? "" : w <= 15 ? "lo" : w <= 35 ? "mid" : "hi");
  function trendOf(a) {
    const now = waitOf(a), prev = waitOf(a, S.clock - 15);
    if (now == null || prev == null) return "";
    return now > prev ? "↑" : now < prev ? "↓" : "";
  }
  const waitHTML = (a) => { const w = waitOf(a); return w == null ? "<b>—</b><small>fechado</small>" : w === 0 ? "<b>0</b><small>sem fila</small>" : `<b>${w}</b><small>min ${trendOf(a)}</small>`; };
  const waitTxt = (a) => { const w = waitOf(a); return w == null ? "fechado" : w === 0 ? "sem fila" : `${w} min`; };
  const waitBox = (a) => `<span class="wait ${waitCls(waitOf(a))}" data-wait="${a.id}">${waitHTML(a)}</span>`;
  const meter = (n, c) => `<span class="meter" style="--c:${c}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= n ? "on" : ""}"></i>`).join("")}</span>`;

  function eruptTxt() {
    const d = ERUPT - S.clock;
    if (d <= 0) return "BOOM!";
    if (d < 60) return `${Math.ceil(d)} min`;
    return `${Math.floor(d / 60)}h ${pad(Math.floor(d % 60))}min`;
  }

  /* ---------- QR e arte em pixel ---------- */
  function qr(text) {
    try {
      const q = window.qrcode(0, "M");
      q.addData(ascii(text));
      q.make();
      return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) {
      return `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#ddd"/></svg>`;
    }
  }
  const tq = (t) => `DETONAPARK|${t.code}|${t.type}|${t.date}|${t.holder}`;
  function pix(seed, n, rows) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const x = Math.sin((i + 1) * 91.17 + seed * 13.7) * 43758.5453;
      const r = x - Math.floor(x);
      const row = Math.floor(i / (n / rows));
      const o = r * (0.25 + (row / rows) * 0.75);
      out += `<i style="opacity:${Math.max(0.06, o).toFixed(2)}"></i>`;
    }
    return `<div class="art-pix">${out}</div>`;
  }
  const seedOf = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

  /* =========================================================
     Navegação
     ========================================================= */
  const ROOTS = ["home", "park", "agenda", "wallet"];
  let stack = [{ name: "home", p: {} }];
  const cur = () => stack[stack.length - 1];
  function go(name, p = {}) { closeSheet(); stack.push({ name, p }); render("fwd"); }
  function back() { closeSheet(); if (stack.length > 1) { stack.pop(); render("back"); } }
  function tab(name, p = {}) { closeSheet(); stack = [{ name, p }]; render("tab"); }
  function navTo(t) { if (!t) return; const [name, p = {}] = t; ROOTS.includes(name) ? tab(name, p) : go(name, p); }
  function refresh() {
    const sc = $(".scroll"), top = sc ? sc.scrollTop : 0;
    render("");
    const sc2 = $(".scroll");
    if (sc2) sc2.scrollTop = top;
  }

  function render(dir = "") {
    const view = $("#view");
    const tabbar = $("#tabbar");
    if (!S.onboarded) {
      tabbar.classList.add("hide");
      view.innerHTML = `<section class="screen ${dir ? "in-" + dir : ""}">${onboarding()}</section>`;
      updateLive();
      return;
    }
    const { name, p } = cur();
    const out = (SCREENS[name] || SCREENS.home)(p);
    const root = stack.length === 1;
    const tabs = out.tabs !== false;
    const head = out.home ? "" : `<header class="top">
        ${root ? "" : `<button class="top-back" data-act="back" aria-label="Voltar">${icon("back")}</button>`}
        <h1 class="top-title ${root ? "big" : ""}">${out.title}</h1>
        ${out.right || (root ? topRight() : "")}
      </header>`;
    view.innerHTML = `<section class="screen ${dir ? "in-" + dir : ""} ${tabs ? "" : "no-tabs"}">${head}<div class="scroll">${out.body}</div></section>`;
    tabbar.classList.toggle("hide", !tabs);
    const on = stack[0].name;
    const T = (id, ico, label) => `<button class="tab ${on === id ? "on" : ""}" data-tab="${id}">${icon(ico)}<span>${label}</span></button>`;
    tabbar.innerHTML = T("home", "home", "Início") + T("park", "map", "Parque") +
      `<button class="tab-qr" data-act="openQR" aria-label="Meu ingresso">${icon("qr")}</button>` +
      T("agenda", "calendar", "Agenda") + T("wallet", "wallet", "Carteira");
    if (out.mount) out.mount(view);
    updateLive();
  }
  const topRight = () => `<button class="icon-btn" data-go="notes" aria-label="Notificações">${icon("bell")}<span data-live="unread"></span></button>
    <button class="avatar" data-go="profile" aria-label="Perfil" style="width:40px;height:40px">${esc(initial(S.user && S.user.name))}</button>`;

  /* ---------- folha inferior e avisos ---------- */
  let gameTimer = null, gameEnd = null;
  function sheet(html) { $("#sheetBody").innerHTML = html; $("#sheet").hidden = false; updateLive(); }
  function closeSheet() { $("#sheet").hidden = true; $("#sheetBody").innerHTML = ""; clearInterval(gameTimer); clearTimeout(gameEnd); }
  const sheetHead = (t) => `<div class="sheet-h"><h2>${t}</h2><button class="sheet-x" data-act="closeSheet" aria-label="Fechar">${icon("close")}</button></div>`;

  let bannerT;
  function banner({ title, body, ico = "bell", c, go: target, watch }) {
    const b = $("#banner");
    b.innerHTML = `<span class="ico" style="--c:${c || "var(--red-hi)"}">${icon(ico)}</span>
      <div class="row-main"><p class="banner-t">${esc(title)}</p>${body ? `<p class="banner-s">${esc(body)}</p>` : ""}
      ${watch ? `<p class="banner-w">${icon("vibrate")} Seu relógio vibrou</p>` : ""}</div>
      <button class="banner-x" data-act="closeBanner" aria-label="Fechar aviso">${icon("close")}</button>`;
    b.hidden = false;
    b.style.animation = "none"; void b.offsetHeight; b.style.animation = "";
    b.onclick = (e) => { if (e.target.closest(".banner-x")) return; hideBanner(); navTo(target); };
    clearTimeout(bannerT);
    bannerT = setTimeout(hideBanner, 5200);
  }
  function hideBanner() { $("#banner").hidden = true; }
  const toast = (title, body) => banner({ title, body, ico: "check", c: "var(--green)" });

  function notify(n) {
    const watch = S.watch.paired && S.watch.vibrate;
    S.notes.unshift({ id: uid(), at: S.clock, read: false, ...n });
    S.notes = S.notes.slice(0, 40);
    save();
    if (!n.cat || S.notif[n.cat] !== false) {
      banner({ ...n, watch });
      if (watch) $$(".watch").forEach((w) => { w.classList.remove("buzz"); void w.offsetWidth; w.classList.add("buzz"); });
    }
    updateLive();
  }

  function earn(n, why) {
    S.wallet.tokens += n;
    S.earned += n;
    S.wallet.history.unshift({ t: why, tok: n, at: S.clock });
    save();
  }

  /* =========================================================
     Tempo do parque e gatilhos de notificação
     ========================================================= */
  const SPEEDS = [1, 20, 60];
  const speedTxt = () => (S.speed === 1 ? "tempo real" : `${S.speed}× mais rápido`);

  function tick() {
    if (!S.onboarded) return;
    if (S.clock < CLOSE) S.clock = Math.min(CLOSE, S.clock + S.speed / 60);
    triggers();
    updateLive();
    save();
  }

  function once(k, fn) { if (!S.seen[k]) { S.seen[k] = 1; fn(); } }

  function triggers() {
    const t = S.clock;
    let dirty = false;
    // lembretes da programação
    SCHEDULE.forEach((e) => {
      const at = toMin(e.t);
      if (S.reminders[e.id] && t >= at - 15 && t < at) {
        once("rem:" + e.id, () => notify({
          cat: "agenda", ico: "bell", c: island(e.island).color, go: ["agenda", { seg: "prog" }],
          title: `${e.title} em ${Math.max(1, Math.ceil(at - t))} min`,
          body: `${island(e.island).name}. ${S.watch.paired && S.watch.gps ? "O relógio mostra o caminho." : "Toque para ver a programação."}`,
        }));
      }
    });
    if (t >= ERUPT - 30 && t < ERUPT) once("erupt30", () => notify({ cat: "agenda", ico: "volcano", c: "var(--gold)", go: ["home"], title: "Erupção em 30 minutos", body: "Garanta um bom lugar na Praça Doce para o grande final." }));
    if (t >= ERUPT && t < ERUPT + 15) once("erupt", () => { notify({ cat: "agenda", ico: "volcano", c: "var(--gold)", go: ["home"], title: "O vulcão entrou em erupção!", body: "Faça check-in na Praça Doce e ganhe 3 fichas." }); dirty = true; });
    if (t >= ERUPT + 15) once("eruptEnd", () => { dirty = true; });

    // fila virtual
    const q = S.queue;
    if (q) {
      const a = attr(q.attr);
      if (q.status === "waiting" && q.readyAt - t <= 10 && q.readyAt - t > 0) once("q10:" + q.id, () => notify({ cat: "fila", ico: "timer", c: island(a.island).color, go: ["queue"], title: "Faltam 10 minutos", body: `Comece a ir para ${a.name}.` }));
      if (q.status === "waiting" && t >= q.readyAt) {
        q.status = "ready";
        notify({ cat: "fila", ico: "timer", c: "var(--green)", go: ["queue"], title: "É a sua vez!", body: `${a.name}: você tem 15 minutos para entrar.` });
        dirty = true;
      } else if (q.status === "ready" && t >= q.readyAt + 15) {
        q.status = "expired";
        notify({ cat: "fila", ico: "alert", c: "var(--red-hi)", go: ["queue"], title: "Sua vez passou", body: `O tempo para entrar em ${a.name} acabou. Você pode entrar na fila de novo.` });
        dirty = true;
      }
    }

    // reservas de horário
    S.reservations.forEach((r) => {
      const a = attr(r.attr);
      if (r.status === "booked" && t >= r.t - 15 && t < r.t) once("r15:" + r.id, () => notify({ cat: "fila", ico: "calendar", c: island(a.island).color, go: ["agenda", { seg: "res" }], title: `Sua reserva é às ${hm(r.t)}`, body: `${a.name} · entrada expressa para ${r.party} ${r.party > 1 ? "pessoas" : "pessoa"}.` }));
      if (r.status === "booked" && t >= r.t) {
        r.status = "ready";
        notify({ cat: "fila", ico: "calendar", c: "var(--green)", go: ["agenda", { seg: "res" }], title: "Sua reserva começou", body: `Vá até a entrada expressa de ${a.name} e mostre o QR.` });
        dirty = true;
      } else if (r.status === "ready" && t >= r.t + 20) { r.status = "missed"; dirty = true; }
    });

    // dicas
    if (t >= 12 * 60 && t < 13 * 60) once("lunch", () => { const a = attr("carrinho"); notify({ cat: "dicas", ico: "info", c: island(a.island).color, go: ["attraction", { id: a.id }], title: "Hora do lanche", body: `O Carrinho de Doces está com ${waitOf(a)} min de espera. Pague com a carteira do app.` }); });
    if (t >= 15 * 60 && t < 16 * 60) once("tip15", () => {
      const ok = ATTRACTIONS.filter((a) => a.intensity >= 3 && blocked(a).length === 0);
      const best = ok.sort((x, y) => waitOf(x) / x.base - waitOf(y) / y.base)[0];
      if (best) notify({ cat: "dicas", ico: "info", c: island(best.island).color, go: ["attraction", { id: best.id }], title: `Boa hora para ${best.name}`, body: `A espera caiu para ${waitOf(best)} min.` });
    });
    if (t >= CLOSE) once("closed", () => { notify({ cat: "agenda", ico: "star", c: "var(--gold)", go: ["home"], title: "O parque fechou", body: "Veja o resumo do seu dia e as suas fotos." }); dirty = true; });

    if (dirty) refresh();
  }

  function updateLive() {
    $$('[data-live="clock"]').forEach((e) => (e.textContent = hm(S.clock)));
    $$('[data-live="speed"]').forEach((e) => (e.textContent = speedTxt()));
    $$('[data-live="erupt"]').forEach((e) => (e.textContent = eruptTxt()));
    const unread = S.notes.filter((n) => !n.read).length;
    $$('[data-live="unread"]').forEach((e) => { e.className = unread ? "dot" : ""; e.textContent = unread || ""; });
    $$("[data-wait]").forEach((e) => { const a = attr(e.dataset.wait); e.className = "wait " + waitCls(waitOf(a)); e.innerHTML = waitHTML(a); });
    $$("[data-waittxt]").forEach((e) => { const a = attr(e.dataset.waittxt); e.textContent = waitTxt(a); e.style.color = { lo: "var(--green)", mid: "var(--gold)", hi: "var(--red-hi)" }[waitCls(waitOf(a))] || ""; });
    $$("[data-wt]").forEach((e) => { const w = waitOf(attr(e.dataset.wt)); e.textContent = w == null ? "—" : `${w}'`; });
    $$("[data-face]").forEach((e) => (e.innerHTML = face(e.dataset.face)));
    const q = S.queue;
    if (q) {
      const rem = Math.max(0, Math.ceil(q.readyAt - S.clock));
      $$('[data-live="qrem"]').forEach((e) => (e.textContent = rem));
      $$('[data-live="qpos"]').forEach((e) => (e.textContent = Math.max(1, Math.ceil(rem / 1.5))));
      $$('[data-live="quntil"]').forEach((e) => (e.textContent = hm(q.readyAt + 15)));
      const prog = q.status === "waiting" ? Math.min(1, (S.clock - q.joinedAt) / q.total) : 1;
      $$('[data-live="qring"]').forEach((e) => (e.style.strokeDashoffset = (1 - prog) * 597));
    }
    const sb = $("#sbWatch");
    if (sb) sb.classList.toggle("on", S.watch.paired);
  }

  /* =========================================================
     Relógio: o que aparece na tela dele
     ========================================================= */
  function nextThing() {
    const t = S.clock;
    const r = liveRes().filter((x) => x.t + 20 >= t).sort((a, b) => a.t - b.t)[0];
    const planItem = S.plan && S.plan.items.find((i) => i.t >= t - 5);
    const evItem = SCHEDULE.find((e) => toMin(e.t) >= t);
    const opts = [];
    if (r) opts.push({ t: r.t, label: attr(r.attr).name, k: "RESERVA" });
    if (planItem) opts.push({ t: planItem.t, label: itemName(planItem), k: "ROTEIRO" });
    if (evItem) opts.push({ t: toMin(evItem.t), label: evItem.title, k: "PROGRAMAÇÃO" });
    return opts.sort((a, b) => a.t - b.t)[0];
  }
  function face(kind) {
    const q = S.queue;
    if (kind === "auto") kind = q && q.status !== "done" ? "fila" : "agora";
    if (kind === "fila") {
      if (!q) return `<p class="w-k">FILA VIRTUAL</p><p class="w-big">—</p><p class="w-s">você não está<br>em nenhuma fila</p>`;
      const a = attr(q.attr);
      if (q.status === "ready") return `<p class="w-k">SUA VEZ!</p><p class="w-big"><span class="w-arrow">↑</span></p><p class="w-s">${esc(a.name)}<br>${S.watch.gps ? "siga a seta · 120 m" : "vá até a entrada"}</p>`;
      if (q.status === "expired") return `<p class="w-k" style="color:var(--red-hi)">TEMPO ESGOTADO</p><p class="w-big">!</p><p class="w-s">entre na fila<br>de novo pelo app</p>`;
      return `<p class="w-k">FILA VIRTUAL</p><p class="w-big">${Math.max(0, Math.ceil(q.readyAt - S.clock))}</p><p class="w-s">min · ${esc(a.name)}</p>`;
    }
    if (kind === "ingresso") {
      const t = todays()[0];
      if (!t) return `<p class="w-k">INGRESSO</p><p class="w-s">nenhum ingresso<br>para hoje</p>`;
      return `<div class="w-qr">${qr(tq(t))}</div><p class="w-s">${esc(ttype(t.type).name)}</p>`;
    }
    if (kind === "roteiro") {
      const items = S.plan ? S.plan.items.filter((i) => i.t >= S.clock - 5).slice(0, 3) : SCHEDULE.filter((e) => toMin(e.t) >= S.clock).slice(0, 3).map((e) => ({ type: "event", id: e.id, t: toMin(e.t) }));
      if (!items.length) return `<p class="w-k">ROTEIRO</p><p class="w-s">fim do dia!</p>`;
      return `<p class="w-k">${S.plan ? "MEU ROTEIRO" : "HOJE NO PARQUE"}</p><ul class="w-list">${items.map((i) => `<li><b>${hm(i.t)}</b>${esc(itemName(i))}</li>`).join("")}</ul>`;
    }
    if (kind === "placar") return `<p class="w-k">PLACAR</p><p class="w-big">${S.wallet.tokens}</p><p class="w-s">${S.wallet.tokens === 1 ? "ficha" : "fichas"} · ${S.done.length} atrações</p>`;
    // agora
    const n = nextThing();
    if (S.clock >= CLOSE) return `<p class="w-k">ATÉ A PRÓXIMA!</p><p class="w-big">${S.done.length}</p><p class="w-s">atrações hoje</p>`;
    return `<p class="w-k">${n ? "PRÓXIMO · " + n.k : "AGORA"}</p><p class="w-big" style="font-size:34px">${hm(n ? n.t : S.clock)}</p><p class="w-s">${esc(n ? n.label : "aproveite o parque")}</p>`;
  }
  const watchHTML = (kind, sm) => `<div class="watch ${sm ? "sm" : ""}"><span class="watch-strap top"></span><div class="watch-body"><span class="watch-crown"></span><div class="watch-screen" data-face="${kind}">${face(kind)}</div></div><span class="watch-strap bottom"></span></div>`;

  /* =========================================================
     Onboarding (primeiro acesso)
     ========================================================= */
  const OB = [
    { art: `<div class="pix-logo"><i></i><i></i><i></i><i></i></div>`, k: "Bem-vindo ao Detona Park", t: "Seu dia no parque, na palma da mão.", d: "Ingressos, filas, reservas, carteira e o relógio do parque num só lugar." },
    { art: `<div class="big-ico">${icon("qr")}</div>`, k: "Ingresso digital", t: "Seu QR Code sempre à mão.", d: "Ele abre direto no botão central do app e também aparece no relógio." },
    { art: `<div class="big-ico">${icon("timer")}</div>`, k: "Filas e reservas", t: "Menos fila, mais jogo.", d: "Veja a espera de cada atração em tempo real, entre na fila virtual e reserve horários." },
    { art: watchHTML("roteiro"), k: "Relógio do parque", t: "O relógio avisa você.", d: "Pareie o relógio para receber a sua vez, lembretes, o caminho até a atração e pagar com um toque." },
  ];
  function onboarding() {
    const i = D.ob;
    if (i < OB.length) {
      const s = OB[i];
      return `<div class="onb">
        <button class="onb-skip" data-act="obDemo">Ver demonstração completa</button>
        <div class="onb-art">${s.art}</div>
        <div class="onb-copy"><p class="eyebrow">${s.k}</p><h1 class="h1">${s.t}</h1><p class="lead">${s.d}</p></div>
        <div class="steps" style="margin-bottom:18px">${OB.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>
        <div class="onb-cta">
          <button class="btn btn-primary btn-block" data-act="obNext">${i === OB.length - 1 ? "Criar minha conta" : "Continuar"}</button>
          ${i > 0 ? `<button class="btn btn-ghost btn-block" data-act="obPrev">Voltar</button>` : ""}
        </div>
      </div>`;
    }
    if (i === OB.length) {
      return `<div class="onb">
        <button class="onb-skip" data-act="obPrev">Voltar</button>
        <div class="onb-copy" style="margin-top:20px"><p class="eyebrow">Sua conta</p><h1 class="h1">Como podemos te chamar?</h1><p class="lead">Usamos seu nome no ingresso e nas mensagens do relógio.</p></div>
        <div class="stack">
          <div class="field"><label for="obName">Nome</label><input class="input" id="obName" autocomplete="given-name" placeholder="Seu nome" value="${esc(S.user ? S.user.name : "")}" /></div>
          <div class="field"><label for="obEmail">E-mail (opcional)</label><input class="input" id="obEmail" type="email" autocomplete="email" placeholder="voce@email.com" /></div>
          <div class="field"><label for="obH">Sua altura em cm (para checar as atrações)</label><input class="input" id="obH" type="number" inputmode="numeric" min="80" max="220" placeholder="170" /></div>
        </div>
        <div class="onb-cta" style="margin-top:auto;padding-top:24px"><button class="btn btn-primary btn-block" data-act="obName">Continuar</button></div>
      </div>`;
    }
    return `<div class="onb">
      <div class="onb-copy" style="margin-top:28px"><p class="eyebrow">Tudo pronto, ${esc(first(S.user && S.user.name))}</p><h1 class="h1">Você já tem ingresso?</h1><p class="lead">Quem comprou pelo site só precisa importar o código. O ingresso aparece aqui na hora.</p></div>
      <div class="opts">
        <button class="opt" data-act="obFinish:buy"><span class="ico">${icon("ticket")}</span><span class="row-main"><span class="row-t">Comprar agora</span><span class="row-s">Escolha a data e os ingressos pelo app</span></span><span class="row-end">${icon("chevron")}</span></button>
        <button class="opt" data-act="obFinish:import"><span class="ico">${icon("globe")}</span><span class="row-main"><span class="row-t">Já comprei pelo site</span><span class="row-s">Importar com o código do e-mail</span></span><span class="row-end">${icon("chevron")}</span></button>
        <button class="opt" data-act="obFinish:explore"><span class="ico">${icon("map")}</span><span class="row-main"><span class="row-t">Só explorar por enquanto</span><span class="row-s">Ver ilhas, filas e programação</span></span><span class="row-end">${icon("chevron")}</span></button>
      </div>
    </div>`;
  }

  function mkTicket(type, holder, date = todayISO()) { return { id: uid() + uid(), code: "DP-" + uid(), type, holder, date, used: false }; }
  function seedDemo() {
    const keep = S.onboarded ? { clock: S.clock, speed: S.speed } : {};
    S = { ...fresh(), ...keep };
    S.onboarded = true;
    S.user = { name: "Carol", email: "carol@email.com" };
    S.group = [{ id: "me", name: "Carol", h: 165, me: true }, { id: "g1", name: "Marcos", h: 178 }, { id: "g2", name: "Pedro", h: 128, kid: true }, { id: "g3", name: "Lia", h: 112, kid: true }];
    S.tickets = [mkTicket("dia", "Carol"), mkTicket("dia", "Marcos"), mkTicket("meia", "Pedro"), mkTicket("meia", "Lia")];
    S.wallet = { balance: 80, tokens: 5, history: [{ t: "Lanche · Carrinho de Doces", v: -20, at: 600 }, { t: "Recarga via Pix", v: 100, at: 560 }, { t: "Bônus de boas-vindas", tok: 5, at: 560 }] };
    S.earned = 5;
    S.reminders = { erupcao: true };
    save();
  }
  function ensureDemo() { if (!S.onboarded || !hasToday()) seedDemo(); }

  /* =========================================================
     Telas
     ========================================================= */
  const SCREENS = {};
  const greet = () => (S.clock < 12 * 60 ? "Bom dia," : S.clock < 18 * 60 ? "Boa tarde," : "Boa noite,");
  const chev = `<span class="row-end">${icon("chevron")}</span>`;
  const ico = (name, c) => `<span class="ico" style="--c:${c || "var(--text)"}">${icon(name)}</span>`;
  const empty = (name, t, s, cta = "") => `<div class="empty">${ico(name)}<p class="row-t" style="color:var(--text)">${t}</p><p class="small">${s}</p>${cta}</div>`;

  function itemName(i) {
    if (i.type === "event") return ev(i.id).title;
    if (i.type === "meal") return "Lanche no Carrinho de Doces";
    return attr(i.id).name;
  }
  function itemColor(i) {
    const isl = i.type === "event" ? ev(i.id).island : attr(i.id).island;
    return island(isl).color;
  }

  /* ---------- Início ---------- */
  SCREENS.home = () => {
    const u = S.user || { name: "" };
    const tix = todays();
    const closed = S.clock >= CLOSE;
    let b = `<div class="stack" style="padding-top:8px">
      <div class="hello">
        <button class="avatar" data-go="profile" aria-label="Perfil">${esc(initial(u.name))}</button>
        <div class="hello-t"><p>${greet()}</p><h1>${esc(first(u.name))}</h1></div>
        <button class="icon-btn" data-go="watch" aria-label="Relógio" style="${S.watch.paired ? "border-color:rgba(61,255,139,.45);color:var(--green)" : ""}">${icon("watch")}</button>
        <button class="icon-btn" data-go="notes" aria-label="Notificações">${icon("bell")}<span data-live="unread"></span></button>
      </div>
      <p class="clock-chip"><i></i>Hora do parque <b data-live="clock">${hm(S.clock)}</b></p>`;

    if (closed) {
      b += `<div class="card card-hero">
        <p class="hud">Parque fechado · até a próxima</p>
        <p class="card-t">Seu dia em números</p>
        <div class="stats"><div class="stat"><b>${S.done.length}</b><span class="hud">atrações</span></div><div class="stat"><b>${S.earned}</b><span class="hud">fichas</span></div><div class="stat"><b>${photoList().length}</b><span class="hud">fotos</span></div></div>
        <p class="small muted">Como foi o seu dia?</p>
        <div class="btn-row" style="gap:6px">${[1, 2, 3, 4, 5].map((n) => `<button class="chip ${S.rating >= n ? "on" : ""}" data-act="rate:${n}" aria-label="${n} estrelas" style="justify-content:center;flex:1">★</button>`).join("")}</div>
        <button class="btn btn-ghost btn-sm" data-go="photos">${icon("camera")} Ver minhas fotos</button>
      </div>`;
    }

    if (!tix.length) {
      b += `<div class="card card-hero">
        <p class="hud">Você ainda não tem ingresso para hoje</p>
        <p class="card-t">Garanta seu dia dentro dos jogos.</p>
        <p class="small muted">Relógio incluso, fila virtual e reservas de horário.</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-go="buy">Comprar ingresso</button><button class="btn btn-ghost btn-sm" data-act="importTicket">Comprei no site</button></div>
      </div>`;
    } else if (!closed) {
      b += `<button class="card tap" data-act="openQR">
        <div class="card-k"><span class="hud">Ingresso de hoje</span><span class="tag live">Válido</span></div>
        <div style="display:flex;align-items:center;gap:14px">
          <div class="qr sm" style="margin:0;width:64px;padding:5px;border-radius:8px">${qr(tq(tix[0]))}</div>
          <div class="row-main"><p class="card-t">${tix.length} ${tix.length > 1 ? "pessoas" : "pessoa"} · ${esc(ttype(tix[0].type).name)}</p><p class="row-s">Toque para mostrar o QR na entrada</p></div>
          ${chev}
        </div>
      </button>`;
    }

    // fila virtual ativa
    const q = S.queue;
    if (q && !closed) {
      const a = attr(q.attr);
      const st = q.status === "ready" ? `<span class="tag live">Sua vez!</span>` : q.status === "expired" ? `<span class="tag hot">Tempo esgotado</span>` : `<span class="tag">Fila virtual</span>`;
      b += `<button class="card tap card-accent" style="--c:${island(a.island).color}" data-go="queue">
        <div class="card-k"><span class="hud">${esc(island(a.island).name)}</span>${st}</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px">
          <p class="card-t">${esc(a.name)}</p>
          ${q.status === "waiting" ? `<p class="wait"><b data-live="qrem">${Math.ceil(q.readyAt - S.clock)}</b><small>min restantes</small></p>` : chev}
        </div>
      </button>`;
    }

    // próxima reserva
    const r = liveRes().sort((x, y) => x.t - y.t)[0];
    if (r) {
      const a = attr(r.attr);
      b += `<button class="card tap" data-act="toRes">
        <div class="card-k"><span class="hud">${r.status === "ready" ? "Reserva começou" : "Próxima reserva"}</span>${r.status === "ready" ? `<span class="tag live">Agora</span>` : `<span class="tag">${hm(r.t)}</span>`}</div>
        <div style="display:flex;align-items:center;gap:12px">${ico("calendar", island(a.island).color)}<div class="row-main"><p class="row-t">${esc(a.name)}</p><p class="row-s">Entrada expressa · ${r.party} ${r.party > 1 ? "pessoas" : "pessoa"}</p></div>${chev}</div>
      </button>`;
    }

    b += eruptCard();

    // roteiro
    if (!closed) {
      if (S.plan) {
        const n = S.plan.items.find((i) => i.t >= S.clock - 10);
        b += `<button class="card tap" data-act="toPlan">
          <div class="card-k"><span class="hud">Meu roteiro</span><span class="tag">${S.plan.items.length} paradas</span></div>
          ${n ? `<div style="display:flex;align-items:center;gap:12px">${ico("route", itemColor(n))}<div class="row-main"><p class="row-t">${hm(n.t)} · ${esc(itemName(n))}</p><p class="row-s">Próxima parada</p></div>${chev}</div>` : `<p class="row-s">Você completou o roteiro de hoje!</p>`}
        </button>`;
      } else {
        b += `<button class="card tap" data-go="planner">
          <div style="display:flex;align-items:center;gap:12px">${ico("route", "var(--cyan)")}<div class="row-main"><p class="row-t">Monte seu roteiro em 3 perguntas</p><p class="row-s">Um dia sob medida para quem vem com você</p></div>${chev}</div>
        </button>`;
      }
    }

    // filas agora
    if (!closed) {
      const top = ATTRACTIONS.filter((a) => a.base >= 10).sort((x, y) => waitOf(x) - waitOf(y)).slice(0, 6);
      b += `<div class="sec"><div class="sec-h"><h2>Filas agora</h2><button class="link" data-tab="park" data-act="toList">Ver todas</button></div>
        <div class="rail">${top.map((a) => `<button class="mini" data-go="attraction:${a.id}" style="border-top:3px solid ${island(a.island).color}">
          <p class="hud">${esc(island(a.island).name)}</p><p class="mini-t">${esc(a.name)}</p>${waitBox(a)}</button>`).join("")}</div></div>`;

      // próximos eventos
      const next = SCHEDULE.filter((e) => toMin(e.t) + (e.dur || 0) > S.clock && e.id !== "fechamento").slice(0, 3);
      if (next.length) {
        b += `<div class="sec"><div class="sec-h"><h2>Hoje no parque</h2><button class="link" data-act="toProg">Programação</button></div>
          <div class="list">${next.map((e) => eventRow(e)).join("")}</div></div>`;
      }
    }

    // relógio
    b += `<div class="sec"><div class="sec-h"><h2>Relógio do parque</h2></div>`;
    b += S.watch.paired
      ? `<button class="card tap" data-go="watch"><div class="watch-mini">${watchHTML("auto", true)}<div class="row-main"><p class="row-t">Conectado · ${esc(S.watch.id)}</p><p class="row-s">Mostra a sua vez, o caminho até a atração e paga com um toque.</p></div></div></button>`
      : `<button class="card tap" data-go="watch"><div style="display:flex;align-items:center;gap:12px">${ico("watch", "var(--red-hi)")}<div class="row-main"><p class="row-t">Parear meu relógio</p><p class="row-s">Retire no totem da entrada e conecte em segundos.</p></div>${chev}</div></button>`;
    b += `</div></div>`;
    return { home: true, body: b };
  };

  function eruptCard() {
    if (S.clock >= ERUPT + 15) return "";
    const on = S.clock >= ERUPT;
    const fizz = on ? `<div class="fizz">${Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 7.3) % 100}%;animation-delay:${(i * 0.17) % 2.4}s;background:${i % 3 ? "var(--gold)" : "var(--red-hi)"}"></i>`).join("")}</div>` : "";
    return `<div class="card card-accent erupt-card ${on ? "on" : ""}" style="--c:var(--gold)">${fizz}
      <div class="card-k"><span class="hud">${on ? "Acontecendo agora · Praça Doce" : "Erupção do vulcão · 17:00"}</span>${on ? `<span class="tag gold">Ao vivo</span>` : ""}</div>
      <p class="big" data-live="erupt">${eruptTxt()}</p>
      <p class="small muted">${on ? "Faça check-in na Praça Doce para ganhar fichas." : "O parque inteiro para e o vulcão de refrigerante explode."}</p>
      ${on
        ? S.seen.checkin ? `<p class="note ok">${icon("check")}Check-in feito · +3 fichas</p>` : `<button class="btn btn-primary btn-sm" data-act="checkin">Fazer check-in (+3 fichas)</button>`
        : `<button class="btn ${S.reminders.erupcao ? "btn-soft" : "btn-ghost"} btn-sm" data-act="remind:erupcao">${icon(S.reminders.erupcao ? "bellOn" : "bell")}${S.reminders.erupcao ? "Lembrete ativado" : "Me lembrar 15 min antes"}</button>`}
    </div>`;
  }

  function eventRow(e) {
    const at = toMin(e.t), c = island(e.island).color;
    const now = S.clock >= at && S.clock < at + (e.dur || 0);
    return `<div class="row">${ico(e.star ? "volcano" : "calendar", c)}
      <div class="row-main"><p class="row-t">${esc(e.title)}</p><p class="row-s">${e.t} · ${esc(island(e.island).name)}${now ? ` · <span style="color:var(--green)">agora</span>` : ""}</p></div>
      <button class="bell ${S.reminders[e.id] ? "on" : ""}" data-act="remind:${e.id}" aria-label="Lembrete">${icon(S.reminders[e.id] ? "bellOn" : "bell")}</button></div>`;
  }

  /* ---------- Parque: mapa e filas ---------- */
  const SHORT = { lobby: "Lobby", felix: "Conserta ou Detona", heros: "Hero's Duty", sugar: "Sugar Rush", cola: "Diet Cola", praca: "Praça Doce" };
  function mapSvg() {
    const cx = 170, cy = 160, R = 110;
    const P = ISLANDS.map((isl, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / ISLANDS.length; return { isl, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; });
    const wires = P.map((p, i) => { const q = P[(i + 1) % P.length]; const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; const kx = cx + (mx - cx) * 0.55, ky = cy + (my - cy) * 0.55; return `<path class="wire" d="M${p.x},${p.y} Q${kx},${ky} ${q.x},${q.y}"/>`; }).join("");
    const nodes = P.map(({ isl, x, y }) => {
      const main = ATTRACTIONS.filter((a) => a.island === isl.id).sort((a, b) => b.base - a.base)[0];
      return `<g class="isl" data-act="island:${isl.id}" role="button" aria-label="${esc(isl.name)}">
        <circle class="ring" cx="${x}" cy="${y}" r="30" fill="${isl.color}" fill-opacity=".16" stroke="${isl.color}" stroke-width="1.5"/>
        <text class="wt" x="${x}" y="${y + 4}" text-anchor="middle" data-wt="${main.id}">${waitOf(main) ?? "—"}'</text>
        <text class="lbl" x="${x}" y="${y + 46}" text-anchor="middle">${esc(SHORT[isl.id])}</text></g>`;
    }).join("");
    const me = P[0];
    return `<svg viewBox="0 0 340 330" role="img" aria-label="Mapa das ilhas do parque">${wires}${nodes}
      <circle class="me-ring" cx="${me.x + 40}" cy="${me.y + 6}" r="6" stroke-width="2"/><circle class="me" cx="${me.x + 40}" cy="${me.y + 6}" r="5"/>
      <text x="${me.x + 50}" y="${me.y + 10}" style="font-size:10px;fill:var(--cyan)">você</text>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="hud" style="font-family:var(--font-hud);font-size:8px;fill:rgba(244,236,220,.4)">ESPERA DA</text>
      <text x="${cx}" y="${cy + 9}" text-anchor="middle" style="font-family:var(--font-hud);font-size:8px;fill:rgba(244,236,220,.4)">MAIOR ATRAÇÃO</text></svg>`;
  }
  const FILTERS = [
    { id: "all", t: "Todas", f: () => true },
    { id: "group", t: "Liberadas p/ meu grupo", f: (a) => blocked(a).length === 0 },
    { id: "calm", t: "Tranquilas", f: (a) => a.intensity <= 2 },
    { id: "radical", t: "Radicais", f: (a) => a.intensity >= 4 },
    { id: "res", t: "Com reserva", f: (a) => a.reservable },
  ];
  function attrRow(a) {
    const c = island(a.island).color, bl = blocked(a).length;
    return `<button class="row" data-go="attraction:${a.id}"><span class="bar" style="--c:${c}"></span>
      <span class="row-main"><span class="row-t">${esc(a.name)}</span><span class="row-s">${esc(island(a.island).name)}${a.minH ? ` · mín. ${a.minH} cm` : ""}${bl ? ` · <span style="color:var(--gold)">${bl} do grupo não pode</span>` : ""}</span></span>
      ${waitBox(a)}</button>`;
  }
  SCREENS.park = (p) => {
    const seg = p.seg || "map";
    let b = `<div class="stack"><div class="seg"><button class="${seg === "map" ? "on" : ""}" data-act="seg:map">Mapa</button><button class="${seg === "list" ? "on" : ""}" data-act="seg:list">Filas em tempo real</button></div>`;
    if (seg === "map") {
      b += `<div class="map">${mapSvg()}</div>
        <div class="legend"><span><i style="background:var(--green)"></i>até 15 min</span><span><i style="background:var(--gold)"></i>até 35 min</span><span><i style="background:var(--red-hi)"></i>mais de 35</span></div>
        <p class="note info">${icon("gps")}Toque numa ilha para ver as atrações. Com o relógio pareado, ele aponta o caminho.</p>
        <div class="sec-h"><h2>Ilhas</h2></div>
        <div class="list">${ISLANDS.map((isl) => `<button class="row" data-act="island:${isl.id}"><span class="bar" style="--c:${isl.color}"></span><span class="row-main"><span class="row-t">${esc(isl.name)}</span><span class="row-s">${esc(isl.hook)} · ${esc(isl.forWho)}</span></span>${chev}</button>`).join("")}</div>`;
    } else {
      const F = FILTERS.find((f) => f.id === D.filter) || FILTERS[0];
      const list = ATTRACTIONS.filter(F.f).sort((x, y) => (waitOf(x) ?? 0) - (waitOf(y) ?? 0));
      b += `<div class="chips">${FILTERS.map((f) => `<button class="chip ${f.id === F.id ? "on" : ""}" data-act="filter:${f.id}">${f.t}</button>`).join("")}</div>
        <p class="small muted" style="display:flex;align-items:center;gap:8px"><span class="clock-chip"><i></i></span>Atualizado agora · <b data-live="clock" style="color:var(--text)">${hm(S.clock)}</b></p>
        <div class="list">${list.map(attrRow).join("") || `<div class="row"><span class="row-s">Nenhuma atração neste filtro.</span></div>`}</div>`;
    }
    return { title: "Parque", body: b + "</div>" };
  };

  /* ---------- Atração ---------- */
  SCREENS.attraction = ({ id }) => {
    const a = attr(id), isl = island(a.island), c = isl.color;
    const bl = blocked(a);
    const inPlan = S.plan && S.plan.items.some((i) => i.type === "attr" && i.id === a.id);
    const q = S.queue, myQ = q && q.attr === a.id && q.status !== "expired";
    const res = liveRes().find((r) => r.attr === a.id);
    const freeFlow = a.base < 15;
    const b = `<div class="attr-hero" style="--c:${c}">
        <div class="art">${pix(seedOf(a.id), 84, 6)}</div>
        <p class="eyebrow" style="margin-top:6px">${esc(isl.name)} · ${esc(a.kind)}</p>
        <h2 class="h1">${esc(a.name)}</h2>
        <p class="lead">${esc(a.text)}</p>
      </div>
      <div class="stack">
        <div class="stats">
          <div class="stat"><span class="hud">Espera</span><span data-wait="${a.id}" class="wait ${waitCls(waitOf(a))}" style="justify-items:start">${waitHTML(a)}</span></div>
          <div class="stat"><span class="hud">Duração</span><b>${a.dur}<small>min</small></b></div>
          <div class="stat"><span class="hud">Altura</span><b>${a.minH || "Livre"}${a.minH ? "<small>cm</small>" : ""}</b></div>
        </div>
        <div class="card" style="gap:8px"><div class="card-k"><span class="hud">Intensidade</span>${meter(a.intensity, c)}</div><div class="card-k"><span class="hud">Ideal para</span><span class="small">${esc(isl.forWho)}</span></div></div>
        ${bl.length ? `<p class="note">${icon("alert")}<span>${bl.map((g) => `${esc(g.name)} (${g.h} cm)`).join(", ")} ${bl.length > 1 ? "não podem" : "não pode"} ir: a altura mínima é ${a.minH} cm. <button class="link" data-go="group" style="color:inherit;text-decoration:underline">Ver grupo</button></span></p>` : S.group.length > 1 ? `<p class="note ok">${icon("check")}Todo o seu grupo pode ir nesta atração.</p>` : ""}
        ${myQ ? `<button class="btn btn-primary btn-block" data-go="queue">${icon("timer")}Você está nesta fila · ver</button>`
          : freeFlow ? `<p class="note info">${icon("info")}Fila livre: a espera é curta, é só ir direto.</p>`
          : `<button class="btn btn-primary btn-block" data-act="joinQueue:${a.id}" ${waitOf(a) == null ? "disabled" : ""}>${icon("timer")}Entrar na fila virtual</button>`}
        ${a.reservable ? (res ? `<button class="btn btn-soft btn-block" data-act="toRes">${icon("calendar")}Reservado para ${hm(res.t)}</button>` : `<button class="btn btn-ghost btn-block" data-go="reserve:${a.id}">${icon("calendar")}Reservar horário</button>`) : ""}
        <button class="btn btn-ghost btn-block" data-act="planToggle:${a.id}">${icon(inPlan ? "check" : "route")}${inPlan ? "No seu roteiro" : "Adicionar ao roteiro"}</button>
      </div>`;
    return { title: "", body: b, tabs: true };
  };

  /* ---------- Fila virtual ---------- */
  SCREENS.queue = () => {
    const q = S.queue;
    if (!q) return { title: "Fila virtual", body: empty("timer", "Você não está em nenhuma fila", "Escolha uma atração e entre na fila virtual. Enquanto espera, aproveite o resto do parque.", `<button class="btn btn-primary btn-sm" data-tab="park" data-act="toList">Ver filas agora</button>`) };
    const a = attr(q.attr), c = island(a.island).color;
    let b = `<div class="stack"><p class="eyebrow">${esc(island(a.island).name)}</p><h2 class="h1">${esc(a.name)}</h2>`;
    if (q.status === "waiting") {
      b += `<div class="queue-ring"><svg viewBox="0 0 210 210"><circle class="track" cx="105" cy="105" r="95" fill="none" stroke-width="10"/><circle class="prog" data-live="qring" cx="105" cy="105" r="95" fill="none" stroke-width="10" stroke-dasharray="597" stroke-dashoffset="597"/></svg>
          <div class="in"><span class="hud">faltam</span><b data-live="qrem">${Math.ceil(q.readyAt - S.clock)}</b><span class="hud">minutos</span></div></div>
        <div class="stats"><div class="stat"><span class="hud">Posição</span><b data-live="qpos">—</b></div><div class="stat"><span class="hud">Pessoas</span><b>${q.party}</b></div><div class="stat"><span class="hud">Previsão</span><b style="font-size:18px">${hm(q.readyAt)}</b></div></div>
        <p class="note info">${icon("vibrate")}Circule à vontade: avisamos aqui${S.watch.paired ? " e no relógio" : ""} quando for a sua vez.</p>
        <div class="sec-h"><h2>Enquanto espera</h2></div>
        <div class="list">
          <button class="row" data-act="game">${ico("gamepad", "var(--orange)")}<span class="row-main"><span class="row-t">Jogar Detona Blocos</span><span class="row-s">Minigame de 10 segundos · vale fichas</span></span>${chev}</button>
          <button class="row" data-go="attraction:carrinho">${ico("coin", "var(--pink)")}<span class="row-main"><span class="row-t">Fazer um lanche</span><span class="row-s">Carrinho de Doces · pague com a carteira</span></span>${chev}</button>
          <button class="row" data-act="toProg">${ico("calendar", "var(--cyan)")}<span class="row-main"><span class="row-t">Ver a programação</span><span class="row-s">Shows e encontros perto de você</span></span>${chev}</button>
        </div>
        <button class="btn btn-ghost btn-block" data-act="leaveQueue">Sair da fila</button>`;
    } else if (q.status === "ready") {
      b += `<div class="queue-ring ready"><svg viewBox="0 0 210 210"><circle class="track" cx="105" cy="105" r="95" fill="none" stroke-width="10"/><circle class="prog" cx="105" cy="105" r="95" fill="none" stroke-width="10" stroke-dasharray="597" stroke-dashoffset="0"/></svg>
          <div class="in"><span class="hud">é a sua</span><b>VEZ!</b><span class="hud">entre até <span data-live="quntil">${hm(q.readyAt + 15)}</span></span></div></div>
        <p class="note ok">${icon("gps")}${S.watch.paired && S.watch.gps ? "Siga a seta no relógio até a entrada." : "Vá até a entrada da atração e mostre o código."}</p>
        <button class="btn btn-primary btn-block" data-act="queueCode">${icon("qr")}Mostrar código de entrada</button>
        <button class="btn btn-ghost btn-block" data-act="leaveQueue">Desistir da vez</button>`;
    } else {
      b += empty("alert", "Sua vez passou", "O tempo de 15 minutos para entrar acabou. Você pode entrar na fila de novo.", `<div class="btn-row" style="width:100%"><button class="btn btn-primary btn-sm" data-act="joinQueue:${a.id}">Entrar de novo</button><button class="btn btn-ghost btn-sm" data-act="leaveQueue">Fechar</button></div>`);
    }
    return { title: "Fila virtual", body: b + `</div>`, mount: () => updateLive() };
  };

  /* ---------- Reservar horário ---------- */
  function slotsFor(a) {
    const out = [];
    for (let t = 10 * 60; t <= 17 * 60 + 30; t += 30) {
      const x = Math.sin(t * 0.37 + a.base * 3.3) * 43758.5453;
      const left = Math.floor((x - Math.floor(x)) * 10);
      out.push({ t, left, ok: left > 0 && t >= S.clock + 10 && t !== ERUPT });
    }
    return out;
  }
  SCREENS.reserve = ({ id }) => {
    const a = attr(id), c = island(a.island).color;
    const used = liveRes().length, lim = resLimit();
    const dup = liveRes().find((r) => r.attr === a.id);
    const sl = slotsFor(a);
    if (D.slot && !sl.find((s) => s.t === D.slot && s.ok)) D.slot = null;
    let b = `<div class="stack" style="min-height:100%">
      <div style="display:flex;align-items:center;gap:12px">${ico("calendar", c)}<div class="row-main"><p class="row-t">${esc(a.name)}</p><p class="row-s">Hoje · entrada expressa para ${party()} ${party() > 1 ? "pessoas" : "pessoa"}</p></div></div>`;
    if (!hasToday()) b += `<p class="note">${icon("alert")}Você precisa de um ingresso para hoje para reservar.</p><button class="btn btn-primary btn-block" data-go="buy">Comprar ingresso</button>`;
    else if (dup) b += `<p class="note ok">${icon("check")}Você já reservou ${esc(a.name)} às ${hm(dup.t)}.</p>`;
    else if (used >= lim) b += `<p class="note">${icon("alert")}Você já usou as ${lim} reservas do seu ingresso. Cancele uma ou troque para o Passe Turbo.</p>`;
    else {
      b += `<p class="small muted">Você usou ${used} de ${lim} reservas. Escolha um horário:</p>
        <div class="slots">${sl.map((s) => `<button class="slot ${D.slot === s.t ? "on" : ""}" data-act="slot:${s.t}" ${s.ok ? "" : "disabled"}><b>${hm(s.t)}</b><small>${s.t === ERUPT ? "erupção" : s.left ? s.left + " vagas" : "esgotado"}</small></button>`).join("")}</div>
        <p class="small faint">Horários perto das 17:00 ficam livres para todo mundo ver a erupção.</p>
        <div class="footer-cta"><button class="btn btn-primary btn-block" data-act="reserveConfirm:${a.id}" ${D.slot ? "" : "disabled"}>${D.slot ? `Reservar às ${hm(D.slot)}` : "Escolha um horário"}</button></div>`;
    }
    return { title: "Reservar horário", body: b + "</div>", tabs: false };
  };

  /* ---------- Agenda: programação, roteiro e reservas ---------- */
  SCREENS.agenda = (p) => {
    const seg = p.seg || "prog";
    let b = `<div class="stack"><div class="seg">
      <button class="${seg === "prog" ? "on" : ""}" data-act="seg:prog">Programação</button>
      <button class="${seg === "plan" ? "on" : ""}" data-act="seg:plan">Meu roteiro</button>
      <button class="${seg === "res" ? "on" : ""}" data-act="seg:res">Reservas</button></div>`;
    if (seg === "prog") {
      b += `<p class="small muted">Toque no sino para receber um lembrete 15 minutos antes${S.watch.paired ? " — no celular e no relógio" : ""}.</p><div class="timeline">`;
      b += SCHEDULE.map((e) => {
        const at = toMin(e.t), end = at + (e.dur || 0);
        const st = S.clock >= end && e.dur ? "past" : S.clock >= at && S.clock < end ? "now" : "";
        const c = island(e.island).color;
        return `<div class="tl ${st} ${e.star ? "star" : ""}" style="--c:${c}"><span class="tl-time">${e.t}</span><span class="tl-rail"><i></i></span>
          <div class="tl-card"><div class="row-main"><span class="row-t">${esc(e.title)}</span><span class="row-s">${esc(island(e.island).name)} · ${esc(e.kind)}${st === "now" ? ` · <span style="color:var(--green)">acontecendo</span>` : ""}</span></div>
          ${st === "past" || e.id === "fechamento" ? "" : `<button class="bell ${S.reminders[e.id] ? "on" : ""}" data-act="remind:${e.id}" aria-label="Lembrete">${icon(S.reminders[e.id] ? "bellOn" : "bell")}</button>`}</div></div>`;
      }).join("");
      b += `</div>`;
    } else if (seg === "plan") {
      if (!S.plan) b += empty("route", "Você ainda não tem um roteiro", "Responda 3 perguntas e montamos o seu dia com as atrações certas para o seu grupo, as filas mais curtas e a erupção no final.", `<button class="btn btn-primary btn-sm" data-go="planner">Montar meu roteiro</button>`);
      else {
        const pr = S.plan.prefs;
        b += `<div class="card" style="gap:6px"><div class="card-k"><span class="hud">Feito para</span><button class="link" data-go="planner">Refazer</button></div><p class="row-t">${esc(WHO.find((w) => w.id === pr.who).t)} · ritmo ${esc(PACE.find((x) => x.id === pr.pace).t.toLowerCase())}</p></div>
          <div class="timeline">${S.plan.items.map((it, k) => planItemHTML(it, k)).join("")}</div>
          ${S.watch.paired ? `<button class="btn btn-ghost btn-block" data-act="planToWatch">${icon("send")}Enviar roteiro para o relógio</button>` : `<button class="btn btn-ghost btn-block" data-go="watch">${icon("watch")}Parear relógio para seguir o roteiro</button>`}`;
      }
    } else {
      const all = S.reservations.filter((r) => r.status !== "cancelled").sort((a, b) => a.t - b.t);
      b += `<p class="small muted">${hasToday() ? `Você usou ${liveRes().length} de ${resLimit()} reservas de hoje.` : "Reservas ficam disponíveis com um ingresso para hoje."}</p>`;
      b += all.length ? `<div class="list">${all.map(resRow).join("")}</div>` : empty("calendar", "Nenhuma reserva", "Reserve horários nas atrações mais disputadas e entre pela fila expressa.", `<button class="btn btn-primary btn-sm" data-act="toResList">Ver atrações com reserva</button>`);
    }
    return { title: "Agenda", body: b + "</div>" };
  };
  function planItemHTML(it, k) {
    const c = itemColor(it);
    const st = S.clock > it.t + 30 ? "past" : S.clock >= it.t - 5 ? "now" : "";
    let acts = "";
    if (it.type === "attr") {
      const a = attr(it.id);
      acts = a.reservable && !liveRes().find((r) => r.attr === a.id) ? `<button class="chip" data-go="reserve:${a.id}">Reservar</button>` : a.base >= 15 ? `<button class="chip" data-act="joinQueue:${a.id}">Fila</button>` : "";
    }
    const sub = it.type === "attr" ? `${esc(island(attr(it.id).island).name)} · espera agora <b data-waittxt="${it.id}">${waitTxt(attr(it.id))}</b>`
      : it.type === "meal" ? "Praça Doce · pague com a carteira" : `${esc(island(ev(it.id).island).name)} · ${esc(ev(it.id).kind)}`;
    return `<div class="tl ${st} ${it.type === "event" && ev(it.id).star ? "star" : ""}" style="--c:${c}"><span class="tl-time">${hm(it.t)}</span><span class="tl-rail"><i></i></span>
      <div class="tl-card"><button class="row-main" style="text-align:left" ${it.type === "attr" || it.type === "meal" ? `data-go="attraction:${it.type === "meal" ? "carrinho" : it.id}"` : ""}><span class="row-t">${esc(itemName(it))}</span><span class="row-s">${sub}</span></button>
      ${acts}${it.id === "erupcao" ? "" : `<button class="sheet-x" data-act="planDel:${k}" aria-label="Remover do roteiro">${icon("close")}</button>`}</div></div>`;
  }
  function resRow(r) {
    const a = attr(r.attr), c = island(a.island).color;
    const label = { booked: `<span class="tag">${hm(r.t)}</span>`, ready: `<span class="tag live">Agora</span>`, missed: `<span class="tag hot">Perdida</span>`, done: `<span class="tag gold">Usada</span>` }[r.status];
    const act = r.status === "booked" ? `<button class="chip" data-act="resCancel:${r.id}">Cancelar</button>` : r.status === "ready" ? `<button class="chip on" data-act="resCode:${r.id}">${icon("qr")}Entrar</button>` : "";
    return `<div class="row"><span class="bar" style="--c:${c}"></span><span class="row-main"><span class="row-t">${esc(a.name)}</span><span class="row-s">${hm(r.t)} · ${r.party} ${r.party > 1 ? "pessoas" : "pessoa"} · entrada expressa</span></span><span class="row-end">${label}${act}</span></div>`;
  }

  /* ---------- Planejador de roteiro ---------- */
  const WHO = [
    { id: "kids", t: "Família com crianças", s: "Tudo liberado para os pequenos", ico: "family" },
    { id: "friends", t: "Grupo de amigos", s: "Competição e adrenalina", ico: "users" },
    { id: "adults", t: "Casal ou adultos", s: "Nostalgia e boas filas", ico: "joystick" },
    { id: "solo", t: "Só eu", s: "No meu ritmo", ico: "user" },
  ];
  const PACE = [
    { id: "tranquilo", t: "Tranquilo", s: "Menos paradas, mais pausas", ico: "clock" },
    { id: "equilibrado", t: "Equilibrado", s: "Um pouco de tudo", ico: "sparkle" },
    { id: "adrenalina", t: "Adrenalina", s: "As atrações mais radicais", ico: "volcano" },
  ];
  SCREENS.planner = () => {
    if (!D.plan) D.plan = { step: 0, who: null, pace: null, arrive: null };
    const P = D.plan;
    const ARR = [{ id: Math.max(OPEN, Math.ceil(S.clock / 5) * 5), t: "Agora", s: "Começar a partir deste momento" }, { id: 11 * 60, t: "11:00", s: "Chegando no fim da manhã" }, { id: 13 * 60, t: "13:00", s: "Depois do almoço" }].filter((x, i) => i === 0 || x.id > S.clock + 10);
    const Q = [
      { k: "who", t: "Quem vem com você?", o: WHO },
      { k: "pace", t: "Qual o ritmo do dia?", o: PACE },
      { k: "arrive", t: "A partir de que horas?", o: ARR },
    ];
    const q = Q[P.step];
    let b = `<div class="stack" style="min-height:100%"><div class="steps">${Q.map((_, i) => `<i class="${i <= P.step ? "on" : ""}"></i>`).join("")}</div>
      <p class="eyebrow">Pergunta ${P.step + 1} de 3</p><h2 class="h1">${q.t}</h2>
      <div class="opts">${q.o.map((o) => `<button class="opt ${P[q.k] === o.id ? "on" : ""}" data-act="planPick:${q.k}:${o.id}">${o.ico ? ico(o.ico) : ico("clock")}<span class="row-main"><span class="row-t">${o.t}</span><span class="row-s">${o.s}</span></span><span class="radio"></span></button>`).join("")}</div>`;
    if (P.step === 0 && S.group.some((g) => g.kid)) b += `<p class="note info">${icon("users")}Usamos a altura de cada pessoa do seu grupo para só sugerir atrações liberadas.</p>`;
    b += `<div class="footer-cta btn-row">${P.step ? `<button class="btn btn-ghost" data-act="planBack">Voltar</button>` : ""}<button class="btn btn-primary" data-act="planNext" ${P[q.k] == null ? "disabled" : ""}>${P.step === 2 ? "Gerar meu roteiro" : "Continuar"}</button></div></div>`;
    return { title: "Montar roteiro", body: b, tabs: false };
  };
  function buildPlan(pr) {
    let t = Math.max(OPEN, Math.ceil(pr.arrive / 5) * 5);
    const minH = pr.who === "kids" ? Math.min(groupMinH(), S.group.some((g) => g.kid) ? 999 : 110) : pr.who === "solo" ? (S.group.find((g) => g.me) || { h: 170 }).h : groupMinH();
    let pool = ATTRACTIONS.filter((a) => a.kind !== "Loja" && a.id !== "carrinho" && a.minH <= minH);
    if (pr.pace === "tranquilo") pool = pool.filter((a) => a.intensity <= 3);
    if (pr.pace === "adrenalina") pool.sort((a, b) => b.intensity - a.intensity);
    else pool.sort((a, b) => (b.reservable - a.reservable) || b.intensity - a.intensity);
    pool = pool.slice(0, { tranquilo: 4, equilibrado: 5, adrenalina: 6 }[pr.pace]);
    pool.sort((a, b) => RING.indexOf(a.island) - RING.indexOf(b.island));
    const evs = SCHEDULE.filter((e) => ((pr.who === "kids" && e.kids) || ((pr.who === "friends" || pr.who === "adults") && e.friends)) && toMin(e.t) >= t && toMin(e.t) < ERUPT - 20)
      .map((e) => ({ type: "event", id: e.id, t: toMin(e.t), dur: e.dur }));
    const items = [];
    let lunch = t >= 14 * 60;
    for (const a of pool) {
      const span = Math.round((waitOf(a, t) ?? a.base) * 0.5) + a.dur + 10;
      while (evs.length && evs[0].t <= t + span) { const e = evs.shift(); items.push({ type: "event", id: e.id, t: e.t }); t = Math.max(t, e.t + e.dur + 10); }
      if (!lunch && t >= 12 * 60) { items.push({ type: "meal", id: "carrinho", t }); t += 45; lunch = true; }
      if (t + span > ERUPT - 25) break;
      items.push({ type: "attr", id: a.id, t });
      t = Math.ceil((t + span) / 5) * 5;
    }
    evs.forEach((e) => items.push({ type: "event", id: e.id, t: e.t }));
    items.push({ type: "event", id: "contagem", t: toMin("16:40") });
    items.push({ type: "event", id: "erupcao", t: ERUPT });
    const seen = new Set();
    return items.filter((i) => { const k = i.type + i.id; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.t - b.t);
  }

  /* ---------- Carteira ---------- */
  SCREENS.wallet = () => {
    const w = S.wallet;
    let b = `<div class="stack">
      <div class="wallet-card">
        <div class="card-k"><span class="hud" style="color:var(--text)">Carteira Detona</span>${S.watch.paired && S.watch.pay ? `<span class="tag live">Relógio ativo</span>` : ""}</div>
        <div><p class="hud">Saldo</p><p class="wallet-bal">${brl(w.balance)}</p></div>
        <div class="wallet-row"><div><p class="hud">Fichas</p><p class="wallet-tok"><span class="coin lg"></span>${w.tokens}</p></div><p class="small muted">Use no parque inteiro:<br>lanches, lojas e trocas.</p></div>
      </div>
      <div class="actions">
        <button class="action" data-go="topup">${ico("plus", "var(--green)")}Recarregar</button>
        <button class="action" data-act="pay">${ico("qr", "var(--cyan)")}Pagar</button>
        <button class="action" data-go="rewards">${ico("gift", "var(--gold)")}Trocar fichas</button>
      </div>
      ${S.watch.paired ? "" : `<button class="card tap" data-go="watch"><div style="display:flex;align-items:center;gap:12px">${ico("nfc", "var(--red-hi)")}<div class="row-main"><p class="row-t">Pague com o relógio</p><p class="row-s">Pareie o relógio para pagar só aproximando do caixa.</p></div>${chev}</div></button>`}
      <div class="sec-h"><h2>Como ganhar fichas</h2></div>
      <div class="list">
        <div class="row">${ico("timer", "var(--green)")}<span class="row-main"><span class="row-t">Concluir uma fila ou reserva</span></span><span class="row-end"><span class="coin"></span>+2</span></div>
        <div class="row">${ico("gamepad", "var(--orange)")}<span class="row-main"><span class="row-t">Minigames enquanto espera</span></span><span class="row-end"><span class="coin"></span>+1 a 3</span></div>
        <div class="row">${ico("volcano", "var(--gold)")}<span class="row-main"><span class="row-t">Check-in na erupção</span></span><span class="row-end"><span class="coin"></span>+3</span></div>
      </div>
      <div class="sec-h"><h2>Extrato</h2></div>`;
    b += w.history.length ? `<div class="list">${w.history.slice(0, 14).map((h) => `<div class="row"><span class="row-main"><span class="row-t">${esc(h.t)}</span><span class="row-s">Hoje · ${hm(h.at)}</span></span>
        ${h.tok != null ? `<span class="row-end amount ${h.tok > 0 ? "pos" : "neg"}"><span class="coin"></span>${h.tok > 0 ? "+" : ""}${h.tok}</span>` : `<span class="amount ${h.v > 0 ? "pos" : "neg"}">${h.v > 0 ? "+" : "−"} ${brl(Math.abs(h.v))}</span>`}</div>`).join("")}</div>`
      : empty("wallet", "Nenhuma movimentação ainda", "Recarregue para pagar lanches e lojas sem precisar de cartão.");
    return { title: "Carteira", body: b + "</div>" };
  };

  SCREENS.topup = () => {
    if (!D.topup) D.topup = { v: 50, m: "pix" };
    const T = D.topup;
    const M = [{ id: "pix", t: "Pix", s: "Cai na hora" }, { id: "card", t: "Cartão salvo", s: "Crédito •••• 4242" }, { id: "debit", t: "Débito", s: "Cartão de débito" }];
    const b = `<div class="stack" style="min-height:100%">
      <p class="small muted">Saldo atual ${brl(S.wallet.balance)}</p>
      <p class="h1" style="font-size:44px">${brl(T.v)}</p>
      <div class="chips">${[20, 50, 100, 200].map((v) => `<button class="chip ${T.v === v ? "on" : ""}" data-act="topV:${v}">${brl(v)}</button>`).join("")}</div>
      <div class="sec-h"><h2>Forma de pagamento</h2></div>
      <div class="opts">${M.map((m) => `<button class="opt ${T.m === m.id ? "on" : ""}" data-act="topM:${m.id}">${ico(m.id === "pix" ? "qr" : "wallet")}<span class="row-main"><span class="row-t">${m.t}</span><span class="row-s">${m.s}</span></span><span class="radio"></span></button>`).join("")}</div>
      <p class="small faint">Protótipo: nenhum pagamento real é feito.</p>
      <div class="footer-cta"><button class="btn btn-primary btn-block" data-act="topupGo">Recarregar ${brl(T.v)}</button></div></div>`;
    return { title: "Recarregar", body: b, tabs: false };
  };

  SCREENS.rewards = () => {
    const b = `<div class="stack">
      <div class="card" style="grid-template-columns:auto 1fr;align-items:center"><span class="coin lg"></span><div><p class="row-t">${S.wallet.tokens} ${S.wallet.tokens === 1 ? "ficha" : "fichas"}</p><p class="row-s">Retire os itens no Balcão de Trocas, na Praça Doce.</p></div></div>
      <div class="rewards">${REWARDS.map((r) => `<button class="reward" data-act="redeem:${r.id}" ${S.wallet.tokens < r.cost ? 'style="opacity:.5"' : ""}><div class="reward-art" style="--c:${r.color}">${icon("gift")}</div><p class="reward-t">${esc(r.name)}</p><p class="row-end amount"><span class="coin"></span>${r.cost}</p></button>`).join("")}</div>
      ${S.redeemed.length ? `<div class="sec-h"><h2>Meus resgates</h2></div><div class="list">${S.redeemed.map((x) => `<div class="row">${ico("gift", REWARDS.find((r) => r.id === x.id).color)}<span class="row-main"><span class="row-t">${esc(REWARDS.find((r) => r.id === x.id).name)}</span><span class="row-s">Código ${x.code} · retire na Praça Doce</span></span></div>`).join("")}</div>` : ""}
    </div>`;
    return { title: "Trocar fichas", body: b };
  };

  /* ---------- Ingressos ---------- */
  SCREENS.tickets = () => {
    const today = todays(), other = S.tickets.filter((t) => t.date !== todayISO());
    const card = (t) => `<button class="row" data-act="openQR:${t.id}">${ico("ticket", "var(--red-hi)")}<span class="row-main"><span class="row-t">${esc(ttype(t.type).name)} · ${esc(t.holder)}</span><span class="row-s">${dateLabel(t.date)} · ${t.code}</span></span>${chev}</button>`;
    const b = `<div class="stack">
      ${today.length ? `<div class="sec-h"><h2>Hoje</h2></div><div class="list">${today.map(card).join("")}</div>` : ""}
      ${other.length ? `<div class="sec-h"><h2>Próximos</h2></div><div class="list">${other.map(card).join("")}</div>` : ""}
      ${!S.tickets.length ? empty("ticket", "Nenhum ingresso", "Compre pelo app ou importe o ingresso que você comprou no site.") : ""}
      <div class="btn-row"><button class="btn btn-primary" data-go="buy">Comprar</button><button class="btn btn-ghost" data-act="importTicket">Importar do site</button></div>
    </div>`;
    return { title: "Meus ingressos", body: b };
  };

  SCREENS.buy = () => {
    if (!D.buy) D.buy = { step: 0, dates: [todayISO()], qty: { dia: 1, meia: 0, turbo: 0 }, m: "pix" };
    const B = D.buy, nd = B.dates.length;
    const count = Object.values(B.qty).reduce((a, b) => a + b, 0);
    const total = TICKETS.reduce((s, t) => s + t.price * B.qty[t.id], 0) * nd;
    const when = nd > 1 ? `${nd} dias` : dateLabel(B.dates[0]);
    const steps = `<div class="steps">${[0, 1, 2].map((i) => `<i class="${i <= B.step ? "on" : ""}"></i>`).join("")}</div>`;
    let b = `<div class="stack" style="min-height:100%">${steps}`;
    if (B.step === 0) {
      b += `<p class="eyebrow">Etapa 1 de 3</p><h2 class="h1">Quando você vem?</h2>
        <p class="lead">Pode marcar mais de um dia. O grupo ganha um ingresso para cada dia.</p>
        <div class="opts two">${[0, 1, 2, 3, 4, 5].map((o) => { const iso = dayISO(o); return `<button class="opt ${B.dates.includes(iso) ? "on" : ""}" data-act="buyDate:${iso}" aria-pressed="${B.dates.includes(iso)}"><span class="row-t">${dateLabel(iso)}</span><span class="row-s">${o === 0 ? "Erupção às 17h" : o === 5 ? "Últimas vagas" : "Vagas disponíveis"}</span></button>`; }).join("")}</div>
        <p class="note info">${icon("info")}Aberto das 9h às 18h. A erupção do vulcão acontece todo dia às 17h.</p>
        <div class="footer-cta"><button class="btn btn-primary btn-block" data-act="buyStep:1">Continuar · ${when}</button></div>`;
    } else if (B.step === 1) {
      b += `<p class="eyebrow">Etapa 2 de 3 · ${when}</p><h2 class="h1">Escolha os ingressos</h2>
        <div class="list">${TICKETS.map((t) => `<div class="row" style="align-items:flex-start"><span class="row-main"><span class="row-t">${esc(t.name)} ${t.tag ? `<span class="tag gold">${t.tag}</span>` : ""}</span><span class="row-s">${esc(t.desc)}</span><span class="row-t" style="margin-top:4px">${brl(t.price)}</span></span>
          <span class="qty"><button data-act="qty:${t.id}:-1" aria-label="Menos">${icon("minus")}</button><b>${B.qty[t.id]}</b><button data-act="qty:${t.id}:1" aria-label="Mais">${icon("plus")}</button></span></div>`).join("")}</div>
        <p class="note info">${icon("watch")}Cada ingresso inclui um relógio do parque, retirado no totem da entrada.</p>
        <div class="footer-cta"><div class="sum" style="margin-bottom:10px"><p class="tot"><span>${count * nd} ${count * nd === 1 ? "ingresso" : "ingressos"}${nd > 1 ? ` · ${nd} dias` : ""}</span><span>${brl(total)}</span></p></div>
          <div class="btn-row"><button class="btn btn-ghost" data-act="buyStep:0">Voltar</button><button class="btn btn-primary" data-act="buyStep:2" ${count ? "" : "disabled"}>Continuar</button></div></div>`;
    } else {
      const M = [{ id: "pix", t: "Pix", s: "Aprovação na hora" }, { id: "card", t: "Cartão salvo", s: "Crédito •••• 4242 · até 6x" }, { id: "wallet", t: "Saldo da carteira", s: `Disponível ${brl(S.wallet.balance)}`, off: S.wallet.balance < total }];
      b += `<p class="eyebrow">Etapa 3 de 3</p><h2 class="h1">Pagamento</h2>
        <div class="sum">${TICKETS.filter((t) => B.qty[t.id]).map((t) => `<p><span>${B.qty[t.id] * nd}× ${esc(t.name)}</span><span>${brl(t.price * B.qty[t.id] * nd)}</span></p>`).join("")}<p><span>${nd > 1 ? "Dias" : "Data"}</span><span>${B.dates.map(dateLabel).join(", ")}</span></p><p class="tot"><span>Total</span><span>${brl(total)}</span></p></div>
        <div class="opts">${M.map((m) => `<button class="opt ${B.m === m.id ? "on" : ""}" data-act="buyM:${m.id}" ${m.off ? "disabled style='opacity:.4'" : ""}>${ico(m.id === "pix" ? "qr" : "wallet")}<span class="row-main"><span class="row-t">${m.t}</span><span class="row-s">${m.s}</span></span><span class="radio"></span></button>`).join("")}</div>
        <p class="small faint">Protótipo: nenhum pagamento real é feito.</p>
        <div class="footer-cta btn-row"><button class="btn btn-ghost" data-act="buyStep:1">Voltar</button><button class="btn btn-primary" data-act="buyPay">Pagar ${brl(total)}</button></div>`;
    }
    return { title: "Comprar ingressos", body: b + "</div>", tabs: false };
  };

  /* ---------- Relógio ---------- */
  SCREENS.watch = () => {
    const W = S.watch;
    let b = `<div class="stack">`;
    if (!W.paired) {
      const st = D.pair;
      if (st === 0) {
        b += `${watchHTML("agora")}<h2 class="h1 center">Pareie seu relógio</h2>
          <p class="lead center">Ele é o seu ingresso, mapa e placar. Conectado ao app, mostra a sua vez na fila, lembretes, o caminho até a atração e paga com um toque.</p>
          <div class="list">
            <div class="row">${ico("ticket")}<span class="row-main"><span class="row-t">1. Retire o relógio</span><span class="row-s">No totem da entrada, com o QR do ingresso.</span></span></div>
            <div class="row">${ico("vibrate")}<span class="row-main"><span class="row-t">2. Ligue o relógio</span><span class="row-s">Segure a coroa lateral por 2 segundos.</span></span></div>
            <div class="row">${ico("nfc")}<span class="row-main"><span class="row-t">3. Aproxime do celular</span><span class="row-s">Mantenha o Bluetooth ligado.</span></span></div>
          </div>
          <button class="btn btn-primary btn-block" data-act="pairStart">Procurar relógio</button>`;
      } else if (st === 1) {
        b += `<div class="pair-anim">${ico("watch", "var(--red-hi)")}</div><h2 class="h1 center">Procurando…</h2><p class="lead center">Aproxime o relógio do celular.</p><div style="display:grid;place-items:center"><span class="spinner"></span></div>`;
      } else if (st === 2) {
        b += `<div class="done-ico" style="background:rgba(255,46,59,.12);color:var(--red-hi)">${icon("watch")}</div><h2 class="h1 center">Relógio encontrado</h2>
          <div class="list"><div class="row">${ico("watch", "var(--red-hi)")}<span class="row-main"><span class="row-t">Relógio Detona · DP-0427</span><span class="row-s">Ingresso de ${esc(first(S.user.name))} · bateria 100%</span></span></div></div>
          <p class="small muted center">Confira se o código DP-0427 aparece na tela do relógio.</p>
          <button class="btn btn-primary btn-block" data-act="pairConfirm">Parear</button><button class="btn btn-ghost btn-block" data-act="pairCancel">Não é o meu</button>`;
      } else {
        b += `<div class="pair-anim"><span class="spinner"></span></div><h2 class="h1 center">Pareando…</h2><p class="lead center">Enviando ingresso, roteiro e lembretes.</p>`;
      }
      return { title: "Relógio", body: b + "</div>", tabs: false };
    }
    const F = [{ id: "auto", t: "Agora" }, { id: "ingresso", t: "Ingresso" }, { id: "fila", t: "Fila" }, { id: "roteiro", t: "Roteiro" }, { id: "placar", t: "Fichas" }];
    const sw = (k, t, s, ic) => `<div class="row">${ico(ic)}<span class="row-main"><span class="row-t">${t}</span><span class="row-s">${s}</span></span><button class="switch" aria-pressed="${!!W[k]}" data-act="wset:${k}" aria-label="${t}"></button></div>`;
    b += `<p class="note ok">${icon("check")}Conectado · ${esc(W.id)} · bateria 86%</p>
      ${watchHTML(D.face)}
      <div class="faces">${F.map((f) => `<button class="chip ${D.face === f.id ? "on" : ""}" data-act="face:${f.id}">${f.t}</button>`).join("")}</div>
      <p class="small muted center">Prévia do que aparece no pulso agora.</p>
      <button class="btn btn-ghost btn-block" data-act="buzz">${icon("vibrate")}Testar vibração</button>
      <div class="sec-h"><h2>No relógio</h2></div>
      <div class="list">
        ${sw("vibrate", "Vibrar com avisos", "Sua vez, reservas e lembretes", "vibrate")}
        ${sw("gps", "Caminho até a atração", "Seta e distância no relógio (GPS)", "gps")}
        ${sw("pay", "Pagar com o relógio", "Aproxime do caixa para pagar com a carteira", "nfc")}
        ${sw("ticket", "Ingresso no relógio", "Mostre o QR direto no pulso", "ticket")}
      </div>
      <button class="btn btn-ghost btn-block" data-act="unpair" style="color:var(--red-hi)">Desparear relógio</button>`;
    return { title: "Relógio", body: b + "</div>" };
  };

  /* ---------- Notificações ---------- */
  SCREENS.notes = () => {
    const b = S.notes.length
      ? `<div class="stack"><div class="sec-h" style="margin-top:0"><span class="small muted">${S.notes.filter((n) => !n.read).length} não lidas</span><button class="link" data-act="readAll">Marcar todas como lidas</button></div>
        <div class="list">${S.notes.map((n) => `<button class="row" data-act="openNote:${n.id}" style="${n.read ? "opacity:.6" : ""}">${ico(n.ico || "bell", n.c)}<span class="row-main"><span class="row-t">${esc(n.title)}</span><span class="row-s">${esc(n.body || "")}</span><span class="hud" style="margin-top:3px">${hm(n.at)}</span></span>${n.read ? "" : `<span style="width:8px;height:8px;border-radius:50%;background:var(--red-hi);flex:none"></span>`}</button>`).join("")}</div>
        <button class="btn btn-ghost btn-block" data-go="notifSettings">${icon("bell")}Preferências de aviso</button></div>`
      : `<div class="stack">${empty("bell", "Nenhum aviso por enquanto", "Aqui chegam a sua vez na fila, lembretes da programação, reservas e dicas do parque.")}<button class="btn btn-ghost btn-block" data-go="notifSettings">Preferências de aviso</button></div>`;
    return { title: "Notificações", body: b, right: "" };
  };
  SCREENS.notifSettings = () => {
    const sw = (k, t, s, ic) => `<div class="row">${ico(ic)}<span class="row-main"><span class="row-t">${t}</span><span class="row-s">${s}</span></span><button class="switch" aria-pressed="${S.notif[k] !== false}" data-act="nset:${k}" aria-label="${t}"></button></div>`;
    return { title: "Preferências de aviso", body: `<div class="stack"><div class="list">
      ${sw("fila", "Filas e reservas", "Sua vez, reservas e tempo esgotado", "timer")}
      ${sw("agenda", "Programação e eventos", "Lembretes de shows e da erupção", "calendar")}
      ${sw("dicas", "Dicas do parque", "Filas curtas e hora do lanche", "info")}
      </div><p class="small muted">Os avisos desligados continuam guardados na lista de notificações.</p></div>`, tabs: false };
  };

  /* ---------- Perfil, grupo, fotos, visita ---------- */
  SCREENS.profile = () => {
    const u = S.user;
    const b = `<div class="stack">
      <div style="display:flex;align-items:center;gap:14px"><span class="avatar lg">${esc(initial(u.name))}</span><div class="row-main"><p class="card-t">${esc(u.name)}</p><p class="row-s">${esc(u.email || "sem e-mail")}</p></div></div>
      <div class="list">
        <button class="row" data-go="tickets">${ico("ticket", "var(--red-hi)")}<span class="row-main"><span class="row-t">Meus ingressos</span><span class="row-s">${S.tickets.length} no total · ${todays().length} para hoje</span></span>${chev}</button>
        <button class="row" data-go="group">${ico("users", "var(--cyan)")}<span class="row-main"><span class="row-t">Meu grupo</span><span class="row-s">${S.group.length} ${S.group.length === 1 ? "pessoa" : "pessoas"} · alturas para as atrações</span></span>${chev}</button>
        <button class="row" data-go="watch">${ico("watch", S.watch.paired ? "var(--green)" : "var(--text)")}<span class="row-main"><span class="row-t">Relógio do parque</span><span class="row-s">${S.watch.paired ? "Conectado · " + S.watch.id : "Não pareado"}</span></span>${chev}</button>
        <button class="row" data-go="photos">${ico("camera", "var(--pink)")}<span class="row-main"><span class="row-t">Fotos do dia</span><span class="row-s">${photoList().length} fotos prontas</span></span>${chev}</button>
        <button class="row" data-go="notifSettings">${ico("bell", "var(--gold)")}<span class="row-main"><span class="row-t">Notificações</span><span class="row-s">Escolha o que quer receber</span></span>${chev}</button>
        <button class="row" data-go="visit">${ico("info")}<span class="row-main"><span class="row-t">Planeje sua visita</span><span class="row-s">Endereço, horários e perguntas frequentes</span></span>${chev}</button>
      </div>
      <div class="sec-h"><h2>Demonstração</h2></div>
      <div class="card" style="gap:12px">
        <div class="card-k"><span class="hud">Hora do parque</span><b class="px" data-live="clock" style="font-size:22px">${hm(S.clock)}</b></div>
        <div class="chips" style="margin:0;padding:0;flex-wrap:wrap">
          <button class="chip" data-act="speed"><span data-live="speed">${speedTxt()}</span></button>
          <button class="chip" data-act="skip:30">+30 min</button>
          <button class="chip" data-act="jump:1005">Ir para 16:45</button>
          <button class="chip" data-act="jump:1080">Fim do dia</button>
          <button class="chip" data-act="resetDay">Recomeçar o dia</button>
        </div>
      </div>
      <a class="btn btn-ghost btn-block" href="../">${icon("globe")}Abrir o site do parque</a>
      <button class="btn btn-ghost btn-block" data-act="resetAll" style="color:var(--red-hi)">${icon("logout")}Sair e apagar dados do protótipo</button>
    </div>`;
    return { title: "Perfil", body: b };
  };

  SCREENS.group = () => {
    const b = `<div class="stack">
      <p class="small muted">Com as alturas, o app avisa quais atrações cada pessoa pode ir e monta roteiros que funcionam para todo mundo.</p>
      <div class="list">${S.group.map((g) => {
        const no = ATTRACTIONS.filter((a) => g.h < a.minH);
        return `<div class="row"><span class="avatar" style="width:38px;height:38px;font-size:14px;background:${g.me ? "var(--red-hi)" : "var(--bg-3)"}">${esc(initial(g.name))}</span>
          <span class="row-main"><span class="row-t">${esc(g.name)}${g.me ? " (você)" : ""}${g.kid ? ` <span class="tag">criança</span>` : ""}</span><span class="row-s">${g.h} cm · ${no.length ? `não pode em ${no.length} ${no.length > 1 ? "atrações" : "atração"}` : "todas as atrações liberadas"}</span></span>
          ${g.me ? "" : `<button class="sheet-x" data-act="delMember:${g.id}" aria-label="Remover">${icon("trash")}</button>`}</div>`;
      }).join("")}</div>
      <button class="btn btn-primary btn-block" data-act="addMember">${icon("plus")}Adicionar pessoa</button>
    </div>`;
    return { title: "Meu grupo", body: b, tabs: false };
  };

  function photoList() {
    const out = [];
    S.done.forEach((d, i) => { const a = attr(d.attr); out.push({ a, t: d.t, k: i * 2 }, { a, t: d.t, k: i * 2 + 1 }); });
    if (S.seen.checkin) out.push({ a: { name: "Erupção do vulcão", island: "cola", id: "erupcao" }, t: ERUPT, k: 99 });
    return out;
  }
  SCREENS.photos = () => {
    const P = photoList();
    const b = P.length
      ? `<div class="stack"><p class="small muted">A equipe registra os melhores momentos de cada atração. As fotos ficam prontas aqui e na saída do parque.</p>
        <div class="photos">${P.map((p) => `<div class="photo" style="--c:${island(p.a.island).color}">${pix(seedOf(p.a.id) + p.k * 7, 80, 10)}<p>${esc(p.a.name)}<br><span class="hud">${hm(p.t)}</span></p></div>`).join("")}</div>
        <button class="btn btn-primary btn-block" data-act="savePhotos">Salvar todas no celular</button></div>`
      : `<div class="stack">${empty("camera", "Suas fotos aparecem aqui", "Depois de cada atração concluída pela fila virtual ou reserva, as fotos chegam no app automaticamente.", `<button class="btn btn-primary btn-sm" data-tab="park" data-act="toList">Ver atrações</button>`)}</div>`;
    return { title: "Fotos do dia", body: b };
  };

  SCREENS.visit = () => {
    const b = `<div class="stack">
      <div class="list">
        <div class="row">${ico("pin", "var(--red-hi)")}<span class="row-main"><span class="row-t">Maceió · Alagoas</span><span class="row-s">Endereço completo em breve.</span></span></div>
        <div class="row">${ico("clock", "var(--cyan)")}<span class="row-main"><span class="row-t">Todos os dias, das 9h às 18h</span><span class="row-s">Chegue cedo para curtir todas as ilhas.</span></span></div>
        <div class="row">${ico("volcano", "var(--gold)")}<span class="row-main"><span class="row-t">Erupção diária às 17h</span><span class="row-s">O grande final que todo mundo vive junto.</span></span></div>
        <div class="row">${ico("family", "var(--green)")}<span class="row-main"><span class="row-t">Para todo mundo</span><span class="row-s">Famílias com crianças, amigos e quem cresceu nos fliperamas.</span></span></div>
      </div>
      <div class="sec-h"><h2>Perguntas frequentes</h2></div>
      <div class="list">${FAQ.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
      <a class="btn btn-ghost btn-block" href="../">${icon("globe")}Conhecer o parque no site</a>
    </div>`;
    return { title: "Planeje sua visita", body: b, tabs: false };
  };

  /* =========================================================
     Folhas: QR, pagamento, minigame...
     ========================================================= */
  function openQR(id) {
    const list = id ? S.tickets.filter((t) => t.id === id) : todays();
    if (!list.length) {
      sheet(`${sheetHead("Meu ingresso")}${empty("ticket", "Nenhum ingresso para hoje", "Compre pelo app ou importe o ingresso comprado no site.", `<div class="btn-row" style="width:100%"><button class="btn btn-primary btn-sm" data-go="buy">Comprar</button><button class="btn btn-ghost btn-sm" data-act="importTicket">Importar</button></div>`)}`);
      return;
    }
    const today = list[0].date === todayISO();
    const many = list.length > 1;
    sheet(`${sheetHead(many ? `Ingressos de hoje · ${list.length}` : "Meu ingresso")}
      <div class="tix-wrap">
      ${many ? `<button type="button" class="tix-nav prev" data-act="tix:-1" aria-label="Ingresso anterior" disabled>${icon("back")}</button><button type="button" class="tix-nav next" data-act="tix:1" aria-label="Próximo ingresso">${icon("chevron")}</button>` : ""}
      <div class="rail tix-rail" id="tixRail">${list.map((t) => `<div class="ticket">
        <div class="ticket-top"><div><span class="ticket-brand"><span class="logo-mark"></span>Detona Park</span><p class="ticket-type">${esc(ttype(t.type).name)}</p></div><span class="hud" style="text-align:right">${dateLabel(t.date)}<br>${t.code}</span></div>
        <div class="qr">${qr(tq(t))}</div>
        <div class="ticket-meta"><div><span class="hud">Titular</span><b>${esc(first(t.holder))}</b></div><div><span class="hud">Horário</span><b>9h–18h</b></div><div><span class="hud">Portão</span><b>Lobby</b></div></div>
      </div>`).join("")}</div>
      </div>
      ${many ? `<div class="tix-count"><div class="dots" id="tixDots">${list.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div><span class="small muted" id="tixNum">1 de ${list.length} · ${esc(first(list[0].holder))}</span></div>` : ""}
      <p class="small muted center" style="margin:14px 0">${today ? "Brilho da tela no máximo para facilitar a leitura na catraca." : "Este ingresso vale só na data marcada."}</p>
      <div class="stack">
        ${S.watch.paired ? `<button class="btn btn-ghost btn-block" data-act="ticketWatch">${icon("watch")}Mostrar no relógio</button>` : ""}
        <button class="btn btn-ghost btn-block" data-act="addPass">${icon("wallet")}Adicionar à carteira do celular</button>
      </div>`);
    const rail = $("#tixRail");
    if (rail && many) rail.addEventListener("scroll", () => tixSync(list), { passive: true });
  }

  // Navegação lateral entre os ingressos do grupo
  function tixStep(rail) {
    const it = rail.children;
    return it.length > 1 ? it[1].offsetLeft - it[0].offsetLeft : rail.clientWidth;
  }
  function tixIndex(rail) {
    return Math.max(0, Math.min(rail.children.length - 1, Math.round(rail.scrollLeft / tixStep(rail))));
  }
  function tixSync(list) {
    const rail = $("#tixRail"); if (!rail) return;
    const i = tixIndex(rail), n = rail.children.length;
    $$("#tixDots i").forEach((d, k) => d.classList.toggle("on", k === i));
    const num = $("#tixNum"); if (num && list[i]) num.textContent = `${i + 1} de ${n} · ${first(list[i].holder)}`;
    const p = $(".tix-nav.prev"), x = $(".tix-nav.next");
    if (p) p.disabled = i === 0;
    if (x) x.disabled = i === n - 1;
  }
  function tixGo(d) {
    const rail = $("#tixRail"); if (!rail) return;
    const i = Math.max(0, Math.min(rail.children.length - 1, tixIndex(rail) + d));
    rail.scrollTo({ left: i * tixStep(rail), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  /* ---------- pedido comprado no site → app ---------- */
  function importOrder(o, fromLink = false) {
    if (S.tickets.some((t) => t.order === o.code)) {
      closeSheet(); stack = [{ name: "home", p: {} }]; render("tab");
      return toast("Esse pedido já está no app", `${o.code} · veja em Meus ingressos.`);
    }
    if (!S.onboarded) {
      // quem chega pelo link do site entra direto, sem cadastro
      S.onboarded = true;
      S.user = { name: o.buyer.name, email: o.buyer.email || "" };
      S.group = [];
      S.wallet = { balance: 0, tokens: 3, history: [{ t: "Bônus de boas-vindas", tok: 3, at: S.clock }] };
      S.earned = 3;
    }
    o.items.forEach((it, i) => {
      S.tickets.push({ id: uid() + uid(), code: it.code || `${o.code}-${i + 1}`, order: o.code, type: it.type, holder: it.holder, date: it.date || o.date, used: false });
      const name = String(it.holder || "").trim(), key = first(name).toLowerCase();
      if (!name || S.group.some((g) => first(g.name).toLowerCase() === key)) return;
      const me = !S.group.some((g) => g.me) && key === first(S.user.name).toLowerCase();
      const h = +it.h || 170;
      S.group.push({ id: me ? "me" : uid(), name: first(name), h, me, kid: h < 140 });
    });
    if (!S.group.some((g) => g.me)) S.group.unshift({ id: "me", name: first(S.user.name), h: 170, me: true });
    save(); closeSheet(); D.ob = 0;
    stack = [{ name: "home", p: {} }]; render("tab");
    const n = o.items.length, ds = o.dates || [o.date], today = ds.includes(todayISO());
    const when = ds.length > 1 ? `${ds.length} dias (${ds.map((d) => dateLabel(d).toLowerCase()).join(", ")})` : dateLabel(ds[0]).toLowerCase();
    notify({ cat: "fila", ico: "ticket", c: "var(--green)", go: ["tickets"], title: "Ingressos do site no app", body: `Pedido ${o.code}: ${n} ${n > 1 ? "ingressos" : "ingresso"} para ${when}.` });
    successSheet(fromLink ? `Bem-vindo, ${esc(first(S.user.name))}!` : "Pedido importado!",
      `${n} ${n > 1 ? "ingressos" : "ingresso"} do pedido ${o.code} para ${when}. O grupo e as alturas já foram cadastrados.`,
      `<button class="btn btn-primary btn-block" ${today ? 'data-act="openQR"' : 'data-go="tickets"'}>${today ? "Ver meus ingressos" : "Ver em Meus ingressos"}</button>
       <button class="btn btn-ghost btn-block" data-go="watch">Parear o relógio</button>`);
  }
  function importFromURL() {
    const q = new URLSearchParams(location.search);
    const code = q.get("pedido");
    if (!code) return;
    const o = ORDERS.find(code) || (q.get("p") && ORDERS.decode(q.get("p")));
    history.replaceState(null, "", location.pathname);
    if (o && o.items && o.items.length) importOrder(o, true);
    else toast("Pedido não encontrado", "Digite o código em Importar do site.");
  }

  function needTicket() {
    sheet(`${sheetHead("Falta o ingresso")}<p class="lead" style="margin-bottom:16px">Para entrar na fila virtual ou reservar, você precisa de um ingresso para hoje.</p>
      <div class="stack"><button class="btn btn-primary btn-block" data-go="buy">Comprar ingresso</button><button class="btn btn-ghost btn-block" data-act="importTicket">Já comprei pelo site</button></div>`);
  }

  function startGame() {
    let score = 0, left = 10, lit = -1;
    sheet(`${sheetHead("Detona Blocos")}<p class="lead">Toque nos blocos laranja antes que eles sumam!</p>
      <div class="card-k" style="margin:12px 0"><span class="hud">Pontos <b class="px" id="gScore" style="font-size:20px;color:var(--text)">0</b></span><span class="hud">Tempo <b class="px" id="gLeft" style="font-size:20px;color:var(--text)">10</b></span></div>
      <div class="game" id="game">${Array.from({ length: 9 }, (_, i) => `<button data-act="hit:${i}" aria-label="Bloco ${i + 1}"></button>`).join("")}</div>`);
    const cells = $$("#game button");
    const light = () => { cells.forEach((c) => c.classList.remove("lit")); lit = Math.floor(Math.random() * 9); cells[lit].classList.add("lit"); };
    light();
    ACT.hit = (i) => { if (+i === lit) { score++; $("#gScore").textContent = score; light(); } };
    gameTimer = setInterval(() => { left--; const el = $("#gLeft"); if (el) el.textContent = left; if (left % 1 === 0) light(); }, 1000);
    gameEnd = setTimeout(() => {
      clearInterval(gameTimer);
      const won = Math.max(1, Math.min(3, Math.floor(score / 4)));
      earn(won, "Minigame Detona Blocos");
      sheet(`${sheetHead("Fim de jogo!")}<div class="done-ico">${icon("star")}</div><p class="h1 center">${score} pontos</p>
        <p class="lead center" style="margin:8px 0 18px">Você ganhou <b style="color:var(--gold)">${won} ${won > 1 ? "fichas" : "ficha"}</b>. Elas já estão na sua carteira.</p>
        <div class="stack"><button class="btn btn-primary btn-block" data-act="game">Jogar de novo</button><button class="btn btn-ghost btn-block" data-act="closeSheet">Voltar para a fila</button></div>`);
    }, 10000);
  }

  function successSheet(title, text, extra = "") {
    sheet(`<div class="done-ico">${icon("check")}</div><h2 class="h1 center">${title}</h2><p class="lead center" style="margin:8px 0 20px">${text}</p><div class="stack">${extra || `<button class="btn btn-primary btn-block" data-act="closeSheet">Fechar</button>`}</div>`);
  }

  /* =========================================================
     Ações (cliques)
     ========================================================= */
  const ACT = {
    back, closeSheet,
    closeBanner: hideBanner,
    openQR: (id) => openQR(id),
    tix: (d) => tixGo(+d),
    seg: (v) => { cur().p.seg = v; render(""); },
    filter: (v) => { D.filter = v; refresh(); },
    toList: () => { stack = [{ name: "park", p: { seg: "list" } }]; render("tab"); },
    toProg: () => tab("agenda", { seg: "prog" }),
    toPlan: () => tab("agenda", { seg: "plan" }),
    toRes: () => tab("agenda", { seg: "res" }),
    toResList: () => { D.filter = "res"; tab("park", { seg: "list" }); },

    /* onboarding */
    obNext: () => { D.ob++; render("fwd"); },
    obPrev: () => { D.ob = Math.max(0, D.ob - 1); render("back"); },
    obDemo: () => { seedDemo(); D.ob = 0; stack = [{ name: "home", p: {} }]; render("tab"); toast("Modo demonstração", "Conta da Carol com 4 ingressos para hoje."); },
    obName: () => {
      const name = $("#obName").value.trim();
      if (!name) { $("#obName").focus(); $("#obName").style.borderColor = "var(--red-hi)"; return; }
      const h = Math.min(220, Math.max(80, parseInt($("#obH").value, 10) || 170));
      S.user = { name, email: $("#obEmail").value.trim() };
      S.group = [{ id: "me", name, h, me: true }];
      S.wallet = { balance: 0, tokens: 3, history: [{ t: "Bônus de boas-vindas", tok: 3, at: S.clock }] };
      S.earned = 3;
      save(); D.ob++; render("fwd");
    },
    obFinish: (how) => {
      S.onboarded = true; save();
      stack = [{ name: "home", p: {} }];
      render("tab");
      if (how === "buy") go("buy");
      if (how === "import") ACT.importTicket();
      if (how === "explore") tab("park");
    },

    /* ingressos */
    importTicket: () => {
      const last = ORDERS.all()[0];
      sheet(`${sheetHead("Importar ingresso do site")}
      <p class="lead" style="margin-bottom:14px">Digite o código do pedido que aparece na confirmação do site e no seu e-mail.</p>
      <div class="field"><label for="impCode">Código do pedido</label><input class="input" id="impCode" placeholder="DP-7K3Q" autocapitalize="characters" value="${last && !S.tickets.some((t) => t.order === last.code) ? last.code : ""}" /></div>
      <p class="small" id="impErr" style="margin:8px 0 0;color:var(--red-hi)" hidden></p>
      <p class="small faint" style="margin:8px 0 16px">${last ? "Encontramos uma compra recente deste aparelho." : "Ainda não comprou? Faça a compra no site e volte aqui."}</p>
      <div class="stack"><button class="btn btn-primary btn-block" data-act="importGo">Importar</button>
      <a class="btn btn-ghost btn-block" href="../?comprar" target="_blank" rel="noopener">${icon("globe")}Comprar pelo site</a>
      <button class="btn btn-ghost btn-block" data-act="importDemo">Usar um ingresso de exemplo</button></div>`);
    },
    importGo: () => {
      const code = $("#impCode").value.trim().toUpperCase();
      const o = code && ORDERS.find(code);
      if (!o) {
        const err = $("#impErr");
        err.textContent = code ? `Não achamos o pedido ${code} neste aparelho. Abra o link ou o QR da confirmação do site.` : "Digite o código do pedido.";
        err.hidden = false; $("#impCode").style.borderColor = "var(--red-hi)"; return;
      }
      importOrder(o);
    },
    importDemo: () => {
      const t = mkTicket("dia", S.user.name);
      S.tickets.push(t); save(); closeSheet(); refresh();
      toast("Ingresso de exemplo", `Dia no parque para hoje · ${t.code}`);
    },
    buyDate: (iso) => {
      const B = D.buy, has = B.dates.includes(iso);
      if (has && B.dates.length === 1) return toast("Escolha pelo menos um dia", "Toque em outro dia para trocar.");
      B.dates = has ? B.dates.filter((d) => d !== iso) : [...B.dates, iso].sort();
      refresh();
    },
    buyStep: (n) => { D.buy.step = +n; render(+n > 0 ? "fwd" : "back"); },
    qty: (arg) => { const [id, d] = arg.split(":"); D.buy.qty[id] = Math.max(0, Math.min(8, D.buy.qty[id] + +d)); refresh(); },
    buyM: (m) => { D.buy.m = m; refresh(); },
    buyPay: () => {
      const B = D.buy;
      const total = TICKETS.reduce((s, t) => s + t.price * B.qty[t.id], 0) * B.dates.length;
      sheet(`<div style="display:grid;place-items:center;gap:14px;padding:30px 0"><span class="spinner"></span><p class="lead">Confirmando pagamento…</p></div>`);
      setTimeout(() => {
        const names = S.group.map((g) => g.name);
        const code = "DP-" + uid();
        let n0 = 0;
        B.dates.forEach((date) => {
          let k = 0;
          TICKETS.forEach((t) => { for (let i = 0; i < B.qty[t.id]; i++) { const tk = mkTicket(t.id, names[k++] || S.user.name, date); tk.order = code; tk.code = `${code}-${++n0}`; S.tickets.push(tk); } });
        });
        ORDERS.add({ code, date: B.dates[0], dates: [...B.dates], via: "app", at: new Date().toISOString(), buyer: { name: S.user.name, email: S.user.email || "" }, items: S.tickets.filter((t) => t.order === code).map((t) => ({ type: t.type, holder: t.holder, code: t.code, date: t.date })), total, method: B.m });
        if (B.m === "wallet") { S.wallet.balance -= total; S.wallet.history.unshift({ t: "Ingressos Detona Park", v: -total, at: S.clock }); }
        const n = n0;
        const isToday = B.dates.includes(todayISO());
        const when = B.dates.length > 1 ? `${B.dates.length} dias (${B.dates.map((d) => dateLabel(d).toLowerCase()).join(", ")})` : dateLabel(B.dates[0]).toLowerCase();
        D.buy = null; save();
        stack = [{ name: "home", p: {} }]; render("tab");
        notify({ cat: "fila", ico: "ticket", c: "var(--green)", go: ["tickets"], title: "Ingressos confirmados", body: `${n} ${n > 1 ? "ingressos" : "ingresso"} para ${when}. Retire o relógio no totem da entrada.` });
        successSheet("Compra confirmada!", `Pedido ${code} · ${n} ${n > 1 ? "ingressos" : "ingresso"} · ${brl(total)}. ${isToday ? "Seu QR já está no botão central." : "Eles aparecem no botão central no dia da visita."}`,
          `<button class="btn btn-primary btn-block" data-act="openQR">Ver meu ingresso</button><button class="btn btn-ghost btn-block" data-go="planner">Montar meu roteiro</button>`);
      }, 1300);
    },
    addPass: () => toast("Adicionado à carteira do celular", "O ingresso aparece na tela de bloqueio no dia da visita."),
    ticketWatch: () => { D.face = "ingresso"; closeSheet(); go("watch"); toast("Ingresso enviado ao relógio", "Mostre o QR direto no pulso."); },

    /* fila virtual */
    joinQueue: (id) => {
      if (!hasToday()) return needTicket();
      const a = attr(id);
      if (S.queue && S.queue.attr !== id && S.queue.status !== "expired") {
        return sheet(`${sheetHead("Trocar de fila?")}<p class="lead" style="margin-bottom:16px">Você está na fila de ${esc(attr(S.queue.attr).name)}. Só dá para ficar em uma fila virtual por vez.</p>
          <div class="stack"><button class="btn btn-primary btn-block" data-act="joinForce:${id}">Trocar para ${esc(a.name)}</button><button class="btn btn-ghost btn-block" data-act="closeSheet">Ficar onde estou</button></div>`);
      }
      ACT.joinForce(id);
    },
    joinForce: (id) => {
      const a = attr(id), w = waitOf(a);
      if (w == null) return toast("Parque fechado", "A fila virtual abre às 9h.");
      const total = Math.max(5, w);
      S.queue = { id: uid(), attr: id, joinedAt: S.clock, readyAt: S.clock + total, total, status: "waiting", party: party() };
      save();
      closeSheet();
      if (cur().name === "queue") render(""); else go("queue");
      toast("Você entrou na fila", `${a.name} · cerca de ${total} min. Avisamos quando for a sua vez.`);
    },
    leaveQueue: () => { S.queue = null; save(); back(); toast("Você saiu da fila", ""); },
    queueCode: () => {
      const q = S.queue, a = attr(q.attr);
      sheet(`${sheetHead("Código de entrada")}<p class="lead" style="margin-bottom:14px">${esc(a.name)} · ${q.party} ${q.party > 1 ? "pessoas" : "pessoa"}</p>
        <div class="qr">${qr("DETONAPARK|FILA|" + q.id + "|" + a.id)}</div>
        <p class="small muted center" style="margin:12px 0 16px">${S.watch.paired && S.watch.ticket ? "Ou aproxime o relógio do leitor." : "Mostre este código para a equipe da atração."}</p>
        <button class="btn btn-primary btn-block" data-act="scanQueue">Simular leitura na entrada</button>`);
    },
    scanQueue: () => {
      const q = S.queue, a = attr(q.attr);
      S.done.push({ attr: a.id, t: S.clock });
      S.queue = null;
      earn(2, `Fila concluída · ${a.name}`);
      stack = [{ name: "home", p: {} }]; render("tab");
      successSheet("Divirta-se!", `+2 fichas na carteira. As fotos de ${esc(a.name)} ficam prontas no app e na saída.`, `<button class="btn btn-primary btn-block" data-go="photos">Ver minhas fotos</button><button class="btn btn-ghost btn-block" data-act="closeSheet">Fechar</button>`);
    },
    game: () => startGame(),
    hit: () => {},

    /* reservas */
    slot: (t) => { D.slot = +t; refresh(); },
    reserveConfirm: (id) => {
      const a = attr(id);
      S.reservations.push({ id: uid(), attr: id, t: D.slot, status: "booked", party: party() });
      const t = D.slot; D.slot = null; save();
      back();
      successSheet("Reserva confirmada", `${esc(a.name)} às ${hm(t)} para ${party()} ${party() > 1 ? "pessoas" : "pessoa"}. Vamos lembrar você 15 minutos antes${S.watch.paired ? ", no celular e no relógio" : ""}.`,
        `<button class="btn btn-primary btn-block" data-act="toRes">Ver minhas reservas</button><button class="btn btn-ghost btn-block" data-act="closeSheet">Fechar</button>`);
    },
    resCancel: (id) => sheet(`${sheetHead("Cancelar reserva?")}<p class="lead" style="margin-bottom:16px">O horário volta a ficar disponível e você recupera 1 reserva.</p>
      <div class="stack"><button class="btn btn-primary btn-block" data-act="resCancelGo:${id}">Cancelar reserva</button><button class="btn btn-ghost btn-block" data-act="closeSheet">Manter</button></div>`),
    resCancelGo: (id) => { const r = S.reservations.find((x) => x.id === id); if (r) r.status = "cancelled"; save(); closeSheet(); refresh(); toast("Reserva cancelada", ""); },
    resCode: (id) => {
      const r = S.reservations.find((x) => x.id === id), a = attr(r.attr);
      sheet(`${sheetHead("Entrada expressa")}<p class="lead" style="margin-bottom:14px">${esc(a.name)} · ${hm(r.t)}</p><div class="qr">${qr("DETONAPARK|RESERVA|" + r.id)}</div>
        <button class="btn btn-primary btn-block" style="margin-top:16px" data-act="scanRes:${id}">Simular leitura na entrada</button>`);
    },
    scanRes: (id) => {
      const r = S.reservations.find((x) => x.id === id), a = attr(r.attr);
      r.status = "done"; S.done.push({ attr: a.id, t: S.clock });
      earn(2, `Reserva concluída · ${a.name}`);
      refresh();
      successSheet("Divirta-se!", `+2 fichas na carteira. As fotos de ${esc(a.name)} chegam no app.`);
    },

    /* programação e roteiro */
    remind: (id) => {
      S.reminders[id] = !S.reminders[id]; save(); refresh();
      if (S.reminders[id]) toast("Lembrete ativado", `Avisamos 15 min antes de ${ev(id).title}${S.watch.paired ? " · também no relógio" : ""}.`);
    },
    planPick: (arg) => { const [k, v] = arg.split(":"); D.plan[k] = k === "arrive" ? +v : v; refresh(); },
    planBack: () => { D.plan.step--; render("back"); },
    planNext: () => {
      if (D.plan.step < 2) { D.plan.step++; render("fwd"); return; }
      const prefs = { who: D.plan.who, pace: D.plan.pace, arrive: D.plan.arrive };
      sheet(`<div style="display:grid;place-items:center;gap:14px;padding:30px 0"><span class="spinner"></span><p class="lead">Cruzando filas, alturas e programação…</p></div>`);
      setTimeout(() => {
        S.plan = { prefs, items: buildPlan(prefs) };
        D.plan = null; save(); closeSheet();
        tab("agenda", { seg: "plan" });
        toast("Roteiro pronto", `${S.plan.items.length} paradas, terminando na erupção.`);
      }, 1100);
    },
    planDel: (k) => { S.plan.items.splice(+k, 1); save(); refresh(); },
    planToggle: (id) => {
      if (!S.plan) S.plan = { prefs: { who: "solo", pace: "equilibrado", arrive: S.clock }, items: [{ type: "event", id: "erupcao", t: ERUPT }] };
      const i = S.plan.items.findIndex((x) => x.type === "attr" && x.id === id);
      if (i >= 0) S.plan.items.splice(i, 1);
      else {
        const lastT = S.plan.items.filter((x) => x.t < ERUPT - 20).reduce((m, x) => Math.max(m, x.t), Math.ceil(S.clock / 5) * 5);
        const t = Math.min(ERUPT - 30, Math.ceil((lastT + 30) / 5) * 5);
        S.plan.items.push({ type: "attr", id, t });
        S.plan.items.sort((a, b) => a.t - b.t);
        toast("Adicionado ao roteiro", `${attr(id).name} por volta das ${hm(t)}.`);
      }
      save(); refresh();
    },
    planToWatch: () => { D.face = "roteiro"; go("watch"); toast("Roteiro enviado ao relógio", "Cada parada vibra no pulso na hora certa."); },

    /* carteira */
    topV: (v) => { D.topup.v = +v; refresh(); },
    topM: (m) => { D.topup.m = m; refresh(); },
    topupGo: () => {
      const T = D.topup;
      sheet(`<div style="display:grid;place-items:center;gap:14px;padding:30px 0"><span class="spinner"></span><p class="lead">${T.m === "pix" ? "Aguardando o Pix…" : "Processando…"}</p></div>`);
      setTimeout(() => {
        S.wallet.balance += T.v;
        S.wallet.history.unshift({ t: `Recarga via ${T.m === "pix" ? "Pix" : "cartão"}`, v: T.v, at: S.clock });
        D.topup = null; save();
        tab("wallet");
        successSheet("Recarga feita!", `Seu novo saldo é ${brl(S.wallet.balance)}.`);
      }, 1200);
    },
    pay: () => sheet(`${sheetHead("Pagar no parque")}
      <p class="lead" style="margin-bottom:14px">Saldo ${brl(S.wallet.balance)}. Mostre o código no caixa${S.watch.paired && S.watch.pay ? " ou aproxime o relógio" : ""}.</p>
      <div class="qr">${qr("DETONAPARK|PAY|" + (S.user.email || S.user.name))}</div>
      <p class="small faint center" style="margin:12px 0">O código muda a cada minuto por segurança.</p>
      <button class="btn btn-ghost btn-block" data-act="buySnack">Simular compra: doces R$ 18,00</button>`),
    buySnack: () => {
      if (S.wallet.balance < 18) return sheet(`${sheetHead("Saldo insuficiente")}<p class="lead" style="margin-bottom:16px">Você tem ${brl(S.wallet.balance)}. Recarregue para continuar.</p><button class="btn btn-primary btn-block" data-go="topup">Recarregar</button>`);
      S.wallet.balance -= 18;
      S.wallet.history.unshift({ t: "Carrinho de Doces", v: -18, at: S.clock });
      save(); closeSheet(); refresh();
      notify({ ico: "wallet", c: "var(--green)", go: ["wallet"], title: "Pagamento aprovado · R$ 18,00", body: `Carrinho de Doces. Saldo: ${brl(S.wallet.balance)}.` });
    },
    redeem: (id) => {
      const r = REWARDS.find((x) => x.id === id);
      if (S.wallet.tokens < r.cost) return toast(`Faltam ${r.cost - S.wallet.tokens} fichas`, "Conclua filas, minigames e o check-in da erupção.");
      sheet(`${sheetHead("Trocar fichas")}<div class="reward-art" style="--c:${r.color};height:110px;margin-bottom:14px">${icon("gift")}</div>
        <p class="card-t">${esc(r.name)}</p><p class="lead" style="margin:6px 0 16px">Usa ${r.cost} das suas ${S.wallet.tokens} fichas.</p>
        <button class="btn btn-primary btn-block" data-act="redeemGo:${id}">Confirmar troca</button>`);
    },
    redeemGo: (id) => {
      const r = REWARDS.find((x) => x.id === id), code = "TR-" + uid();
      S.wallet.tokens -= r.cost;
      S.wallet.history.unshift({ t: `Troca · ${r.name}`, tok: -r.cost, at: S.clock });
      S.redeemed.unshift({ id, code });
      save(); refresh();
      successSheet("Troca feita!", `Retire o item no Balcão de Trocas, na Praça Doce, com o código <b>${code}</b>.`);
    },

    /* erupção e fim do dia */
    checkin: () => { if (S.seen.checkin) return; S.seen.checkin = 1; earn(3, "Check-in na erupção"); refresh(); toast("+3 fichas", "Você viu a erupção do vulcão!"); },
    rate: (n) => { S.rating = +n; save(); refresh(); toast("Obrigado pela avaliação!", "Sua opinião ajuda a melhorar o parque."); },
    savePhotos: () => toast("Fotos salvas", `${photoList().length} fotos na galeria do celular (simulação).`),

    /* relógio */
    pairStart: () => {
      D.pair = 1; render("");
      setTimeout(() => { if (D.pair === 1) { D.pair = 2; if (cur().name === "watch") render(""); } }, 1800);
    },
    pairCancel: () => { D.pair = 0; render(""); },
    pairConfirm: () => {
      D.pair = 3; render("");
      setTimeout(() => {
        S.watch.paired = true; S.watch.id = "DP-0427"; D.pair = 0; D.face = "auto"; save();
        if (cur().name === "watch") render("");
        notify({ ico: "watch", c: "var(--green)", go: ["watch"], title: "Relógio conectado", body: "Ingresso, roteiro e lembretes sincronizados." });
      }, 1500);
    },
    unpair: () => { S.watch.paired = false; S.watch.id = null; save(); render(""); toast("Relógio desconectado", "Devolva no totem da saída."); },
    face: (f) => { D.face = f; refresh(); },
    wset: (k) => { S.watch[k] = !S.watch[k]; save(); refresh(); },
    buzz: () => { $$(".watch").forEach((w) => { w.classList.remove("buzz"); void w.offsetWidth; w.classList.add("buzz"); }); },

    /* notificações */
    readAll: () => { S.notes.forEach((n) => (n.read = true)); save(); refresh(); },
    openNote: (id) => { const n = S.notes.find((x) => x.id === id); if (!n) return; n.read = true; save(); n.go ? navTo(n.go) : refresh(); },
    nset: (k) => { S.notif[k] = S.notif[k] === false; save(); refresh(); },

    /* grupo */
    addMember: () => sheet(`${sheetHead("Adicionar pessoa")}<div class="stack">
      <div class="field"><label for="mName">Nome</label><input class="input" id="mName" placeholder="Nome" /></div>
      <div class="field"><label for="mH">Altura (cm)</label><input class="input" id="mH" type="number" inputmode="numeric" min="60" max="220" placeholder="120" /></div>
      <button class="opt" data-act="mKid" id="mKid"><span class="row-main"><span class="row-t">É criança</span><span class="row-s">Ajuda a sugerir shows e atrações infantis</span></span><span class="radio"></span></button>
      <button class="btn btn-primary btn-block" data-act="addMemberGo">Adicionar</button></div>`),
    mKid: (_, el) => el.classList.toggle("on"),
    addMemberGo: () => {
      const name = $("#mName").value.trim();
      const h = parseInt($("#mH").value, 10);
      if (!name || !h) { (!name ? $("#mName") : $("#mH")).style.borderColor = "var(--red-hi)"; return; }
      S.group.push({ id: uid(), name, h: Math.min(220, Math.max(60, h)), kid: $("#mKid").classList.contains("on") });
      save(); closeSheet(); refresh();
      const no = ATTRACTIONS.filter((a) => h < a.minH).length;
      toast(`${name} entrou no grupo`, no ? `Não pode em ${no} ${no > 1 ? "atrações" : "atração"} por causa da altura.` : "Todas as atrações liberadas.");
    },
    delMember: (id) => { S.group = S.group.filter((g) => g.id !== id); save(); refresh(); },

    /* demonstração */
    speed: () => { S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; save(); updateLive(); toast("Relógio do parque", speedTxt()); },
    skip: (m) => jump(S.clock + +m),
    jump: (m) => jump(+m),
    resetDay: () => {
      Object.assign(S, { clock: 10 * 60 + 20, seen: {}, queue: null, reservations: [], done: [], notes: [], plan: null, rating: 0 });
      save(); tab("home"); toast("Dia recomeçado", "Hora do parque: 10:20.");
    },
    resetAll: () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignora */ } S = fresh(); D = { filter: "all", buy: null, plan: null, pair: 0, topup: null, slot: null, face: "auto", ob: 0 }; stack = [{ name: "home", p: {} }]; closeSheet(); hideBanner(); render("tab"); },
  };

  function jump(m) {
    if (!S.onboarded) ensureDemo();
    if (m <= S.clock) return toast("Esse horário já passou", "Use “Recomeçar o dia” no perfil para voltar.");
    S.clock = Math.min(CLOSE, m);
    if (S.queue && S.queue.status === "waiting" && S.queue.readyAt < S.clock) S.queue.readyAt = S.clock;
    S.reservations.forEach((r) => { if (r.status === "booked" && r.t + 20 < S.clock) r.status = "missed"; });
    triggers(); save(); refresh();
  }

  /* ---------- fluxos do painel de apresentação ---------- */
  const FLOWS = [
    { t: "Primeiro acesso", s: "cadastro", run: () => ACT.resetAll() },
    { t: "Comprar ingresso", s: "3 etapas", run: () => { ensureOnb(); stack = [{ name: "home", p: {} }]; D.buy = null; go("buy"); } },
    { t: "Compra no site → app", s: "abre o site", run: () => { window.open("../?comprar", "_blank", "noopener"); } },
    { t: "Ingresso e QR rápido", s: "botão central", run: () => { ensureDemo(); tab("home"); openQR(); } },
    { t: "Filas em tempo real", s: "ao vivo", run: () => { ensureDemo(); D.filter = "all"; tab("park", { seg: "list" }); } },
    { t: "Mapa das ilhas", s: "toque nas ilhas", run: () => { ensureDemo(); tab("park", { seg: "map" }); } },
    { t: "Fila virtual", s: "aviso de vez", run: () => { ensureDemo(); stack = [{ name: "park", p: { seg: "list" } }]; ACT.joinForce("kart"); } },
    { t: "Reservar horário", s: "entrada expressa", run: () => { ensureDemo(); stack = [{ name: "park", p: { seg: "list" } }]; D.slot = null; go("reserve", { id: "simulador" }); } },
    { t: "Programação e lembretes", s: "sino", run: () => { ensureDemo(); tab("agenda", { seg: "prog" }); } },
    { t: "Roteiro personalizado", s: "3 perguntas", run: () => { ensureDemo(); D.plan = null; stack = [{ name: "agenda", p: { seg: "plan" } }]; go("planner"); } },
    { t: "Carteira e recarga", s: "Pix e cartão", run: () => { ensureDemo(); tab("wallet"); } },
    { t: "Trocar fichas", s: "prêmios", run: () => { ensureDemo(); stack = [{ name: "wallet", p: {} }]; go("rewards"); } },
    { t: "Parear o relógio", s: "integração", run: () => { ensureDemo(); S.watch.paired = false; D.pair = 0; save(); stack = [{ name: "home", p: {} }]; go("watch"); } },
    { t: "Notificações", s: "central de avisos", run: () => { ensureDemo(); if (!S.notes.length) notify({ cat: "dicas", ico: "info", c: "var(--cyan)", go: ["park", { seg: "list" }], title: "Bem-vindo ao parque!", body: "Veja as filas mais curtas agora." }); stack = [{ name: "home", p: {} }]; go("notes"); } },
    { t: "Grupo e restrições", s: "alturas", run: () => { ensureDemo(); stack = [{ name: "home", p: {} }]; go("profile"); go("group"); } },
    { t: "Erupção das 17h", s: "check-in", run: () => { ensureDemo(); tab("home"); jump(ERUPT); } },
    { t: "Fim do dia", s: "resumo e fotos", run: () => { ensureDemo(); if (!S.done.length) S.done.push({ attr: "kart", t: 14 * 60 }, { attr: "blocos", t: 11 * 60 }); tab("home"); jump(CLOSE); } },
  ];
  function ensureOnb() { if (!S.onboarded) { seedDemo(); } }
  $("#deckFlows").innerHTML = FLOWS.map((f, i) => `<li><button type="button" data-act="flow:${i}">${f.t}<small>${f.s}</small></button></li>`).join("");
  ACT.flow = (i) => { closeSheet(); hideBanner(); FLOWS[+i].run(); };

  /* ---------- eventos globais ---------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act],[data-go],[data-tab]");
    if (!el || el.disabled) return;
    if (el.dataset.act) {
      const [n, ...rest] = el.dataset.act.split(":");
      const fn = ACT[n];
      if (fn) { fn(rest.join(":"), el, e); return; }
    }
    if (el.dataset.tab) return tab(el.dataset.tab);
    if (el.dataset.go) { const [n, id] = el.dataset.go.split(":"); go(n, id ? { id } : {}); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!$("#sheet").hidden) closeSheet(); else if (stack.length > 1) back(); }
    if (e.key === "Enter" && e.target.matches("#obName,#obEmail,#obH")) ACT.obName();
  });

  // ilhas do mapa (abre a folha com as atrações)
  ACT.island = (id) => {
    const isl = island(id), list = ATTRACTIONS.filter((a) => a.island === id);
    sheet(`${sheetHead(esc(isl.name))}<p class="eyebrow" style="color:${isl.color}">${esc(isl.hook)}</p>
      <p class="lead" style="margin:8px 0 16px">${esc(isl.text)}</p>
      <div class="card-k" style="margin-bottom:12px"><span class="hud">Intensidade</span>${meter(isl.intensity, isl.color)}</div>
      <div class="list">${list.map(attrRow).join("")}</div>`);
  };

  /* ---------- tela do computador: o aparelho e o painel encolhem para caber ---------- */
  const desk = matchMedia("(min-width: 861px)");
  function fitDesktop() {
    const dev = $(".device"), deck = $(".deck");
    if (!desk.matches) { dev.style.zoom = ""; deck.style.zoom = ""; deck.style.maxHeight = ""; return; }
    const H = innerHeight - 48, W = innerWidth - 48;
    const gap = Math.min(96, Math.max(32, innerWidth * 0.06));
    const z = Math.max(0.5, Math.min(1, H / 868, (W - gap - 300) / 414));
    dev.style.zoom = z;
    deck.style.zoom = 1; deck.style.maxHeight = "none";
    const k = Math.max(0.72, Math.min(1, H / deck.scrollHeight));
    deck.style.zoom = k;
    deck.style.maxHeight = H / k + "px";
  }
  addEventListener("resize", fitDesktop);
  document.fonts && document.fonts.ready.then(fitDesktop);

  render("");
  fitDesktop();
  importFromURL();
  setInterval(tick, 1000);
})();
