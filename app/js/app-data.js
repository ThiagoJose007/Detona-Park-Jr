/* =========================================================
   Detona Park App — dados do protótipo
   Reaproveita as ilhas, perguntas e ícones do site (window.PARK)
   e acrescenta o que só o app precisa: atrações com fila,
   programação do dia, tipos de ingresso e prêmios.
   ========================================================= */
window.APP = (() => {
  const { ISLANDS, ICONS } = window.PARK;
  const island = (id) => ISLANDS.find((i) => i.id === id);

  // Atrações de cada ilha. base = espera média (min), minH = altura mínima (cm)
  const ATTRACTIONS = [
    { id: "classicos", island: "lobby", name: "Salão dos Clássicos", kind: "Experiência", base: 5, minH: 0, dur: 20, intensity: 1, reservable: false, text: "Dezenas de máquinas de fliperama liberadas. Jogue à vontade e some fichas no seu placar." },
    { id: "torneio", island: "lobby", name: "Torneio Relâmpago", kind: "Minigame", base: 10, minH: 0, dur: 15, intensity: 2, reservable: false, text: "Partidas de 3 minutos contra outros visitantes. Quem vence leva fichas extras." },
    { id: "escalada", island: "felix", name: "Escalada do Prédio", kind: "Atração", base: 25, minH: 110, dur: 15, intensity: 3, reservable: true, text: "Suba a fachada do prédio e conserte as janelas antes que tudo desabe." },
    { id: "blocos", island: "felix", name: "Detona Blocos", kind: "Atração", base: 15, minH: 0, dur: 10, intensity: 2, reservable: false, text: "Derrube torres de blocos gigantes com as próprias mãos. Diversão garantida para os pequenos." },
    { id: "simulador", island: "heros", name: "Simulador de Voo", kind: "Atração", base: 45, minH: 130, dur: 12, intensity: 4, reservable: true, text: "Pilote a nave e defenda o parque da invasão de insetos numa missão em 360°." },
    { id: "arena", island: "heros", name: "Arena Laser", kind: "Atração", base: 30, minH: 120, dur: 15, intensity: 4, reservable: true, text: "Times de até 10 jogadores num labirinto escuro, com coletes e lasers." },
    { id: "kart", island: "sugar", name: "Kart Doce", kind: "Atração", base: 40, minH: 120, dur: 10, intensity: 4, reservable: true, text: "Personalize o seu kart e dispute largadas de 8 pilotos numa pista de doces." },
    { id: "atelie", island: "sugar", name: "Ateliê de Fantasias", kind: "Experiência", base: 10, minH: 0, dur: 20, intensity: 1, reservable: false, text: "Escolha uma fantasia e personalize o capacete antes de ir para a pista." },
    { id: "montanha", island: "cola", name: "Montanha-Russa Diet Cola", kind: "Atração", base: 60, minH: 140, dur: 8, intensity: 5, reservable: true, text: "Um percurso escuro e molhado que termina dentro da erupção do vulcão." },
    { id: "carrinho", island: "praca", name: "Carrinho de Doces", kind: "Alimentação", base: 8, minH: 0, dur: 30, intensity: 1, reservable: false, text: "Monte o seu carrinho de doces e pague direto com a carteira do app ou com o relógio." },
    { id: "trocas", island: "praca", name: "Balcão de Trocas", kind: "Loja", base: 5, minH: 0, dur: 10, intensity: 1, reservable: false, text: "Troque as fichas do dia por itens exclusivos do parque." },
  ];

  // Programação diária (horário do parque)
  const SCHEDULE = [
    { id: "abertura", t: "09:00", title: "Abertura dos portões", island: "lobby", kind: "Parque", dur: 30 },
    { id: "desfile", t: "10:30", title: "Desfile dos Pixels", island: "praca", kind: "Show", dur: 20, kids: true },
    { id: "torneio1", t: "11:30", title: "Torneio Relâmpago", island: "lobby", kind: "Minigame", dur: 30, friends: true },
    { id: "personagens", t: "13:00", title: "Encontro com personagens", island: "sugar", kind: "Encontro", dur: 40, kids: true },
    { id: "largada", t: "14:30", title: "Largada especial de 8 pilotos", island: "sugar", kind: "Evento", dur: 20, friends: true },
    { id: "missao", t: "15:30", title: "Missão em equipe contra os insetos", island: "heros", kind: "Evento", dur: 30, friends: true },
    { id: "contagem", t: "16:40", title: "Contagem regressiva da erupção", island: "praca", kind: "Show", dur: 20 },
    { id: "erupcao", t: "17:00", title: "Erupção do vulcão", island: "cola", kind: "Grande final", dur: 10, star: true },
    { id: "fechamento", t: "18:00", title: "Encerramento", island: "lobby", kind: "Parque", dur: 0 },
  ];

  const TICKETS = [
    { id: "dia", name: "Dia no parque", price: 149, desc: "Todas as ilhas, relógio incluso e 3 reservas de horário.", reservas: 3 },
    { id: "meia", name: "Meia-entrada", price: 74.5, desc: "Estudantes, crianças de 3 a 12 anos e idosos.", reservas: 3 },
    { id: "turbo", name: "Passe Turbo", price: 229, desc: "Tudo do Dia no parque, 6 reservas e entrada expressa na montanha-russa.", reservas: 6, tag: "Mais vendido" },
  ];

  const REWARDS = [
    { id: "adesivo", name: "Cartela de adesivos pixel", cost: 3, color: "#49d8ff" },
    { id: "chaveiro", name: "Chaveiro fliperama", cost: 6, color: "#ff8a1f" },
    { id: "foto", name: "Foto impressa da montanha-russa", cost: 8, color: "#ffc93c" },
    { id: "copo", name: "Copo da erupção", cost: 10, color: "#ff4fb0" },
    { id: "capacete", name: "Capacete personalizado", cost: 15, color: "#3dff8b" },
  ];

  // Ícones extras do app (mesmo traço dos ícones do site)
  Object.assign(ICONS, {
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    wallet: '<path d="M4 7a2 2 0 012-2h11v4"/><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M15.5 13h.01"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
    bellOn: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" fill="currentColor"/><path d="M10 20.5a2 2 0 004 0"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 000-6H9a3 3 0 010-6h6.8"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9c-1.5-3-5-4-5-1.5S10.5 9 12 9zM12 9c1.5-3 5-4 5-1.5S13.5 9 12 9z"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15.5 14.6c2.8-.3 5.5 1.5 5.5 4.9"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
    refresh: '<path d="M19 12a7 7 0 11-2.1-5M19 4v4h-4"/>',
    nfc: '<path d="M7 7c3 3 3 7 0 10M11 4.5c4.5 4.5 4.5 10.5 0 15M15 2c6 6 6 14 0 20"/>',
    gps: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    vibrate: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4 9v6M20 9v6M2 11v2M22 11v2"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4L12 16.3 7.2 18.9l1-5.4-4-3.8 5.4-.7z"/>',
    gamepad: '<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
    logout: '<path d="M14 5h4a2 2 0 012 2v10a2 2 0 01-2 2h-4M9 8l-4 4 4 4M5 12h11"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M10 2.5h4"/>',
  });

  return { ATTRACTIONS, SCHEDULE, TICKETS, REWARDS, island };
})();
