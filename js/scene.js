/* =========================================================
   Detona Park — cena 3D (Three.js)
   Mundo 0: o fliperama (acompanha o mouse) e o túnel de fios.
   Mundo 1: o parque — ilhas flutuantes ligadas por fios de
   energia; a câmera viaja de ilha em ilha e o mouse olha ao redor.
   O scroll (main.js) só anima os objetos `S` (mundo 0) e `P`
   (parque); esta cena lê os dois a cada frame.
   ========================================================= */
window.SCENE = (() => {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

  // Mundo 0 — fliperama + túnel (controlado pelo scroll)
  const S = {
    x: 0, y: 0, rotX: 0.05, rotY: -0.45, scale: 1,
    camX: 0, camY: 0.6, camZ: 10, lookY: 0.4,
    enter: 0,        // 0→1: a tela "abre" (câmera entrando)
    opacity: 1,
    offX: 0, offY: 0, // desloca o enquadramento (fração da tela)
    screen: "start",
    world: 0,        // 0 = fliperama/túnel, 1 = parque
    paused: true,    // liberado quando a abertura sai
  };
  // Mundo 1 — parque
  const P = { opacity: 0, offX: 0, offY: 0, zoom: 1, island: 0 };

  const intro = { s: 0, spin: Math.PI * 1.1 };
  const SCREENS = {
    start: { title: "PRESS START", sub: "ENTRE NO JOGO", color: "#ff2e3b", size: 58 },
    enter: { title: "ENTRANDO...", sub: "SEGURE FIRME", color: "#ff4fb0", size: 60 },
  };

  let ready = false;
  let eruptFn = () => {};

  async function init() {
    const canvas = document.getElementById("scene");
    const THREE = await import(THREE_URL);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    let dpr = Math.min(window.devicePixelRatio, 1.25);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x07060b, 16, 70);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 220);

    // ---------- Materiais ----------
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, flatShading: true, ...o });
    const glow = (color, k = 0.9) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, flatShading: true });
    const neon = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });

    // ---------- Luzes ----------
    scene.add(new THREE.HemisphereLight(0xece4ff, 0x140c20, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 8, 7);
    scene.add(key);
    const rimPink = new THREE.PointLight(0xff4fb0, 50, 24);
    rimPink.position.set(-4.5, 2.5, -2);
    scene.add(rimPink);
    const rimCyan = new THREE.PointLight(0x49d8ff, 50, 24);
    rimCyan.position.set(4.5, -1.5, -2.5);
    scene.add(rimCyan);

    /* =====================================================
       MUNDO 0 — FLIPERAMA
       ===================================================== */
    const cab = new THREE.Group();
    scene.add(cab);

    // Perfil lateral do gabinete, extrudado na largura
    const PF = [[-0.8, -2.2], [0.55, -2.2], [0.55, -0.35], [0.95, -0.2], [0.95, 0.05], [0.4, 0.3], [0.15, 1.5], [0.7, 1.62], [0.7, 2.2], [-0.8, 2.2]];
    const shape = new THREE.Shape();
    shape.moveTo(PF[0][0], PF[0][1]);
    PF.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false });
    const body = new THREE.Mesh(bodyGeo, [
      new THREE.MeshStandardMaterial({ color: 0xe3262f, roughness: 0.42, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x1d1429, roughness: 0.55, metalness: 0.15 }),
    ]);
    body.rotation.y = -Math.PI / 2;
    body.position.x = 1.1;
    cab.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 25), new THREE.LineBasicMaterial({ color: 0xff8a92, transparent: true, opacity: 0.45 }));
    edges.rotation.copy(body.rotation);
    edges.position.copy(body.position);
    cab.add(edges);

    // Tela (canvas animado)
    const scr = document.createElement("canvas");
    scr.width = 512;
    scr.height = 320;
    const sctx = scr.getContext("2d");
    const scrTex = new THREE.CanvasTexture(scr);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.12), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
    screen.position.set(0, 0.902, 0.287);
    screen.rotation.x = -0.205;
    cab.add(screen);
    const screenLight = new THREE.PointLight(0xff2e3b, 6, 4);
    screenLight.position.set(0, 0.9, 1.3);
    cab.add(screenLight);

    // Letreiro
    const mq = document.createElement("canvas");
    mq.width = 512;
    mq.height = 128;
    const mqTex = new THREE.CanvasTexture(mq);
    mqTex.colorSpace = THREE.SRGBColorSpace;
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: mqTex, toneMapped: false }));
    marquee.position.set(0, 1.91, 0.706);
    cab.add(marquee);

    // Painel: joystick + botões
    const panel = new THREE.Group();
    panel.position.set(0, 0.178, 0.675);
    panel.rotation.x = 0.43;
    cab.add(panel);
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d0912, roughness: 0.4 });
    const stickBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20), dark);
    stickBase.position.set(-0.5, 0.015, 0);
    panel.add(stickBase);
    const stick = new THREE.Group();
    stick.position.set(-0.5, 0.02, 0);
    panel.add(stick);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0xcfc6d6, metalness: 0.8, roughness: 0.25 }));
    shaft.position.y = 0.13;
    stick.add(shaft);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), new THREE.MeshStandardMaterial({ color: 0xff2e3b, roughness: 0.25 }));
    ball.position.y = 0.28;
    stick.add(ball);
    [0x49d8ff, 0xffc93c, 0xff4fb0, 0x3dff8b].forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 18), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3 }));
      b.position.set(0.02 + i * 0.22, 0.03, i % 2 ? 0.06 : -0.06);
      panel.add(b);
    });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a2133, roughness: 0.5, metalness: 0.4 }));
    door.position.set(0, -1.15, 0.56);
    cab.add(door);
    [-0.17, 0.17].forEach((x) => {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.04), neon(0xff8a1f));
      slot.position.set(x, -1.05, 0.575);
      cab.add(slot);
    });

    // ---------- Túnel de fios (mais limpo) ----------
    const tunnel = new THREE.Group();
    tunnel.visible = false;
    tunnel.position.set(0, 0.9, 0);
    scene.add(tunnel);
    const neonCols = [0xff4fb0, 0x49d8ff, 0x3dff8b, 0xffc93c, 0xff2e3b];
    const ringGeo = new THREE.TorusGeometry(2.3, 0.02, 6, 72);
    const ringMats = neonCols.map((c) => neon(c, { transparent: true, opacity: 0.75 }));
    for (let i = 0; i < 24; i++) {
      const ring = new THREE.Mesh(ringGeo, ringMats[i % neonCols.length]);
      ring.position.z = -1.5 - i * 4.2;
      ring.rotation.z = i * 0.3;
      tunnel.add(ring);
    }
    for (let w = 0; w < 6; w++) {
      const pts = [];
      const ph = (w / 6) * Math.PI * 2;
      const rr = 1.75 + (w % 2) * 0.2;
      const dir = w % 2 ? 1 : -1;
      for (let i = 0; i <= 56; i++) {
        const a = ph + i * 0.14 * dir;
        pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, -i * 2));
      }
      tunnel.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 280, 0.02, 5), neon(neonCols[w % neonCols.length])));
    }
    const sparkCount = 160;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 1.8;
      sparkPos.set([Math.cos(a) * r, Math.sin(a) * r, -Math.random() * 110], i * 3);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    tunnel.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.7, toneMapped: false })));

    /* =====================================================
       MUNDO 1 — O PARQUE
       ===================================================== */
    const park = new THREE.Group();
    park.visible = false;
    scene.add(park);

    const ISL = window.PARK.ISLANDS;
    const N = ISL.length;
    const R = 9;
    const STEP = (Math.PI * 2) / N;
    const angleOf = (f) => Math.PI / 2 + f * STEP;
    const anims = [];       // funções de animação (t, dt)
    let crater = null;      // boca do vulcão (origem da erupção)

    // ---- modelos de cada ilha (+z local = lado virado para a câmera) ----
    const MODELS = {
      lobby(g) {
        const cols = [0xe3262f, 0x2b7fff, 0xff4fb0];
        const scrs = [0x49d8ff, 0xffc93c, 0x3dff8b];
        [-0.9, 0, 0.9].forEach((x, i) => {
          const c = new THREE.Group();
          c.position.set(x, 0, i === 1 ? -0.35 : 0.05);
          c.rotation.y = -x * 0.32;
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.3, 0.56), std(cols[i]));
          b.position.y = 0.65;
          c.add(b);
          const s = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), neon(scrs[i]));
          s.position.set(0, 0.9, 0.282);
          c.add(s);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.1), neon(0xf4ecdc));
          m.position.set(0, 1.18, 0.282);
          c.add(m);
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.26), std(0x1d1429));
          p.position.set(0, 0.6, 0.36);
          p.rotation.x = 0.4;
          c.add(p);
          g.add(c);
        });
        // a ficha girando no alto
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 28), glow(0xffc93c, 0.55));
        coin.rotation.x = Math.PI / 2;
        coin.position.set(0, 2.15, 0.2);
        g.add(coin);
        anims.push((t) => {
          coin.rotation.z = t * 1.6;
          coin.position.y = 2.15 + Math.sin(t * 1.8) * 0.12;
        });
      },
      felix(g) {
        const bld = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 1.0), std(0x9a4a35));
        bld.position.set(-0.35, 1.05, -0.25);
        g.add(bld);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.12, 1.12), std(0x2a1d2c));
        roof.position.set(-0.35, 2.16, -0.25);
        g.add(roof);
        const lit = neon(0xffd27a), off = std(0x2a1a22);
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 3; c++) {
            const w = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.26), (r * 3 + c) % 4 === 1 ? off : lit);
            w.position.set(-0.35 - 0.38 + c * 0.38, 0.45 + r * 0.45, 0.252);
            g.add(w);
          }
        const hammer = new THREE.Group();
        hammer.position.set(1.05, 1.0, 0.35);
        g.add(hammer);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 8), std(0x7a3b1e));
        handle.position.y = 0.47;
        hammer.add(handle);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.28), std(0xffc93c, { metalness: 0.35, roughness: 0.35 }));
        head.position.y = 0.98;
        hammer.add(head);
        const blocks = [[0.35, 0.95, 0.3], [0.75, 1.25, -0.4], [-1.1, 1.1, 0.6], [0.2, 1.45, 0.8]];
        const bm = std(0xc8532f);
        blocks.forEach(([x, z, r]) => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), bm);
          b.position.set(x, 0.14, z);
          b.rotation.y = r;
          g.add(b);
        });
        anims.push((t) => {
          hammer.rotation.z = 0.35 + Math.sin(t * 2.2) * 0.45;
          hammer.position.y = 1.0 + Math.sin(t * 1.1) * 0.08;
        });
      },
      heros(g) {
        const ship = new THREE.Group();
        ship.position.set(0, 1.45, 0);
        g.add(ship);
        const metal = std(0xa8b8cc, { metalness: 0.45, roughness: 0.35 });
        const fus = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.6, 6), metal);
        fus.rotation.z = -Math.PI / 2;
        ship.add(fus);
        const wings = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 1.7), metal);
        wings.position.x = -0.1;
        ship.add(wings);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.05), metal);
        fin.position.set(-0.6, 0.2, 0);
        ship.add(fin);
        const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), neon(0x49d8ff));
        cockpit.position.set(0.22, 0.13, 0);
        ship.add(cockpit);
        const engine = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), neon(0x3dff8b));
        engine.position.x = -0.8;
        ship.add(engine);
        const pad = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 6, 40), neon(0x3dff8b, { transparent: true, opacity: 0.6 }));
        pad.rotation.x = Math.PI / 2;
        pad.position.y = 0.03;
        g.add(pad);
        const bugMat = glow(0x3dff8b, 0.5);
        const bugs = [0, 1, 2, 3].map((k) => {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), bugMat);
          g.add(b);
          return b;
        });
        anims.push((t) => {
          ship.position.y = 1.45 + Math.sin(t * 1.4) * 0.15;
          ship.rotation.x = Math.sin(t * 0.9) * 0.28;
          ship.rotation.y = Math.sin(t * 0.5) * 0.35;
          bugs.forEach((b, k) => {
            const a = t * 0.8 + (k * Math.PI) / 2;
            b.position.set(Math.cos(a) * 1.55, 0.7 + k * 0.32 + Math.sin(t * 2 + k) * 0.1, Math.sin(a) * 1.55);
            b.rotation.set(t * 1.5 + k, t + k, 0);
          });
        });
      },
      sugar(g) {
        const track = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.13, 8, 64), std(0xff4fb0));
        track.rotation.x = Math.PI / 2;
        track.position.y = 0.13;
        g.add(track);
        const kart = new THREE.Group();
        g.add(kart);
        const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.26), std(0xffc93c));
        kb.position.y = 0.13;
        kart.add(kb);
        const driver = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), std(0x49d8ff));
        driver.position.set(-0.04, 0.27, 0);
        kart.add(driver);
        const wm = std(0x16101f);
        [[0.14, 0.13], [0.14, -0.13], [-0.14, 0.13], [-0.14, -0.13]].forEach(([x, z]) => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10), wm);
          w.rotation.x = Math.PI / 2;
          w.position.set(x, 0.07, z);
          kart.add(w);
        });
        const stripeA = std(0xff2e3b), stripeB = std(0xf4ecdc);
        [[-0.45, -0.3, 1.25, 0xff4fb0], [0.4, -0.55, 1.6, 0x49d8ff], [0.1, 0.5, 1.0, 0xffc93c]].forEach(([x, z, h, c]) => {
          const segs = 6;
          for (let s = 0; s < segs; s++) {
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h / segs, 8), s % 2 ? stripeA : stripeB);
            seg.position.set(x, (h / segs) * (s + 0.5), z);
            g.add(seg);
          }
          const pop = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), std(c, { roughness: 0.3 }));
          pop.position.set(x, h + 0.2, z);
          g.add(pop);
        });
        anims.push((t) => {
          const a = t * 0.9;
          kart.position.set(Math.cos(a) * 1.45, 0.14, Math.sin(a) * 1.45);
          kart.rotation.y = -a - Math.PI / 2;
        });
      },
      cola(g) {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 1.6, 2.2, 10), std(0x6b3a22));
        cone.position.y = 1.1;
        g.add(cone);
        const top = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), neon(0xffb347));
        top.rotation.x = -Math.PI / 2;
        top.position.y = 2.205;
        g.add(top);
        const foam = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 20), std(0xf4ecdc));
        foam.rotation.x = Math.PI / 2;
        foam.position.y = 2.2;
        g.add(foam);
        crater = top;
        // trilho da montanha-russa em espiral
        const pts = [];
        for (let k = 0; k <= 120; k++) {
          const a = k * 0.16;
          const r = 1.9 - k * 0.0085;
          pts.push(new THREE.Vector3(Math.cos(a) * r, 0.3 + k * 0.016, Math.sin(a) * r));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.035, 5), neon(0xffc93c)));
        const cart = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), std(0xff2e3b));
        g.add(cart);
        const tan = new THREE.Vector3();
        anims.push((t) => {
          const u = (t * 0.09) % 1;
          curve.getPointAt(u, cart.position);
          cart.position.y += 0.08;
          curve.getTangentAt(u, tan);
          cart.lookAt(cart.position.x + tan.x, cart.position.y + tan.y, cart.position.z + tan.z);
        });
      },
      praca(g) {
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.3, 12), std(0x2a1d2c));
        ped.position.set(-0.5, 0.15, 0);
        g.add(ped);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 12), std(0xd9893a));
        cone.rotation.x = Math.PI;
        cone.position.set(-0.5, 0.8, 0);
        g.add(cone);
        const scoops = new THREE.Group();
        scoops.position.set(-0.5, 0, 0);
        g.add(scoops);
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 12), std(0xff4fb0, { roughness: 0.4 }));
        s1.position.y = 1.42;
        scoops.add(s1);
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), std(0xf4ecdc, { roughness: 0.4 }));
        s2.position.set(0.05, 1.83, 0);
        scoops.add(s2);
        [[0.85, -0.55, 0xff2e3b], [0.95, 0.75, 0x49d8ff]].forEach(([x, z, c]) => {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6), std(0xf4ecdc));
          pole.position.set(x, 0.58, z);
          g.add(pole);
          const top = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 8), std(c));
          top.position.set(x, 1.25, z);
          g.add(top);
          const table = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14), std(0xf4ecdc));
          table.position.set(x, 0.5, z);
          g.add(table);
        });
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xff2e3b, { roughness: 0.3 }));
        helmet.position.set(-0.05, 0.02, 1.05);
        g.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.05), neon(0x49d8ff));
        visor.position.set(-0.05, 0.16, 1.32);
        g.add(visor);
        anims.push((t) => (scoops.rotation.y = t * 0.6));
      },
    };

    // ---- ilhas ----
    const islands = ISL.map((d, i) => {
      const a = angleOf(i);
      const g = new THREE.Group();
      const baseY = Math.sin(i * 1.7) * 0.5;
      g.position.set(Math.cos(a) * R, baseY, Math.sin(a) * R);
      g.rotation.y = Math.PI / 2 - a;
      const col = new THREE.Color(d.color);
      const slab = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.1, 0.4, 40), std(0x1a1524, { flatShading: false }));
      slab.position.y = -0.2;
      g.add(slab);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(2.25, 40), std(col.clone().lerp(new THREE.Color(0x0e0b14), 0.82), { flatShading: false }));
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = 0.002;
      g.add(cap);
      const rock = new THREE.Mesh(new THREE.ConeGeometry(2.05, 2.4, 9), std(0x120e19));
      rock.rotation.x = Math.PI;
      rock.position.y = -1.6;
      g.add(rock);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.022, 6, 72), neon(d.color));
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      MODELS[d.id]?.(g, col);
      park.add(g);
      return { g, baseY, a };
    });

    // ---- fios de energia entre as ilhas + pulsos ----
    const curves = [];
    for (let i = 0; i < N; i++) {
      const A = islands[i].g.position, B = islands[(i + 1) % N].g.position;
      const dir = B.clone().sub(A).normalize();
      const s = A.clone().addScaledVector(dir, 2.15).add(new THREE.Vector3(0, -0.25, 0));
      const e = B.clone().addScaledVector(dir, -2.15).add(new THREE.Vector3(0, -0.25, 0));
      const m = s.clone().lerp(e, 0.5).add(new THREE.Vector3(0, -1.3, 0));
      const curve = new THREE.QuadraticBezierCurve3(s, m, e);
      curves.push(curve);
      park.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.028, 5), neon(ISL[i].color, { transparent: true, opacity: 0.7 })));
    }
    const PULSES = 3;
    const pulsePos = new Float32Array(N * PULSES * 3);
    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute("position", new THREE.BufferAttribute(pulsePos, 3));
    park.add(new THREE.Points(pulseGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, toneMapped: false })));
    const tmpV = new THREE.Vector3();

    // ---- estrelas discretas ao fundo do parque ----
    const starN = 320;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 1.6 - 0.6), r = 38 + Math.random() * 20;
      starPos.set([Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    park.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbdb3cc, size: 0.09, transparent: true, opacity: 0.55, fog: false })));

    // ---- erupção (partículas de refrigerante) ----
    const EN = 700;
    const ePos = new Float32Array(EN * 3).fill(-999);
    const eVel = new Float32Array(EN * 3);
    const eLife = new Float32Array(EN);
    const eCol = new Float32Array(EN * 3);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(ePos, 3));
    eGeo.setAttribute("color", new THREE.BufferAttribute(eCol, 3));
    const eMat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    park.add(new THREE.Points(eGeo, eMat));
    const ePal = [0xf4ecdc, 0xffffff, 0xffc93c, 0xff8a1f, 0xb5652a, 0xff4fb0].map((c) => new THREE.Color(c));
    const eLight = new THREE.PointLight(0xffb347, 0, 14);
    park.add(eLight);
    let eCursor = 0, eAlive = 0;
    const origin = new THREE.Vector3();
    eruptFn = (power = 1) => {
      if (!crater) return;
      crater.getWorldPosition(origin);
      eLight.position.copy(origin).add(new THREE.Vector3(0, 1, 0));
      const count = Math.round(260 * power);
      for (let k = 0; k < count; k++) {
        const i = eCursor++ % EN;
        ePos.set([origin.x + (Math.random() - 0.5) * 0.4, origin.y + 0.05, origin.z + (Math.random() - 0.5) * 0.4], i * 3);
        const sp = 0.6 + Math.random();
        eVel.set([(Math.random() - 0.5) * 2.6 * sp, (3.6 + Math.random() * 3.2) * power, (Math.random() - 0.5) * 2.6 * sp], i * 3);
        eLife[i] = 1;
        const c = ePal[(Math.random() * ePal.length) | 0];
        eCol.set([c.r, c.g, c.b], i * 3);
      }
      eAlive = EN;
      eGeo.attributes.color.needsUpdate = true;
      gsap.fromTo(eLight, { intensity: 60 }, { intensity: 0, duration: 2.2, ease: "power2.out" });
    };
    function updateErupt(dt) {
      if (!eAlive) return;
      let alive = 0;
      for (let i = 0; i < EN; i++) {
        if (eLife[i] <= 0) continue;
        const j = i * 3;
        eVel[j + 1] -= 8.5 * dt;
        ePos[j] += eVel[j] * dt;
        ePos[j + 1] += eVel[j + 1] * dt;
        ePos[j + 2] += eVel[j + 2] * dt;
        eLife[i] -= dt * 0.42;
        if (eLife[i] <= 0 || ePos[j + 1] < origin.y - 4) {
          eLife[i] = 0;
          ePos[j + 1] = -999;
        } else alive++;
      }
      eAlive = alive;
      eGeo.attributes.position.needsUpdate = true;
    }

    /* =====================================================
       TELA DO FLIPERAMA (canvas 2D)
       ===================================================== */
    const stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * 512, y: Math.random() * 320, v: 0.4 + Math.random() * 1.6,
      s: Math.random() < 0.2 ? 4 : 2, c: Math.random() < 0.15 ? "#ff4fb0" : "#f4ecdc",
    }));
    function drawMarquee() {
      const c = mq.getContext("2d");
      const g = c.createLinearGradient(0, 0, 512, 0);
      g.addColorStop(0, "#b3121f");
      g.addColorStop(0.5, "#ff2e3b");
      g.addColorStop(1, "#ff4fb0");
      c.fillStyle = g;
      c.fillRect(0, 0, 512, 128);
      c.font = '700 66px "Pixelify Sans", monospace';
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#16101f";
      c.fillText("DETONA PARK", 259, 69);
      c.fillStyle = "#f4ecdc";
      c.fillText("DETONA PARK", 256, 66);
      mqTex.needsUpdate = true;
    }
    function drawScreen(t) {
      const c = sctx, W = 512, H = 320;
      c.fillStyle = "#07060b";
      c.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.x -= s.v * (1 + S.enter * 8);
        if (s.x < -4) s.x = W + 4;
        c.fillStyle = s.c;
        c.fillRect(s.x | 0, s.y | 0, s.s, s.s);
      }
      const cfg = SCREENS[S.screen] || SCREENS.start;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `700 ${cfg.size}px "Pixelify Sans", monospace`;
      c.fillStyle = "#16101f";
      c.fillText(cfg.title, W / 2 + 4, H / 2 - 6);
      c.fillStyle = cfg.color;
      c.fillText(cfg.title, W / 2, H / 2 - 10);
      if (Math.floor(t * 2.2) % 2 === 0) {
        c.font = '22px "Silkscreen", monospace';
        c.fillStyle = "#f4ecdc";
        c.fillText(cfg.sub, W / 2, H / 2 + 52);
      }
      if (S.enter > 0.01) {
        const cols = ["#ff4fb0", "#49d8ff", "#3dff8b", "#ffc93c"];
        for (let i = 0; i < 9; i++) {
          const k = (t * 0.9 + i / 9) % 1;
          const w = k * W * 1.3, h = k * H * 1.3;
          c.strokeStyle = cols[i % 4];
          c.globalAlpha = S.enter * (1 - k);
          c.lineWidth = 6;
          c.strokeRect(W / 2 - w / 2, H / 2 - h / 2, w, h);
        }
        c.globalAlpha = Math.max(0, S.enter - 0.6) * 2;
        c.fillStyle = "#ffffff";
        c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
      }
      c.fillStyle = "rgba(0,0,0,.2)";
      for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2);
      scrTex.needsUpdate = true;
    }

    /* =====================================================
       LOOP
       ===================================================== */
    // Ponteiro (mouse ou dedo). Sem movimento por um tempo, a cena "respira" sozinha.
    const pointer = { x: 0, y: 0 }, pl = { x: 0, y: 0 };
    let lastMove = -10;
    window.addEventListener("pointermove", (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      lastMove = performance.now() / 1000;
    }, { passive: true });

    let vw = 1, vh = 1;
    function resize() {
      vw = window.innerWidth;
      vh = window.innerHeight;
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    await document.fonts.ready;
    drawMarquee();

    let lastScreen = -1;
    const start = performance.now();
    let prev = start, lastFrame = start, slowFrames = 0, sampled = 0;
    function adapt(now) {
      const dt = now - lastFrame;
      lastFrame = now;
      if (dt > 250) return;
      sampled++;
      if (dt > 34) slowFrames++;
      if (sampled >= 90) {
        if (slowFrames > 45 && dpr > 0.6) {
          dpr = Math.max(0.6, dpr - 0.2);
          renderer.setPixelRatio(dpr);
          resize();
        }
        sampled = slowFrames = 0;
      }
    }

    const target = new THREE.Vector3();
    function parkCamera() {
      const f = Math.min(N - 1, Math.max(0, P.island));
      const i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1), k = f - i0;
      const p0 = islands[i0].g.position, p1 = islands[i1].g.position;
      target.lerpVectors(p0, p1, k);
      const a = angleOf(f) + pl.x * 0.5;
      const dist = 8.6 * P.zoom;
      camera.position.set(
        target.x + Math.cos(a) * dist,
        target.y + 2.0 * P.zoom + 0.5 - pl.y * 1.1,
        target.z + Math.sin(a) * dist
      );
      camera.lookAt(target.x, target.y + 0.85, target.z);
    }

    function tick() {
      const now = performance.now();
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const world = S.world;
      const op = world ? P.opacity : S.opacity;
      canvas.style.opacity = op;
      if (op < 0.01 || S.paused) return;
      adapt(now);

      // o ponteiro segue suave; parado há 3s, a cena balança sozinha
      const idle = now / 1000 - lastMove > 3;
      const tx = idle ? Math.sin(t * 0.35) * 0.45 : pointer.x;
      const ty = idle ? Math.sin(t * 0.27) * 0.25 : pointer.y;
      pl.x += (tx - pl.x) * 0.06;
      pl.y += (ty - pl.y) * 0.06;

      const off = world ? P : S;
      camera.setViewOffset(vw, vh, -off.offX * vw, off.offY * vh, vw, vh);

      if (!world) {
        const calm = 1 - S.enter;
        cab.position.set(S.x + pl.x * 0.25 * calm, S.y + (Math.sin(t * 1.3) * 0.08 - pl.y * 0.12) * calm, 0);
        cab.rotation.set(
          S.rotX + pl.y * 0.2 * calm,
          S.rotY + intro.spin + (pl.x * 0.65 + Math.sin(t * 0.5) * 0.05) * calm,
          0
        );
        cab.scale.setScalar(S.scale * intro.s);
        // o joystick inclina para o lado do mouse
        stick.rotation.set(pl.y * 0.5 * calm, 0, -pl.x * 0.5 * calm);

        camera.position.set(S.camX, S.camY, S.camZ);
        camera.lookAt(S.camX, S.lookY, S.camZ - 10);
        cab.visible = S.camZ > 0.5;
        tunnel.visible = S.camZ < 1.4;
        park.visible = false;
        if (tunnel.visible) tunnel.rotation.z = t * 0.1;
        scene.fog.near = 16;
        scene.fog.far = 70;
        screenLight.color.set((SCREENS[S.screen] || SCREENS.start).color);
        if (t - lastScreen > 1 / 30) {
          drawScreen(t);
          lastScreen = t;
        }
      } else {
        cab.visible = tunnel.visible = false;
        park.visible = true;
        scene.fog.near = 15;
        scene.fog.far = 44;
        islands.forEach((isl, i) => {
          isl.g.position.y = isl.baseY + Math.sin(t * 0.6 + i * 1.3) * 0.12;
          const d = Math.min(1, Math.abs(P.island - i));
          isl.g.scale.setScalar(1 - d * 0.1);
        });
        anims.forEach((fn) => fn(t, dt));
        for (let i = 0; i < N; i++)
          for (let k = 0; k < PULSES; k++) {
            curves[i].getPoint((t * 0.22 + k / PULSES) % 1, tmpV);
            pulsePos.set([tmpV.x, tmpV.y, tmpV.z], (i * PULSES + k) * 3);
          }
        pulseGeo.attributes.position.needsUpdate = true;
        updateErupt(dt);
        parkCamera();
      }
      renderer.render(scene, camera);
    }
    gsap.ticker.add(tick);
    ready = true;
  }

  // Entrada do fliperama
  function playIntro() {
    return gsap.timeline()
      .to(intro, { s: 1, duration: 1.6, ease: "elastic.out(1, 0.6)" }, 0)
      .to(intro, { spin: 0, duration: 2, ease: "power3.out" }, 0);
  }

  return {
    S,
    P,
    init,
    playIntro,
    erupt: (p) => eruptFn(p),
    get ready() { return ready; },
  };
})();
