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
    },
    {
      id: "felix", name: "Conserta ou Detona", hook: "A escolha é sua", color: "#ff8a1f",
      intensity: 2, forWho: "Crianças e família",
      text: "Derrube blocos com as próprias mãos ou suba a parede de escalada do prédio para consertar tudo.",
    },
    {
      id: "heros", name: "Hero's Duty", hook: "Missão de soldado", color: "#3dff8b",
      intensity: 4, forWho: "Quem ama adrenalina",
      text: "Pilote o simulador de voo e defenda o parque de uma invasão de insetos. Seu controle, sua missão.",
    },
    {
      id: "sugar", name: "Sugar Rush", hook: "Corrida doce", color: "#ff4fb0",
      intensity: 4, forWho: "Família e amigos",
      text: "Escolha a fantasia, personalize seu kart e dispute largadas de 8 pilotos numa pista de doces. Mas atenção: algo escapou do jogo…",
    },
    {
      id: "cola", name: "Montanha-Russa Diet Cola", hook: "O grande final", color: "#ffc93c",
      intensity: 5, forWho: "Os mais corajosos",
      text: "Um percurso escuro e molhado que termina dentro da erupção do vulcão de refrigerante. Game over no melhor sentido.",
    },
    {
      id: "praca", name: "Praça Doce", hook: "Respira e comemora", color: "#ff2e3b",
      intensity: 1, forWho: "Todas as idades",
      text: "Monte seu carrinho de doces, personalize seu capacete e troque as fichas do dia por itens exclusivos.",
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
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  return { ISLANDS, PILLARS, STEPS, FAQ, TEAM, NAV, ICONS, icon };
})();
