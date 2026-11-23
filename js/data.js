/* =========================================================
   Detona Park — conteúdo do site
   Texto escrito para o visitante (personas da apresentação:
   famílias como a da Carol, jogadores curiosos como o Dave,
   grupos de amigos e adultos nostálgicos dos fliperamas).
   Edite aqui sem mexer na lógica.
   ========================================================= */
window.PARK = (() => {
  // Ilhas do parque (também viram os objetos 3D da cena)
  const ISLANDS = [
    {
      id: "lobby", name: "Lobby Fliperama", hook: "Comece jogando", color: "#49d8ff",
      intensity: 1, forWho: "Todas as idades",
      text: "Um salão aberto cheio de máquinas clássicas. Jogue à vontade enquanto o parque prepara a sua entrada.",
      orbit: { folder: "assets/islands/lobby", frames: 120, hero: 0 },
    },
    {
      id: "felix", name: "Conserta ou Detona", hook: "A escolha é sua", color: "#ff8a1f",
      intensity: 2, forWho: "Crianças e família",
      text: "Derrube blocos com as próprias mãos ou suba a parede de escalada do prédio para consertar tudo.",
      orbit: { folder: "assets/islands/conserta-felix", frames: 120, hero: 0 },
    },
    {
      id: "heros", name: "Hero's Duty", hook: "Missão de soldado", color: "#3dff8b",
      intensity: 4, forWho: "Quem ama adrenalina",
      text: "Pilote o simulador de voo e defenda o parque de uma invasão de insetos. Seu controle, sua missão.",
      orbit: { folder: "assets/islands/heros-duty", frames: 120, hero: 0 },
    },
    {
      id: "sugar", name: "Sugar Rush", hook: "Corrida doce", color: "#ff4fb0",
      intensity: 4, forWho: "Família e amigos",
      text: "Escolha a fantasia, personalize seu kart e dispute largadas de 8 pilotos numa pista de doces. Mas atenção: algo escapou do jogo…",
      orbit: { folder: "assets/islands/sugar-rush", frames: 120, hero: 0 },
    },
    {
      id: "cola", name: "Montanha-Russa Diet Cola", hook: "O grande final", color: "#ffc93c",
      intensity: 5, forWho: "Os mais corajosos",
      text: "Um percurso escuro e molhado que termina dentro da erupção do vulcão de refrigerante. Game over no melhor sentido.",
      orbit: { folder: "assets/islands/diet-cola", frames: 120, hero: 0 },
    },
    {
      id: "praca", name: "Praça Doce", hook: "Respira e comemora", color: "#ff2e3b",
      intensity: 1, forWho: "Todas as idades",
      text: "Monte seu carrinho de doces, personalize seu capacete e troque as fichas do dia por itens exclusivos.",
      orbit: { folder: "assets/islands/praca", frames: 120, hero: 0 },
    },
  ];

  // Diferenciais da experiência (seção "A experiência")
  const PILLARS = [
    { icon: "family", title: "Diversão para a família inteira", text: "Atrações para crianças, adolescentes e adultos que cresceram nos fliperamas. Ninguém fica só olhando." },
    { icon: "clock", title: "Sem ficar parado na fila", text: "Entre na fila virtual e circule à vontade. O seu relógio avisa quando chegar a sua vez." },
    { icon: "coin", title: "Cada passo vale fichas", text: "Minigames espalhados pelo parque rendem fichas que você troca por itens exclusivos." },
    { icon: "map", title: "Você nunca se perde", text: "Mapa, placas temáticas e GPS no relógio mostram onde fica cada ilha e para quem ela é indicada." },
  ];

  // Um dia no parque (o relógio muda de tela a cada passo)
  const STEPS = [
    { t: "Planeje em casa", d: "Veja as ilhas, os horários e a erupção do dia antes de sair.", w: "plan" },
    { t: "Receba seu relógio", d: "Na entrada, a equipe ativa o relógio: ele é seu ingresso, seu mapa e seu placar.", w: "hello" },
    { t: "Entre na fila virtual", d: "Cadastre-se no totem e fique livre para jogar minigames, lanchar e encontrar personagens.", w: "queue" },
    { t: "É a sua vez!", d: "O relógio vibra e o GPS mostra o caminho até a atração.", w: "turn" },
    { t: "Leve a aventura pra casa", d: "Fotos e vídeos prontos na saída, e fichas que viram prêmios.", w: "photos" },
  ];

  const FAQ = [
    { q: "Vou passar o dia em filas?", a: "Não. Você entra na fila virtual pelo totem e fica livre para aproveitar o parque. Quando chega a sua vez, o relógio vibra e mostra o caminho." },
    { q: "O parque é só para crianças?", a: "Não. Ele foi pensado para a família inteira: atrações tranquilas para os pequenos, adrenalina para os aventureiros e muita nostalgia para quem cresceu jogando fliperama." },
    { q: "Como sei em quais atrações meu filho pode ir?", a: "O mapa, as placas e o relógio mostram a indicação de cada ilha, incluindo restrições de idade e altura, para você planejar sem surpresas." },
    { q: "O que eu faço com as fichas?", a: "Você ganha fichas nos minigames e nas atrações e troca por itens limitados e lembranças do parque." },
    { q: "Como recebo minhas fotos?", a: "A equipe registra os melhores momentos de cada atração, e as fotos e vídeos ficam prontos logo na saída." },
  ];

  // Tipos de ingresso: usados pela compra no site e pelo app
  const TICKETS = [
    { id: "dia", name: "Dia no parque", price: 149, desc: "Todas as ilhas, relógio incluso e 3 reservas de horário.", reservas: 3, perks: ["Todas as 6 ilhas", "Relógio do parque incluso", "3 reservas de horário"] },
    { id: "meia", name: "Meia-entrada", price: 74.5, desc: "Estudantes, crianças de 3 a 12 anos e idosos.", reservas: 3, perks: ["Mesmos benefícios do Dia no parque", "Documento na entrada", "Crianças de 3 a 12 anos"] },
    { id: "turbo", name: "Passe Turbo", price: 229, desc: "Tudo do Dia no parque, 6 reservas e entrada expressa na montanha-russa.", reservas: 6, tag: "Mais vendido", perks: ["Tudo do Dia no parque", "6 reservas de horário", "Entrada expressa na montanha-russa"] },
  ];

  const TEAM = [
    "Emilly Vitória Soares Tavares",
    "Maysa Pereira Alves",
    "Kevin Barros de Melo Chagas",
    "Trinity Rafaela de Matos Camelo",
    "Ingrid Laryssa Freitas Silva",
    "Thiago José da Silva",
  ];

  // Itens do menu (dock)
  const NAV = [
    { id: "inicio", label: "Início", icon: "joystick" },
    { id: "experiencia", label: "Experiência", icon: "sparkle" },
    { id: "ilhas", label: "Ilhas", icon: "map" },
    { id: "seu-dia", label: "Seu dia", icon: "watch" },
    { id: "erupcao", label: "Erupção", icon: "volcano" },
    { id: "visite", label: "Ingressos", icon: "ticket" },
  ];

  // Ícones de linha (24×24, traço)
  const ICONS = {
    joystick: '<circle cx="12" cy="5" r="2.4"/><path d="M12 7.4V13"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 16.5h.01M16 16.5h.01"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    watch: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6V2.5h6V6M9 18v3.5h6V18M12 9.5V12l1.8 1.2"/>',
    volcano: '<path d="M3 20h18l-6-10H9z"/><path d="M10.5 7c-.5-2 1.5-2.5 1.5-4.5 1.2 1.5 3 2.2 2 4.5"/>',
    ticket: '<path d="M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
    family: '<circle cx="8" cy="7.5" r="2.8"/><circle cx="17" cy="9" r="2.2"/><path d="M2.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M14.5 20c.2-2.4 1.2-4 2.7-4 2 0 3.8 1.6 3.8 4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><path d="M12 9.5v5"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/>',
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  // Pedidos: o site grava, o app importa (mesmo endereço = mesmo armazenamento).
  // O link/QR leva o pedido junto, para funcionar também em outro aparelho.
  const ORDERS_KEY = "dp-orders";
  const ORDERS = {
    all() { try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch (e) { return []; } },
    add(o) { try { localStorage.setItem(ORDERS_KEY, JSON.stringify([o, ...ORDERS.all().filter((x) => x.code !== o.code)].slice(0, 20))); } catch (e) { /* sem armazenamento */ } },
    find(code) { const c = String(code || "").trim().toUpperCase(); return ORDERS.all().find((o) => o.code === c) || null; },
    // pedido pode ter vários dias: d = lista de datas, cada item guarda o índice do dia
    encode(o) {
      const ds = o.dates || [o.date];
      const s = JSON.stringify({ c: o.code, d: ds, n: o.buyer.name, i: o.items.map((t) => [t.type, t.holder, t.h || 0, Math.max(0, ds.indexOf(t.date || o.date))]) });
      return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    decode(str) {
      try {
        const j = JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/")))));
        const ds = Array.isArray(j.d) ? j.d : [j.d];
        return { code: j.c, date: ds[0], dates: ds, buyer: { name: j.n, email: "" }, items: j.i.map(([type, holder, h, di], k) => ({ type, holder, h, date: ds[di || 0], code: `${j.c}-${k + 1}` })) };
      } catch (e) { return null; }
    },
    appLink(o, base) { return `${base}app/?pedido=${encodeURIComponent(o.code)}&p=${ORDERS.encode(o)}`; },
  };

  return { ISLANDS, PILLARS, STEPS, FAQ, TEAM, NAV, TICKETS, ORDERS, ICONS, icon };
})();
