/* =========================================================
   Detona Park — compra de ingressos no site
   4 etapas: ingressos e data → quem vai → pagamento → pronto.
   O pedido fica salvo (PARK.ORDERS) e segue para o app pelo
   código, pelo link ou pelo QR da tela de confirmação.
   Protótipo: nenhum pagamento real é feito.
   ========================================================= */
(() => {
  "use strict";

  const { TICKETS, ORDERS, icon } = window.PARK;
  const root = document.getElementById("checkout");
  if (!root) return;

  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, "0");
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tt = (id) => TICKETS.find((t) => t.id === id);
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "";

  const dayISO = (o = 0) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const dateLong = (iso) => {
    if (iso === dayISO(0)) return "Hoje, " + toDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    if (iso === dayISO(1)) return "Amanhã, " + toDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const s = toDate(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function qr(text, cell = 4) {
    try {
      const q = window.qrcode(0, "M");
      q.addData(String(text).normalize("NFD").replace(/[̀-ͯ]/g, ""));
      q.make();
      return q.createSvgTag({ cellSize: cell, margin: 0, scalable: true });
    } catch (e) { return ""; }
  }
  const newCode = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "DP-"; for (let i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0]; return s; };

  const STEPS = ["Ingressos", "Quem vai", "Pagamento", "Pronto"];
  let C = null;
  const blank = (type) => ({
    step: 0, dates: [dayISO(0)],
    qty: { dia: 0, meia: 0, turbo: 0, [type || "dia"]: 1 },
    buyer: { name: "", email: "", phone: "" },
    people: [], method: "pix", inst: 1, terms: false, busy: false, err: {}, order: null,
  });

  const items = () => TICKETS.flatMap((t) => Array.from({ length: C.qty[t.id] }, () => t.id));
  const count = () => items().length;
  const days = () => C.dates.length;
  const total = () => TICKETS.reduce((s, t) => s + t.price * C.qty[t.id], 0) * days();
  const shortDate = (iso) => toDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const datesText = (list) => list.length === 1 ? dateLong(list[0]) : `${list.length} dias: ${list.map(shortDate).join(", ")}`;

  // mantém uma pessoa por ingresso, sem perder o que já foi digitado
  function syncPeople() {
    const it = items();
    C.people = it.map((type, i) => ({ type, name: (C.people[i] && C.people[i].name) || "", h: (C.people[i] && C.people[i].h) || "" }));
    if (C.people[0] && !C.people[0].name && C.buyer.name) C.people[0].name = C.buyer.name;
  }

  /* ---------- etapas ---------- */
  function stepTickets() {
    const chips = Array.from({ length: 14 }, (_, o) => {
      const iso = dayISO(o), d = toDate(iso), wd = d.getDay();
      const st = wd === 6 || wd === 0 ? "Últimas vagas" : o === 0 ? "Erupção 17h" : "Disponível";
      return `<button type="button" class="co-date ${C.dates.includes(iso) ? "on" : ""}" data-co="date:${iso}" aria-pressed="${C.dates.includes(iso)}">${C.dates.includes(iso) ? `<s>${icon("check")}</s>` : ""}
        <span class="co-date-w">${o === 0 ? "Hoje" : o === 1 ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
        <b>${pad(d.getDate())}</b><span class="co-date-m">${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
        <i class="${st === "Últimas vagas" ? "few" : ""}">${st}</i></button>`;
    }).join("");
    return `<h3 class="co-h">Quando você vem?</h3>
      <div class="co-dates" role="group" aria-label="Datas (escolha um ou mais dias)">${chips}</div>
      <p class="co-hint">${icon("calendar")}Pode marcar mais de um dia: o mesmo grupo ganha um ingresso para cada dia escolhido.${C.dates.length > 1 ? ` <b class="co-days">${C.dates.length} dias</b>` : ""}</p>
      <p class="co-hint">${icon("clock")}Aberto das 9h às 18h. A erupção do vulcão acontece todo dia às 17h.</p>
      <h3 class="co-h">Quais ingressos?</h3>
      <div class="co-tix">${TICKETS.map((t) => `<div class="co-t ${C.qty[t.id] ? "on" : ""}">
        <div><p class="co-t-name">${esc(t.name)}${t.tag ? ` <span class="co-tag">${t.tag}</span>` : ""}</p><p class="co-t-desc">${esc(t.desc)}</p><p class="co-t-price">${brl(t.price)}</p></div>
        <div class="co-qty"><button type="button" data-co="qty:${t.id}:-1" aria-label="Menos ${esc(t.name)}" ${C.qty[t.id] ? "" : "disabled"}>${icon("minus")}</button><b aria-live="polite">${C.qty[t.id]}</b><button type="button" data-co="qty:${t.id}:1" aria-label="Mais ${esc(t.name)}" ${count() >= 8 ? "disabled" : ""}>${icon("plus")}</button></div>
      </div>`).join("")}</div>
      <p class="co-hint">${icon("watch")}Cada ingresso inclui um relógio do parque, retirado no totem da entrada.</p>
      ${C.err.qty ? `<p class="co-err">${C.err.qty}</p>` : ""}${C.err.dates ? `<p class="co-err">${C.err.dates}</p>` : ""}
      ${foot(`<span></span><button type="button" class="btn btn-primary" data-co="next" ${count() ? "" : "disabled"}>Continuar · ${brl(total())}</button>`)}`;
  }

  function stepPeople() {
    const B = C.buyer, E = C.err;
    return `<h3 class="co-h">Seus dados</h3>
      <div class="co-grid">
        ${field("buyer.name", "Nome completo", B.name, { ac: "name", err: E["buyer.name"], full: true })}
        ${field("buyer.email", "E-mail", B.email, { type: "email", ac: "email", err: E["buyer.email"], hint: "Os ingressos e o código do pedido chegam aqui." })}
        ${field("buyer.phone", "Celular (opcional)", B.phone, { type: "tel", ac: "tel", hint: "Para avisos no dia da visita." })}
      </div>
      <h3 class="co-h">Quem vai usar cada ingresso</h3>
      <p class="co-hint">${icon("phone")}A altura vai para o app: ele mostra em quais atrações cada pessoa pode ir.</p>
      <div class="co-people">${C.people.map((p, i) => `<div class="co-person">
        <p class="co-person-k"><span>Ingresso ${i + 1}</span>${esc(tt(p.type).name)}</p>
        <div class="co-grid">
          ${field(`p.${i}.name`, "Nome", p.name, { err: E[`p.${i}.name`] })}
          ${field(`p.${i}.h`, "Altura (cm)", p.h, { type: "number", min: 60, max: 220, err: E[`p.${i}.h`], small: true })}
        </div></div>`).join("")}</div>
      ${foot(`<button type="button" class="btn btn-ghost" data-co="prev">Voltar</button><button type="button" class="btn btn-primary" data-co="next">Ir para o pagamento</button>`)}`;
  }

  function stepPay() {
    const tot = total();
    const pixCode = `00020126DETONAPARK${C.dates[0].replace(/-/g, "")}${String(Math.round(tot * 100)).padStart(8, "0")}5802BR5913DETONA PARK6007MACEIO`;
    const body = C.method === "pix"
      ? `<div class="co-pix"><div class="co-qr">${qr(pixCode, 4)}</div>
          <div class="co-pix-t"><p class="co-t-name">Pague com Pix</p><p class="co-t-desc">Abra o app do seu banco, escolha pagar com Pix e aponte a câmera para o código. A aprovação é na hora.</p>
          <button type="button" class="btn btn-ghost btn-sm" data-co="copy">${icon("copy")}<span>Copiar código Pix</span></button></div></div>`
      : `<div class="co-card">
          <div class="co-cc"><span class="co-cc-chip"></span><p class="co-cc-n">4242 4242 4242 4242</p><div class="co-cc-row"><span>${esc((C.buyer.name || "Seu nome").toUpperCase())}</span><span>12/30</span></div></div>
          <div class="co-grid">
            <label class="co-field full"><span>Parcelamento</span><select class="co-input" data-k="inst">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${C.inst === n ? "selected" : ""}>${n}× de ${brl(tot / n)} sem juros</option>`).join("")}</select></label>
          </div>
          <p class="co-hint">${icon("lock")}Cartão de teste do protótipo: nenhum valor é cobrado.</p>
        </div>`;
    return `<h3 class="co-h">Como você quer pagar?</h3>
      <div class="co-seg" role="tablist">
        <button type="button" role="tab" aria-selected="${C.method === "pix"}" class="${C.method === "pix" ? "on" : ""}" data-co="method:pix">Pix</button>
        <button type="button" role="tab" aria-selected="${C.method === "card"}" class="${C.method === "card" ? "on" : ""}" data-co="method:card">Cartão de crédito</button>
      </div>
      ${body}
      <div class="co-sum-inline">${summary(true)}</div>
      <label class="co-check ${C.err.terms ? "bad" : ""}"><input type="checkbox" data-k="terms" ${C.terms ? "checked" : ""} /><span>Li e aceito as regras de compra: o ingresso vale só na data escolhida e pode ser remarcado pelo app até 24 h antes.</span></label>
      ${foot(`<button type="button" class="btn btn-ghost" data-co="prev">Voltar</button><button type="button" class="btn btn-primary" data-co="pay">${C.method === "pix" ? "Já paguei o Pix" : `Pagar ${brl(tot)}`}</button>`)}`;
  }

  function stepDone() {
    const o = C.order;
    const base = location.href.replace(/[?#].*$/, "").replace(/index\.html$/, "");
    const link = ORDERS.appLink(o, base);
    return `<div class="co-done">
      <div class="co-done-top">
        <span class="co-ok">${icon("check")}</span>
        <div><h3 class="co-done-t">Compra confirmada!</h3>
        <p class="co-t-desc">Pedido <b class="co-code">${o.code}</b> · ${o.items.length} ${o.items.length > 1 ? "ingressos" : "ingresso"} · ${datesText(o.dates).toLowerCase()} · ${brl(o.total)}</p>
        <p class="co-t-desc">Enviamos os ingressos para <b>${esc(o.buyer.email)}</b>.</p></div>
      </div>
      <div class="co-done-grid">
        <section class="co-app">
          <p class="co-k">Continue no app</p>
          <div class="co-app-row">
            <div class="co-qr sm">${qr(link, 3)}</div>
            <div><p class="co-t-name">Seus ingressos já estão no app</p><p class="co-t-desc">Aponte a câmera do celular para o código. O app abre com os ingressos, o grupo e as alturas de cada pessoa.</p></div>
          </div>
          <ol class="co-steps-app">
            <li><b>1</b>Abra o app pelo código ou pelo botão abaixo.</li>
            <li><b>2</b>Ou toque em “Importar do site” e digite <b>${o.code}</b>.</li>
            <li><b>3</b>No dia, retire o relógio no totem da entrada.</li>
          </ol>
          <a class="btn btn-primary" href="${link}" target="_blank" rel="noopener">${icon("phone")}<span>Abrir no app</span></a>
        </section>
        <section>
          <p class="co-k">Ingressos</p>
          <div class="co-passes">${o.dates.map((dt) => `${o.dates.length > 1 ? `<p class="co-pass-day">${dateLong(dt)}</p>` : ""}${o.items.filter((t) => t.date === dt).map((t) => `<div class="co-pass">
            <div class="co-qr xs">${qr(`DETONAPARK|${t.code}|${t.type}|${t.date}|${t.holder}`, 2)}</div>
            <div><p class="co-t-name">${esc(t.holder)}</p><p class="co-t-desc">${esc(tt(t.type).name)} · ${t.code}</p></div>
          </div>`).join("")}`).join("")}</div>
        </section>
      </div>
      ${foot(`<button type="button" class="btn btn-ghost" data-co="again">Comprar mais ingressos</button><button type="button" class="btn btn-primary" data-co="close">Fechar</button>`)}
    </div>`;
  }

  /* ---------- peças ---------- */
  function field(k, label, v, o = {}) {
    return `<label class="co-field ${o.full ? "full" : ""} ${o.small ? "small" : ""} ${o.err ? "bad" : ""}"><span>${label}</span>
      <input class="co-input" data-k="${k}" type="${o.type || "text"}" value="${esc(v)}" ${o.ac ? `autocomplete="${o.ac}"` : ""} ${o.min ? `min="${o.min}" max="${o.max}" inputmode="numeric"` : ""} />
      ${o.err ? `<em class="co-err">${o.err}</em>` : o.hint ? `<em>${o.hint}</em>` : ""}</label>`;
  }
  const foot = (inner) => `<div class="co-foot">${inner}</div>`;

  function summary(compact = false) {
    const rows = TICKETS.filter((t) => C.qty[t.id]).map((t) => `<p><span>${C.qty[t.id] * days()}× ${esc(t.name)}${days() > 1 ? ` <small>(${C.qty[t.id]} por dia)</small>` : ""}</span><span>${brl(t.price * C.qty[t.id] * days())}</span></p>`).join("");
    return `${compact ? "" : `<p class="co-k">Resumo</p>`}
      <div class="co-sum-date">${icon("ticket")}<div>${C.dates.map((d) => `<p>${dateLong(d)}</p>`).join("")}</div></div>
      <div class="co-sum-rows">${rows || `<p class="muted">Nenhum ingresso escolhido</p>`}
        ${C.step === 2 && C.method === "card" && C.inst > 1 ? `<p><span>Parcelamento</span><span>${C.inst}× ${brl(total() / C.inst)}</span></p>` : ""}
        <p class="tot"><span>Total</span><span>${brl(total())}</span></p></div>
      ${compact ? "" : `<ul class="co-perks"><li>${icon("watch")}Relógio do parque incluso</li><li>${icon("phone")}QR de entrada no app</li><li>${icon("check")}Remarcação grátis até 24 h antes</li></ul>`}`;
  }

  /* ---------- desenho ---------- */
  function render(focus = true) {
    const s = C.step;
    const content = [stepTickets, stepPeople, stepPay, stepDone][s]();
    root.innerHTML = `<div class="co-bg" data-co="close"></div>
      <div class="co-panel" tabindex="-1">
        <header class="co-head">
          <div><p class="co-k">Detona Park · ingressos</p><h2 class="co-title" id="coTitle">${s === 3 ? "Tudo pronto" : "Comprar ingressos"}</h2></div>
          <ol class="co-steps" aria-label="Etapas">${STEPS.map((t, i) => `<li class="${i < s ? "done" : i === s ? "now" : ""}" ${i === s ? 'aria-current="step"' : ""}><b>${i < s ? icon("check") : i + 1}</b><span>${t}</span></li>`).join("")}</ol>
          <button type="button" class="co-x" data-co="close" aria-label="Fechar">${icon("close")}</button>
        </header>
        <div class="co-body ${s === 3 ? "wide" : ""}">
          <div class="co-main">${content}</div>
          ${s === 3 ? "" : `<aside class="co-sum">${summary()}</aside>`}
        </div>
        ${C.busy ? `<div class="co-busy"><span class="co-spin"></span><p>${C.method === "pix" ? "Confirmando o Pix…" : "Autorizando o cartão…"}</p></div>` : ""}
      </div>`;
    if (focus) { const m = $(".co-main"); if (m) m.scrollTop = 0; $(".co-panel").focus({ preventScroll: true }); }
  }

  /* ---------- validação ---------- */
  function validate() {
    const E = {};
    if (C.step === 0 && !count()) E.qty = "Escolha pelo menos um ingresso.";
    if (C.step === 0 && !C.dates.length) E.dates = "Escolha pelo menos um dia.";
    if (C.step === 1) {
      if (C.buyer.name.trim().split(/\s+/).length < 2) E["buyer.name"] = "Digite nome e sobrenome.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(C.buyer.email.trim())) E["buyer.email"] = "Digite um e-mail válido.";
      C.people.forEach((p, i) => {
        if (!p.name.trim()) E[`p.${i}.name`] = "Digite o nome.";
        const h = +p.h;
        if (!h || h < 60 || h > 220) E[`p.${i}.h`] = "Entre 60 e 220.";
      });
    }
    if (C.step === 2 && !C.terms) E.terms = true;
    C.err = E;
    return !Object.keys(E).length;
  }

  function pay() {
    if (!validate()) { render(false); return; }
    C.busy = true; render(false);
    setTimeout(() => {
      const code = newCode();
      C.order = {
        code, date: C.dates[0], dates: [...C.dates], via: "site", at: new Date().toISOString(),
        buyer: { name: C.buyer.name.trim(), email: C.buyer.email.trim() },
        items: C.dates.flatMap((date, di) => C.people.map((p, i) => ({ type: p.type, holder: p.name.trim(), h: +p.h, date, code: `${code}-${di * C.people.length + i + 1}` }))),
        total: total(), method: C.method,
      };
      ORDERS.add(C.order);
      C.busy = false; C.step = 3; C.err = {};
      render();
    }, 1600);
  }

  /* ---------- eventos ---------- */
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-co]");
    if (!el || el.disabled || C.busy) return;
    const [a, x, y] = el.dataset.co.split(":");
    if (a === "close") return close();
    if (a === "date") {
      const has = C.dates.includes(x);
      if (has && C.dates.length === 1) return;
      C.dates = has ? C.dates.filter((d) => d !== x) : [...C.dates, x].sort();
      C.err = {}; render(false); return;
    }
    if (a === "qty") { C.qty[x] = Math.max(0, Math.min(8, C.qty[x] + +y)); if (count() > 8) C.qty[x]--; C.err = {}; syncPeople(); render(false); return; }
    if (a === "method") { C.method = x; render(false); return; }
    if (a === "prev") { C.step--; C.err = {}; render(); return; }
    if (a === "next") { if (!validate()) { render(false); const bad = $(".bad .co-input"); if (bad) bad.focus(); return; } C.step++; C.err = {}; syncPeople(); render(); return; }
    if (a === "pay") return pay();
    if (a === "again") { C = blank(); render(); return; }
    if (a === "copy") {
      const done = () => { el.querySelector("span").textContent = "Código copiado"; };
      try { navigator.clipboard.writeText("DETONAPARK-PIX-" + total()).then(done, done); } catch (err) { done(); }
    }
  });
  root.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (k === "inst") { C.inst = +v; render(false); return; }
    if (k === "terms") { C.terms = v; C.err.terms = false; e.target.closest(".co-check").classList.remove("bad"); return; }
    const [g, i, f] = k.split(".");
    if (g === "buyer") {
      const before = C.buyer[i];
      C.buyer[i] = v;
      // o primeiro ingresso acompanha o nome do comprador enquanto não for editado
      if (i === "name" && C.people[0] && (C.people[0].name === before || !C.people[0].name)) {
        C.people[0].name = v;
        const p0 = $('[data-k="p.0.name"]'); if (p0) p0.value = v;
      }
    } else if (g === "p") C.people[+i][f] = v;
    const box = e.target.closest(".co-field");
    if (box && box.classList.contains("bad")) { box.classList.remove("bad"); const m = box.querySelector(".co-err"); if (m) m.remove(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !root.hidden && !C.busy) close(); });

  /* ---------- abrir e fechar ---------- */
  let lastFocus = null;
  const smoother = () => window.SITE && window.SITE.smoother;
  function open(o = {}) {
    if (!C || C.step === 3 || o.type) C = blank(o.type);
    syncPeople();
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add("co-open");
    const sm = smoother(); if (sm) sm.paused(true);
    render();
    if (window.gsap) gsap.fromTo(".co-panel", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 });
  }
  function close() {
    root.hidden = true;
    document.documentElement.classList.remove("co-open");
    const sm = smoother(); if (sm) sm.paused(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  /* ---------- tabela de preços na seção Visite ---------- */
  const prices = document.getElementById("prices");
  if (prices) {
    prices.innerHTML = TICKETS.map((t) => `<article class="price ${t.tag ? "hot" : ""}">
      <div class="price-top"><p class="price-name">${esc(t.name)}</p>${t.tag ? `<span class="co-tag">${t.tag}</span>` : ""}</div>
      <p class="price-v">${brl(t.price)}<span>por pessoa · relógio incluso</span></p>
      <ul class="price-perks">${t.perks.map((p) => `<li>${icon("check")}${esc(p)}</li>`).join("")}</ul>
      <button type="button" class="btn ${t.tag ? "btn-primary" : "btn-ghost"}" data-buy="${t.id}">Escolher</button>
    </article>`).join("");
    prices.addEventListener("click", (e) => { const b = e.target.closest("[data-buy]"); if (b) open({ type: b.dataset.buy }); });
    if (window.gsap && window.ScrollTrigger) {
      gsap.from(".price", { y: 30, autoAlpha: 0, stagger: 0.08, duration: 1, scrollTrigger: { trigger: ".prices", start: "top 85%", once: true } });
    }
  }

  window.CHECKOUT = { open, close };
})();
