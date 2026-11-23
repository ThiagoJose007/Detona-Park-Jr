/* =========================================================
   Detona Park — órbita 360° das ilhas
   Uma ilha pode trocar o modelo provisório por uma sequência
   de quadros (uma volta completa). O scroll no trecho da ilha
   escolhe o quadro; o mouse soma um giro curto por cima.
   Para reutilizar, em js/data.js:

     orbit: { folder: "assets/islands/nome", frames: 120 }

   Arquivos: folder/000.webp … folder/(frames-1).webp
   (loop: o último quadro emenda no primeiro).
   Opcionais: hero (quadro com a ilha em foco, padrão 0),
   turns (voltas nesse trecho de scroll, padrão 1),
   mouseFrames (quanto o mouse gira, padrão 18),
   span (largura do trecho em "ilhas", padrão 1 = de um
   meio-caminho ao seguinte).
   Os quadros já vêm sem fundo (webp com transparência): o fundo
   de estúdio é retirado antes, por um script que acha o degradê
   da borda e apaga tudo que é parecido com ele e encosta na borda.
   ========================================================= */
window.ORBIT = (() => {
  const DEFAULTS = {
    frames: 120,
    pad: 3,
    ext: "webp",
    hero: 0,
    turns: 1,
    mouseFrames: 18,
    span: 1,
    planeWidth: 7.5,
    planeY: 1.02,
    planeZ: 0.35,
  };

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TEX_W = coarse ? 854 : 1280;
  const TEX_H = coarse ? 480 : 720;

  const pointer = { x: 0, y: 0, movedAt: -1 };
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.movedAt = performance.now() / 1000;
  }, { passive: true });

  const mod = (v, n) => ((v % n) + n) % n;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function spiral(center, count) {
    const order = [mod(center, count)];
    for (let d = 1; d < count; d++) {
      order.push(mod(center + d, count));
      order.push(mod(center - d, count));
    }
    return order;
  }

  function mount(THREE, { parent, model, base, index, config }) {
    const cfg = { ...DEFAULTS, ...config };
    const count = cfg.frames | 0;
    const hero = mod(cfg.hero | 0, count);

    const images = new Array(count);
    const ready = new Uint8Array(count);
    const failed = new Uint8Array(count);
    let readyCount = 0;
    let failedCount = 0;
    const pending = new Set();

    // ?v=2: quadros sem fundo (evita o navegador usar a versão antiga em cache)
    const url = (i) => `${cfg.folder}/${String(i).padStart(cfg.pad, "0")}.${cfg.ext}?v=2`;
    for (const i of spiral(hero, count)) {
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = i === hero ? "high" : "auto";
      img.addEventListener("error", () => {
        if (!failed[i]) {
          failed[i] = 1;
          failedCount++;
        }
      });
      img.src = url(i);
      images[i] = img;
    }

    let desired = hero;
    let direction = 1;
    let pumping = false;

    function markReady(i) {
      if (ready[i] || failed[i]) return;
      if (images[i].naturalWidth > 0) {
        ready[i] = 1;
        readyCount++;
      }
    }

    function requestDecode(i) {
      if (ready[i] || failed[i] || pending.has(i)) return false;
      const img = images[i];
      pending.add(i);
      const done = () => {
        pending.delete(i);
        if (img.naturalWidth > 0) markReady(i);
        else if (img.complete) {
          failed[i] = 1;
          failedCount++;
        }
      };
      if (img.decode) img.decode().then(done, done);
      else if (img.complete) done();
      else img.addEventListener("load", done, { once: true });
      return true;
    }

    function pump() {
      const baseFrame = mod(Math.round(desired), count);
      const ahead = [hero, baseFrame, mod(baseFrame + direction, count), mod(baseFrame + direction * 2, count)];
      for (let d = 1; d <= 22; d++) ahead.push(mod(baseFrame + direction * d, count));
      for (let d = 1; d <= 8; d++) ahead.push(mod(baseFrame - direction * d, count));
      for (let d = 0; d < count; d++) ahead.push(mod(hero + d, count));

      let started = 0;
      const cap = readyCount < 6 ? 4 : 2;
      for (const i of ahead) {
        if (pending.size >= cap) break;
        if (requestDecode(i)) started++;
        if (started >= cap) break;
      }
      return readyCount + failedCount < count;
    }

    function ensurePump() {
      if (pumping) return;
      pumping = true;
      const step = () => {
        const more = pump();
        if (more) requestAnimationFrame(step);
        else pumping = false;
      };
      requestAnimationFrame(step);
    }
    ensurePump();

    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const ctx = canvas.getContext("2d", { alpha: true });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const uniforms = {
      map: { value: texture },
      uOpacity: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          vec4 tex = texture2D(map, vUv);
          float alpha = tex.a * uOpacity;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(tex.rgb, alpha);
        }
      `,
    });

    const aspect = 720 / 1280;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.planeWidth, cfg.planeWidth * aspect), material);
    mesh.position.set(0, cfg.planeY, cfg.planeZ);
    mesh.renderOrder = 3;
    mesh.visible = false;
    parent.add(mesh);

    const grab = (root) => {
      const items = [];
      root.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const list = Array.isArray(obj.material) ? obj.material : [obj.material];
        list.forEach((m) => {
          if (items.some((it) => it.m === m)) return;
          items.push({ m, opacity: m.opacity });
        });
      });
      return items;
    };
    const modelMats = model ? grab(model) : [];
    const baseMats = base ? grab(base) : [];
    const applyFade = (items, k) => {
      items.forEach(({ m, opacity }) => {
        m.opacity = opacity * k;
        m.transparent = k < 0.999;
        m.depthWrite = k > 0.92;
      });
    };

    let mouseOff = 0;
    let parX = 0;
    let parY = 0;
    let reveal = 0;
    let hasFrame = false;
    let lastKey = "";

    function closestReady(i0, maxDist) {
      if (ready[i0]) return i0;
      for (let d = 1; d <= maxDist; d++) {
        const a = mod(i0 + d, count);
        const b = mod(i0 - d, count);
        if (ready[a]) return a;
        if (ready[b]) return b;
      }
      return -1;
    }

    function draw(frame) {
      const f = mod(frame, count);
      const i0 = Math.floor(f);
      const frac = f - i0;
      const i1 = mod(i0 + 1, count);
      const aReady = ready[i0] === 1;
      const bReady = ready[i1] === 1;
      const q = Math.round(frac * 5);
      const useBlend = aReady && bReady && q > 0 && q < 5;
      const shown = useBlend ? -1 : (aReady ? i0 : bReady ? i1 : closestReady(i0, 3));
      if (!useBlend && shown < 0) return hasFrame;
      const key = useBlend ? `${i0}-${i1}-${q}` : `s${shown}`;
      if (key === lastKey) return true;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, TEX_W, TEX_H);
      if (useBlend) {
        ctx.drawImage(images[i0], 0, 0, TEX_W, TEX_H);
        ctx.globalAlpha = q / 5;
        ctx.drawImage(images[i1], 0, 0, TEX_W, TEX_H);
        ctx.globalAlpha = 1;
      } else {
        const img = images[shown];
        if (!img || !img.naturalWidth) return hasFrame;
        ctx.drawImage(img, 0, 0, TEX_W, TEX_H);
      }
      texture.needsUpdate = true;
      lastKey = key;
      hasFrame = true;
      return true;
    }

    function weight(island) {
      const d = Math.abs(island - index);
      if (d >= 0.8) return 0;
      if (d <= 0.22) return 1;
      return smooth(0.8, 0.22, d);
    }

    function update(dt, state) {
      const island = state.island;
      const focus = weight(island);
      const span = cfg.span;
      const u = clamp((island - (index - span / 2)) / span, 0, 1);
      const scrollFrame = hero + (u - 0.5) * count * cfg.turns;

      const fine = pointer.movedAt > 0;
      const listen = fine && !reduceMotion && !coarse && focus > 0.4;
      const px = Math.abs(pointer.x) < 0.05 ? 0 : pointer.x;
      const targetOff = listen ? clamp(px, -1, 1) * cfg.mouseFrames * focus : 0;
      const k = 1 - Math.exp(-dt * 7);
      mouseOff += (targetOff - mouseOff) * k;

      const wantX = listen ? pointer.x : 0;
      const wantY = listen ? pointer.y : 0;
      parX += (wantX - parX) * k;
      parY += (wantY - parY) * k;

      const frame = scrollFrame + mouseOff;
      const prev = desired;
      desired = frame;
      if (Math.abs(frame - prev) > 0.001) direction = frame >= prev ? 1 : -1;
      ensurePump();

      if (state.active) {
        draw(frame);
        if (hasFrame) reveal = Math.min(1, reveal + dt * 2.4);
        uniforms.uOpacity.value = reveal;
        mesh.visible = reveal > 0.01;
        // A ilha já olha para a câmera. O mouse só inclina um pouco, sem
        // virar o plano para o meio da tela (isso cobria o texto).
        mesh.position.set(parX * 0.16, cfg.planeY - parY * 0.08, cfg.planeZ);
        mesh.rotation.set(parY * 0.045, -parX * 0.07, 0);
        const fade = 1 - reveal;
        applyFade(modelMats, fade);
        applyFade(baseMats, fade);
        if (reveal >= 1) {
          if (model) model.visible = false;
          if (base) base.visible = false;
        }
      }
    }

    return { index, weight, update };
  }

  return { mount };
})();
