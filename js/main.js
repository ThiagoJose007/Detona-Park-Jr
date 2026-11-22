/* =========================================================
   Detona Park — interações e animações (GSAP)
   Mesma base do portfólio: ScrollTrigger, ScrollSmoother,
   SplitText, CustomEase "site", menu circular + dock.
   ========================================================= */
(() => {
  "use strict";

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, ScrambleTextPlugin, CustomEase);
  CustomEase.create("site", "0.16, 1, 0.3, 1");
  gsap.defaults({ ease: "site", duration: 1 });

  const { ISLANDS, PILLARS, STEPS, FAQ, TEAM, NAV, icon } = window.PARK;
  const { S, P } = window.SCENE;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n, l) => String(Math.max(0, Math.round(n))).padStart(l, "0");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  };

  // Ícones declarados no HTML
  $$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  $("#toastClose").innerHTML = icon("close");

  /* ---------------------------------------------------------
     Smooth scroll
     --------------------------------------------------------- */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  const smoother = ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: reduceMotion ? 0 : 1.1,
    effects: true,
    smoothTouch: 0.1,
  });
  smoother.paused(true);

  const goTo = (id) => {
    const el = document.getElementById(id);
    if (el) smoother.scrollTo(el, true, "top top");
  };
  $$("[data-goto]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(el.dataset.goto);
    })
  );

  // Barra superior some ao descer e volta ao subir (mais espaço no celular)
  const nav = $("#nav");
  let navHidden = false;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const hide = self.direction === 1 && self.scroll() > 240 && !document.getElementById("menu").classList.contains("open");
      if (hide === navHidden) return;
      navHidden = hide;
      gsap.to(nav, { yPercent: hide ? -140 : 0, duration: 0.5, ease: "power3.out", overwrite: true });
    },
  });

  /* ---------------------------------------------------------
     Fichas — gamificação discreta, com aviso que fecha
     --------------------------------------------------------- */
  let tokens = 0;
  const earned = new Set();
  let muted = store.get("dp-mute") === "1";
  const tokenN = $("#tokenN");
  const tokensBtn = $("#tokens");
  const toast = $("#toast");
  const muteBtn = $("#toastMute");
  let toastTimer = null;

  function showToast(title, msg, { force = false } = {}) {
    if (muted && !force) return;
    $("#toastTitle").textContent = title;
    $("#toastMsg").textContent = msg;
    muteBtn.textContent = muted ? "Ativar avisos de fichas" : "Não mostrar mais avisos";
    toast.hidden = false;
    gsap.killTweensOf(toast);
    gsap.fromTo(toast, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4200);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    gsap.to(toast, { y: 10, autoAlpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => (toast.hidden = true) });
  }
  toast.addEventListener("pointerenter", () => clearTimeout(toastTimer));
  toast.addEventListener("pointerleave", () => (toastTimer = setTimeout(hideToast, 1800)));
  $("#toastClose").addEventListener("click", hideToast);
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    store.set("dp-mute", muted ? "1" : "0");
    hideToast();
  });

  function earn(id, msg) {
    if (earned.has(id)) return;
    earned.add(id);
    tokens++;
    tokenN.textContent = tokens;
    tokensBtn.setAttribute("aria-label", `Suas fichas: ${tokens}`);
    gsap.fromTo(tokensBtn, { scale: 1.18 }, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" });
    showToast("+1 ficha", msg);
  }
  tokensBtn.addEventListener("click", () =>
    showToast(
      `${tokens} ${tokens === 1 ? "ficha" : "fichas"}`,
      "No parque, as fichas viram itens exclusivos. Explore o site para ganhar mais.",
      { force: true }
    )
  );

  /* ---------------------------------------------------------
     Botões magnéticos
     --------------------------------------------------------- */
  if (canHover) {
    $$(".magnetic").forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.25);
        yTo((e.clientY - r.top - r.height / 2) * 0.25);
      });
      el.addEventListener("pointerleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)", overwrite: true }));
    });
  }

  /* ---------------------------------------------------------
     Menu: círculo com "MENU" girando na borda + dock
     --------------------------------------------------------- */
  const menu = $("#menu");
  const menuBtn = $("#menuBtn");
  const dockList = $("#dockList");
  dockList.innerHTML = NAV.map(
    (n) => `<li class="dock-item"><a class="dock-link" href="#${n.id}" data-id="${n.id}">
      <span class="dock-icon">${icon(n.icon)}</span><span class="dock-label">${n.label}</span></a></li>`
  ).join("");
  const dockLinks = $$(".dock-link", dockList);

  gsap.set(".dock", { autoAlpha: 0 });
  const menuTl = gsap.timeline({ paused: true })
    .set(".dock", { autoAlpha: 1 })
    .to(".menu-backdrop", { autoAlpha: 1, duration: 0.4 }, 0)
    .fromTo(".dock-bg", { scaleX: 0.2, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 0.6 }, 0)
    .fromTo(".dock-item", { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: { each: 0.04, from: "end" } }, 0.06)
    .to(".menu-disc", { backgroundColor: "#f4ecdc", duration: 0.4 }, 0)
    .to(".menu-bar", { backgroundColor: "#07060b", duration: 0.3 }, 0)
    .to(".menu-bar-top", { y: 0, rotate: 45, duration: 0.4 }, 0)
    .to(".menu-bar-bottom", { y: 0, rotate: -45, duration: 0.4 }, 0);

  const ring = $(".menu-ring");
  const ringText = $(".menu-ring-text textPath");
  gsap.set(ring, { autoAlpha: 0, scale: 0.8, transformOrigin: "50% 50%" });
  gsap.to(ring, { rotate: 360, duration: 14, ease: "none", repeat: -1 });
  const showRing = () => {
    gsap.to(ring, { autoAlpha: 1, scale: 1, duration: 0.5, overwrite: "auto" });
    gsap.fromTo(ringText, { scrambleText: { text: " " } }, { duration: 0.7, scrambleText: { text: ringText.textContent, chars: "01", speed: 0.8 } });
  };
  const hideRing = () => {
    if (menu.classList.contains("open")) return;
    gsap.to(ring, { autoAlpha: 0, scale: 0.8, duration: 0.35, overwrite: "auto" });
  };
  if (canHover) {
    menuBtn.addEventListener("pointerenter", showRing);
    menuBtn.addEventListener("pointerleave", hideRing);
  }

  function setMenu(open) {
    menu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    ringText.textContent = open ? "FECHAR • FECHAR • FECHAR •" : "MENU • MENU • MENU • MENU •";
    if (open) {
      menuTl.timeScale(1).play();
      if (canHover) showRing();
      dockLinks[0].focus({ preventScroll: true });
    } else {
      menuTl.timeScale(1.6).reverse();
      hideRing();
    }
  }
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  $(".menu-backdrop").addEventListener("click", () => setMenu(false));
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (menu.classList.contains("open")) {
      setMenu(false);
      menuBtn.focus();
    } else if (!toast.hidden) hideToast();
  });
  dockLinks.forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      setMenu(false);
      goTo(a.dataset.id);
    })
  );

  // Efeito dock: ícones crescem pela distância do ponteiro, sem se sobrepor
  dockList.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || window.innerWidth < 900) return;
    const n = dockLinks.length;
    const first = dockLinks[0].parentElement.getBoundingClientRect();
    const last = dockLinks[n - 1].parentElement.getBoundingClientRect();
    const base = (last.right - first.left) / n;
    const px = e.clientX - first.left;
    const scales = dockLinks.map((_, i) => {
      const rad = ((i * base + base / 2 - px) / base) * 0.5;
      return Math.abs(rad) < Math.PI / 2 ? 1 + 0.45 * Math.cos(rad) ** 2 : 1;
    });
    const widths = scales.map((s) => base * s);
    const total = widths.reduce((a, b) => a + b, 0);
    let acc = 0;
    dockLinks.forEach((link, i) => {
      const center = acc + widths[i] / 2;
      acc += widths[i];
      const x = center - (i * base + base / 2) - (total - n * base) / 2;
      gsap.to(link, { scale: scales[i], x, y: -(scales[i] - 1) * 12, duration: 0.25, ease: "power2.out", overwrite: "auto" });
    });
    gsap.to(".dock-bg", { scaleX: (total + 24) / (n * base + 24), duration: 0.25, ease: "power2.out", overwrite: "auto" });
  });
  dockList.addEventListener("pointerleave", () => {
    gsap.to(dockLinks, { scale: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out" });
    gsap.to(".dock-bg", { scaleX: 1, duration: 0.5, ease: "power3.out" });
  });

  /* ---------------------------------------------------------
     Revelações de texto
     --------------------------------------------------------- */
  $$("[data-reveal]").forEach((el) =>
    gsap.from(el, { y: 30, autoAlpha: 0, duration: 1.1, scrollTrigger: { trigger: el, start: "top 88%", once: true } })
  );

  /* ---------------------------------------------------------
     A EXPERIÊNCIA — frase acende com o scroll + diferenciais
     --------------------------------------------------------- */
  $("#pillars").innerHTML = PILLARS.map(
    (p) => `<li class="pillar"><span class="pillar-icon">${icon(p.icon)}</span><div><h3>${p.title}</h3><p>${p.text}</p></div></li>`
  ).join("");
  const words = SplitText.create("#statement", { type: "words" }).words;
  gsap.fromTo(words, { opacity: 0.16 }, {
    opacity: 1, ease: "none", stagger: 0.1,
    scrollTrigger: { trigger: "#statement", start: "top 82%", end: "bottom 45%", scrub: true },
  });
  gsap.from(".pillar", {
    y: 36, autoAlpha: 0, stagger: 0.1, duration: 1,
    scrollTrigger: { trigger: "#pillars", start: "top 85%", once: true },
  });

  /* ---------------------------------------------------------
     CENA 3D — coreografia por seção
     --------------------------------------------------------- */
  const N = ISLANDS.length;
  const islTo = gsap.quickTo(P, "island", { duration: 0.9, ease: "power3" });
  const parkState = (o) => gsap.to(P, { ...o, duration: 1.1, ease: "power2.inOut", overwrite: "auto" });

  const mm = gsap.matchMedia();
  mm.add({ d: "(min-width: 900px)", m: "(max-width: 899px)" }, (ctx) => {
    const d = ctx.conditions.d;
    const HERO = { x: 0, y: 0, rotY: -0.45, rotX: 0.05, scale: d ? 1 : 0.74, camX: 0, camY: 0.6, camZ: d ? 10 : 12.5, lookY: 0.4, offX: d ? 0.2 : 0, offY: d ? 0 : 0.2, opacity: 1, enter: 0 };
    const EXP = { rotY: 0.55, scale: d ? 0.95 : 0.74, offX: d ? -0.25 : 0, offY: d ? 0 : 0.2, opacity: d ? 1 : 0 };
    const EXP_FULL = { ...EXP, x: 0, y: 0, rotX: 0.05, camX: 0, camY: 0.6, lookY: 0.4, camZ: HERO.camZ, enter: 0 };
    const TUN = { x: 0, y: 0, rotY: 0, rotX: 0, scale: 1, offX: 0, offY: 0, opacity: 1, camY: 0.9, lookY: 0.9, camZ: 5.4 };
    const mix = (from, to, k) => { for (const key in to) S[key] = from[key] + (to[key] - from[key]) * k; };
    gsap.set(S, HERO);

    // O fliperama é sempre calculado a partir da posição do scroll:
    // acima do túnel vale o trecho hero → experiência; do túnel em diante,
    // vale a linha do tempo do túnel (que anima o objeto Q, não o S direto).
    // Assim, qualquer salto (ex.: "Voltar ao topo") volta ao estado certo.
    let tl, expST;
    const Q = { k: 0, camZ: TUN.camZ, enter: 0, fade: 1 };
    function applyCab() {
      const st = tl && tl.scrollTrigger;
      if (st && st.scroll() >= st.start) {
        mix(EXP_FULL, TUN, Q.k);
        if (tl.time() > 1) {
          S.camZ = Q.camZ;
          S.enter = Q.enter;
        }
        S.opacity = Q.fade;
      } else {
        mix(HERO, EXP_FULL, expST ? expST.progress : 0);
      }
    }
    // hero → experiência: o fliperama passa para o outro lado (no celular, some)
    expST = ScrollTrigger.create({ trigger: ".exp", start: "top bottom", end: "top top", onUpdate: applyCab, onRefresh: applyCab });

    // travessia: a câmera entra na tela e atravessa o túnel de fios
    tl = gsap.timeline({
      defaults: { ease: "none" },
      onUpdate: applyCab,
      scrollTrigger: {
        trigger: ".tunnel",
        start: "top top",
        end: () => "+=" + window.innerHeight * 3.2,
        pin: true,
        scrub: true,
        refreshPriority: 3,
        onEnter: () => (S.screen = "enter"),
        onEnterBack: () => (S.screen = "enter"),
        onLeaveBack: () => (S.screen = "start"),
      },
    });
    tl.to(Q, { k: 1, duration: 1, ease: "power1.inOut" })
      .fromTo(".t1", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35 }, 0.25)
      .to(".t1", { autoAlpha: 0, y: -30, duration: 0.3 }, 1.05)
      .to(Q, { camZ: 1.0, enter: 1, duration: 0.9, ease: "power2.in" }, 1)
      .to(".flash", { opacity: 0.85, duration: 0.12 }, 1.9)
      .to(Q, { camZ: 0.2, duration: 0.12 }, 1.9)
      .to(".flash", { opacity: 0, duration: 0.45 }, 2.05)
      .to(Q, { camZ: -92, duration: 2.8 }, 2.02)
      .fromTo(".t2", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35 }, 2.4)
      .to(".t2", { autoAlpha: 0, y: -30, duration: 0.3 }, 3.2)
      .fromTo(".t3", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.35 }, 3.5)
      .to(Q, { fade: 0, duration: 0.4 }, 4.45)
      .to(".t3", { autoAlpha: 0, duration: 0.3 }, 4.5);

    // estados do parque em cada seção
    const ISL_VIEW = { offX: d ? 0.2 : 0, offY: d ? 0 : 0.15, zoom: d ? 1 : 1.75 };
    const ERUPT_VIEW = { offX: d ? 0.22 : 0, offY: d ? -0.1 : 0.16, zoom: d ? 1.1 : 1.8 };
    const onActive = (trigger, fn) =>
      ScrollTrigger.create({ trigger, start: "top 55%", end: "bottom 45%", onToggle: (s) => s.isActive && fn() });
    onActive(".islands", () => {
      parkState({ opacity: 1, ...ISL_VIEW });
      if (islST) islTo(islST.progress * (N - 1));
    });
    onActive(".day", () => parkState({ opacity: 0 }));
    onActive(".erupt", () => {
      parkState({ opacity: 1, ...ERUPT_VIEW });
      islTo(4);
    });
    onActive(".visit", () => parkState({ opacity: 0 }));
  });
  // a partir das ilhas, a cena mostra o parque
  ScrollTrigger.create({ trigger: ".islands", start: "top bottom", end: "max", onToggle: (s) => (S.world = s.isActive ? 1 : 0) });

  /* ---------------------------------------------------------
     ILHAS — painel muda junto com a câmera
     --------------------------------------------------------- */
  $("#islDots").innerHTML = ISLANDS.map(
    (d, i) => `<li><button type="button" class="isl-dot" style="--c:${d.color}" data-i="${i}" aria-label="${d.name}"><span>${d.name}</span></button></li>`
  ).join("");
  $("#islTotal").textContent = pad(N, 2);
  const islDots = $$(".isl-dot");
  const islBody = $("#islBody");
  let islIdx = -1;
  const hintDesk = $(".isl-hint .hint-desk");
  const hintTouch = $(".isl-hint .hint-touch");
  function fillIsland(d) {
    islBody.style.setProperty("--c", d.color);
    $("#islHook").textContent = d.hook;
    $("#islName").textContent = d.name;
    $("#islText").textContent = d.text;
    $("#islFor").textContent = d.forWho;
    $("#islMeter").innerHTML = Array.from({ length: 5 }, (_, k) => `<i class="${k < d.intensity ? "on" : ""}"></i>`).join("");
    $("#islMeter").setAttribute("aria-label", `${d.intensity} de 5`);
    if (hintDesk) hintDesk.textContent = d.orbit ? "Role para girar · mexa o mouse para olhar" : "Mexa o mouse para olhar ao redor";
    if (hintTouch) hintTouch.textContent = d.orbit ? "Role para girar a ilha" : "Role para visitar cada ilha";
  }
  function setIsland(i, instant = false) {
    if (i === islIdx) return;
    const dir = i > islIdx ? 1 : -1;
    islIdx = i;
    const d = ISLANDS[i];
    $("#islNow").textContent = pad(i + 1, 2);
    islDots.forEach((b, k) => b.classList.toggle("is-active", k === i));
    if (instant) return fillIsland(d);
    gsap.timeline()
      .to(islBody, { autoAlpha: 0, y: -12 * dir, duration: 0.22, ease: "power2.in", overwrite: true, onComplete: () => fillIsland(d) })
      .fromTo(islBody, { autoAlpha: 0, y: 16 * dir }, { autoAlpha: 1, y: 0, duration: 0.6 });
    if (i > 0) earn("isl-" + d.id, `Você descobriu ${d.name}.`);
  }
  setIsland(0, true);
  const islST = ScrollTrigger.create({
    trigger: ".islands-pin",
    start: "top top",
    end: () => "+=" + window.innerHeight * (N - 1) * 0.8,
    pin: true,
    refreshPriority: 2,
    snap: { snapTo: 1 / (N - 1), duration: { min: 0.2, max: 0.6 }, delay: 0.12, ease: "power1.inOut" },
    onUpdate: (self) => {
      const f = self.progress * (N - 1);
      islTo(f);
      setIsland(Math.round(f));
    },
  });
  islDots.forEach((b, i) =>
    b.addEventListener("click", () => smoother.scrollTo(islST.start + ((islST.end - islST.start) * i) / (N - 1), true))
  );

  /* ---------------------------------------------------------
     SEU DIA — passos fixados + relógio que segue o mouse
     --------------------------------------------------------- */
  $("#daySteps").innerHTML = STEPS.map(
    (s, i) => `<li class="step"><button type="button" class="step-btn" data-i="${i}"><span class="step-n">${pad(i + 1, 2)}</span><span class="step-t">${s.t}</span></button><p class="step-d">${s.d}</p></li>`
  ).join("");
  $("#dayProgress").innerHTML = STEPS.map(() => "<i></i>").join("");
  const steps = $$(".step");
  const bars = $$("#dayProgress i");
  const watchScreen = $("#watchScreen");
  let stepIdx = -1;
  let waitTimer = null;
  const WATCH = {
    plan: () => `<p class="w-k">HOJE NO PARQUE</p><ul class="w-list"><li><b>10:00</b>Abertura</li><li><b>14:00</b>Sugar Rush</li><li><b>17:00</b>Erupção</li></ul>`,
    hello: () => `<p class="w-k">BEM-VINDO!</p><p class="w-big">P1</p><p class="w-s">relógio ativado ✓</p>`,
    queue: () => `<p class="w-k">FILA VIRTUAL</p><p class="w-big" id="wTime">12:00</p><p class="w-s">jogue um minigame ▶</p>`,
    turn: () => `<p class="w-k">SUA VEZ!</p><p class="w-big w-arrow">↑</p><p class="w-s">Hero's Duty · 120 m</p>`,
    photos: () => `<p class="w-k">FOTOS PRONTAS</p><p class="w-big">12</p><p class="w-s">${tokens} ${tokens === 1 ? "ficha" : "fichas"} no placar</p>`,
  };
  function setStep(i) {
    if (i === stepIdx) return;
    stepIdx = i;
    steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    bars.forEach((b, k) => b.classList.toggle("on", k <= i));
    watchScreen.innerHTML = WATCH[STEPS[i].w]();
    gsap.fromTo(watchScreen.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.5 });
    clearInterval(waitTimer);
    if (STEPS[i].w === "queue") {
      let s = 12 * 60;
      waitTimer = setInterval(() => {
        s = Math.max(0, s - 7);
        const el = $("#wTime");
        if (el) el.textContent = `${pad((s / 60) | 0, 2)}:${pad(s % 60, 2)}`;
      }, 250);
    }
    if (STEPS[i].w === "turn") {
      // o relógio "vibra"
      gsap.fromTo(".watch-body", { x: -3 }, { x: 0, duration: 0.6, ease: "elastic.out(1.4, 0.15)" });
      gsap.fromTo(".w-arrow", { rotate: -20 }, { rotate: 20, yoyo: true, repeat: -1, duration: 1.1, ease: "sine.inOut" });
    }
    if (i === STEPS.length - 1) earn("dia", "Você conheceu o relógio do parque.");
  }
  setStep(0);
  const dayST = ScrollTrigger.create({
    trigger: ".day-pin",
    start: "top top",
    end: () => "+=" + window.innerHeight * STEPS.length * 0.6,
    pin: true,
    refreshPriority: 1,
    onUpdate: (self) => setStep(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length))),
  });
  $$(".step-btn").forEach((b, i) =>
    b.addEventListener("click", () => smoother.scrollTo(dayST.start + ((dayST.end - dayST.start) * (i + 0.5)) / STEPS.length, true))
  );

  // relógio acompanha o mouse (no toque, balança sozinho)
  gsap.set("#watch", { transformPerspective: 900 });
  if (canHover && !reduceMotion) {
    const rx = gsap.quickTo("#watch", "rotationX", { duration: 0.9, ease: "power3" });
    const ry = gsap.quickTo("#watch", "rotationY", { duration: 0.9, ease: "power3" });
    window.addEventListener("pointermove", (e) => {
      ry(((e.clientX / window.innerWidth) * 2 - 1) * 24);
      rx(-((e.clientY / window.innerHeight) * 2 - 1) * 14);
    }, { passive: true });
  } else if (!reduceMotion) {
    gsap.fromTo("#watch", { rotationY: -14 }, { rotationY: 14, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  /* ---------------------------------------------------------
     ERUPÇÃO — vulcão 3D + contagem até as 17h
     --------------------------------------------------------- */
  $("#eruptBtn").addEventListener("click", () => {
    window.SCENE.erupt(1.3);
    earn("erupcao", "Você detonou o vulcão!");
  });
  ScrollTrigger.create({ trigger: ".erupt", start: "top 40%", once: true, onEnter: () => setTimeout(() => window.SCENE.erupt(1), 900) });

  const eruptEl = $("#eruptClock");
  function updateErupt() {
    const now = Date.now();
    const local = new Date(now - 3 * 3600e3); // horário de Maceió (UTC−3)
    const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 17, 0, 0) + 3 * 3600e3;
    let diff = target - now;
    if (diff < 0) diff += 24 * 3600e3;
    const s = Math.floor(diff / 1000);
    eruptEl.textContent = `${pad((s / 3600) | 0, 2)}:${pad(((s % 3600) / 60) | 0, 2)}:${pad(s % 60, 2)}`;
  }
  updateErupt();
  setInterval(updateErupt, 1000);

  /* ---------------------------------------------------------
     VISITE — perguntas frequentes, ingresso e rodapé
     --------------------------------------------------------- */
  $("#faq").innerHTML = FAQ.map(
    (f) => `<details class="faq-item"><summary><span>${f.q}</span><span class="faq-plus">${icon("plus")}</span></summary><p>${f.a}</p></details>`
  ).join("");
  $("#buyBtn").addEventListener("click", () =>
    showToast("Ingressos em breve", "Este site é um protótipo acadêmico: a venda ainda não está aberta.", { force: true })
  );
  $("#team").textContent = TEAM.join(" · ");
  gsap.from([".info", ".faq-item"], {
    y: 30, autoAlpha: 0, stagger: 0.06, duration: 1,
    scrollTrigger: { trigger: ".info-grid", start: "top 85%", once: true },
  });
  ScrollTrigger.create({ trigger: ".cta", start: "top 80%", once: true, onEnter: () => earn("visite", "Você explorou o parque inteiro!") });

  /* ---------------------------------------------------------
     ABERTURA → entrada do site
     --------------------------------------------------------- */
  const scenePromise = window.SCENE.init().catch((err) => {
    console.warn("WebGL indisponível — seguindo sem a cena 3D.", err);
    document.documentElement.classList.add("no-webgl");
  });
  Promise.all([document.fonts.ready, Promise.race([scenePromise, wait(6000)]), wait(reduceMotion ? 100 : 900)]).then(startSite);

  function startSite() {
    ScrollTrigger.refresh();
    S.paused = false;
    gsap.to(".intro", { autoAlpha: 0, duration: 0.7, ease: "power2.inOut", onComplete: () => $(".intro").remove() });
    document.documentElement.classList.remove("is-loading");
    smoother.paused(false);
    introHero();
  }

  function introHero() {
    const tl = gsap.timeline({ delay: 0.15 });
    const split = SplitText.create(".hero-title", { type: "lines", mask: "lines" });
    tl.from(split.lines, { yPercent: 110, duration: 1.3, stagger: 0.1 }, 0)
      .from([".hero .eyebrow", ".hero-sub", ".hero-actions", ".hero-hint"], { y: 22, autoAlpha: 0, stagger: 0.08, duration: 1 }, 0.25)
      .from(".nav", { y: -24, autoAlpha: 0, duration: 1 }, 0.1)
      .from(".menu-btn", { scale: 0, duration: 1, ease: "elastic.out(1, 0.5)" }, 0.5);
    if (window.SCENE.ready) tl.add(window.SCENE.playIntro(), 0);
    else scenePromise.then(() => window.SCENE.ready && window.SCENE.playIntro());
    return tl;
  }

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
