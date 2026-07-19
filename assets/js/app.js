// app.js —— 交互主控：Tab / 上传 / 生成状态机 / 画廊 / toast / 粒子
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { api, poster, video } = window.ZNQM;

  /* ---------- Toast ---------- */
  function toast(msg, type = '') {
    const wrap = $('#toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
  }

  /* ---------- 文件 -> dataURL ---------- */
  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
  }

  /* ---------- 统计 ---------- */
  const GEN_KEY = 'znqm_generated';
  function bumpGen(n = 1) {
    const v = parseInt(localStorage.getItem(GEN_KEY) || '0', 10) + n;
    localStorage.setItem(GEN_KEY, v);
    const el = $('#statGenerated'); if (el) el.textContent = v;
  }
  function initGen() { const el = $('#statGenerated'); if (el) el.textContent = localStorage.getItem(GEN_KEY) || '0'; }

  /* ---------- 通用上传区 ---------- */
  function setupDropzone(id, { multi = false, onFiles } = {}) {
    const dz = $('#' + id);
    const input = $('input', dz);
    const empty = $('.dz-empty', dz);
    const prev = $('.dz-preview', dz);
    const store = [];

    function renderPreview(files) {
      if (multi) {
        prev.hidden = false; empty.hidden = true;
        prev.innerHTML = '';
        files.forEach((f, i) => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          const rm = document.createElement('button');
          rm.className = 'dz-remove'; rm.textContent = '✕'; rm.type = 'button';
          rm.onclick = (e) => { e.stopPropagation(); files.splice(i, 1); renderPreview(files); onFiles(files.slice()); };
          prev.appendChild(img); prev.appendChild(rm);
        });
      } else {
        const f = files[0];
        if (!f) return;
        prev.hidden = false; empty.hidden = true;
        prev.innerHTML = '';
        const img = document.createElement('img'); img.src = URL.createObjectURL(f);
        const rm = document.createElement('button'); rm.className = 'dz-remove'; rm.textContent = '✕'; rm.type = 'button';
        rm.onclick = (e) => { e.stopPropagation(); input.value = ''; prev.hidden = true; empty.hidden = false; prev.innerHTML = ''; onFiles([]); };
        prev.appendChild(img); prev.appendChild(rm);
      }
    }

    input.addEventListener('change', () => {
      const files = multi ? [...input.files] : (input.files[0] ? [input.files[0]] : []);
      if (multi) { renderPreview(files); onFiles(files.slice()); }
      else { renderPreview(files); onFiles(files.slice()); }
    });
    dz.addEventListener('click', (e) => { if (e.target.classList.contains('dz-remove')) return; input.click(); });
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('drag');
      const files = [...e.dataTransfer.files];
      if (multi) { renderPreview(files); onFiles(files.slice()); }
      else if (files[0]) { renderPreview([files[0]]); onFiles([files[0]]); }
    });
    return {
      get: () => store,
      set: (files) => { if (multi) renderPreview(files); else renderPreview(files); onFiles(files.slice()); },
      clear: () => { input.value = ''; prev.hidden = true; empty.hidden = false; prev.innerHTML = ''; onFiles([]); },
    };
  }

  /* ---------- 结果区渲染 ---------- */
  function showSkeleton(resEl) {
    resEl.innerHTML = '<div class="skeleton"></div><div class="result-empty">生成中…</div>';
  }
  function showImageResult(resEl, dataUrl) {
    resEl.innerHTML = `<img src="${dataUrl}" alt="result" />
      <div class="result-actions"><button data-dl="img">⬇ 下载</button></div>`;
    $('[data-dl="img"]', resEl).onclick = () => {
      const a = document.createElement('a'); a.href = dataUrl; a.download = 'znqm-' + Date.now() + '.png'; a.click();
    };
  }
  function showCanvasResult(resEl, canvas) {
    canvas.style.maxWidth = '100%';
    resEl.innerHTML = '';
    resEl.appendChild(canvas);
    const act = document.createElement('div'); act.className = 'result-actions';
    const dl = document.createElement('button'); dl.textContent = '⬇ 下载';
    dl.onclick = () => poster.download(canvas);
    act.appendChild(dl); resEl.appendChild(act);
  }

  /* ---------- Tabs ---------- */
  function setupTabs() {
    $$('.gen-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('.gen-tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
        const name = tab.dataset.tab;
        $$('.gen-panel').forEach((p) => {
          const match = p.id === 'panel-' + name;
          p.classList.toggle('active', match);
          if (match) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
        });
      });
    });
  }

  /* ---------- 生成动作 ---------- */
  let busy = false;
  async function doGenerate(act, btn) {
    if (busy) return;
    busy = true; btn.disabled = true;
    try {
      if (act === 'img2img') await genImg2Img(btn);
      else if (act === 'img2video') await genImg2Video(btn);
      else if (act === 'poster') await genPoster(btn);
    } catch (e) {
      toast(e.message || '出错了', 'err');
      console.error(e);
    } finally {
      busy = false; btn.disabled = false;
    }
  }

  async function genImg2Img(btn) {
    const prompt = $('#img2img-prompt').value.trim();
    if (!prompt) { toast('请先描述你想生成的画面', 'err'); return; }
    const resEl = $('#res-img2img');
    showSkeleton(resEl);
    const payload = { prompt, size: $('#img2img-size').value };
    if (window.__img2imgImg) payload.image = window.__img2imgImg;
    const d = await api.img2img(payload);
    showImageResult(resEl, d.images[0]);
    if (d.revised_prompt) toast('已生成 · ' + d.revised_prompt.slice(0, 24) + '…', 'ok');
    else toast('生成成功', 'ok');
    bumpGen(1);
  }

  // 从上传的视频采样若干帧（用于 视频→视频 重制）
  function videoFramesFromFile(file, count = 14) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.src = URL.createObjectURL(file);
      v.onloadedmetadata = async () => {
        const dur = isFinite(v.duration) ? v.duration : 4;
        const cv = document.createElement('canvas'); cv.width = 720; cv.height = 1280;
        const ctx = cv.getContext('2d'); const out = [];
        for (let i = 0; i < count; i++) {
          const t = (dur * i) / Math.max(1, count - 1);
          await new Promise((r) => { v.currentTime = t; });
          await new Promise((r) => setTimeout(r, 90));
          const scale = Math.max(cv.width / v.videoWidth, cv.height / v.videoHeight);
          const dw = v.videoWidth * scale, dh = v.videoHeight * scale;
          ctx.drawImage(v, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
          out.push(cv.toDataURL('image/jpeg', 0.82));
        }
        resolve(out);
      };
      v.onerror = () => reject(new Error('视频读取失败'));
    });
  }

  async function genImg2Video(btn) {
    const files = window.__img2videoFiles || [];
    if (!files.length) { toast('请先上传图片或视频', 'err'); return; }
    if (!video.isSupported()) { toast('当前浏览器不支持视频合成', 'err'); return; }
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const vids = files.filter((f) => f.type.startsWith('video/'));
    let urls = [];
    for (const f of imgs) urls.push(await fileToDataURL(f));
    if (!urls.length && vids.length) {
      toast('正在从视频采样帧…');
      try { urls = await videoFramesFromFile(vids[0], 14); } catch (e) { toast('视频读取失败', 'err'); return; }
    }
    if (!urls.length) { toast('未识别到可用素材', 'err'); return; }
    const resEl = $('#res-img2video');
    showSkeleton(resEl);
    const style = $('#img2video-style').value;
    const title = $('#img2video-prompt').value.trim() || 'ZNQM';
    toast('正在合成视频…');
    const { blob, mime } = await video.make({ dataUrls: urls, style, title, onProgress: (p) => {
      const sk = $('.skeleton', resEl); if (sk) sk.style.setProperty('--p', p + '%');
    } });
    const videoEl = document.createElement('video'); videoEl.src = URL.createObjectURL(blob);
    videoEl.controls = true; videoEl.autoplay = false;
    resEl.innerHTML = '';
    resEl.appendChild(videoEl);
    const act = document.createElement('div'); act.className = 'result-actions';
    const dl = document.createElement('button'); dl.textContent = '⬇ 下载';
    dl.onclick = () => video.download(blob, mime);
    act.appendChild(dl); resEl.appendChild(act);
    toast('视频已生成', 'ok'); bumpGen(1);
  }

  async function genPoster(btn) {
    const file = (window.__posterImg || [])[0];
    if (!file) { toast('请先上传主视觉图', 'err'); return; }
    const resEl = $('#res-poster');
    showSkeleton(resEl);
    const img = new Image(); img.src = await fileToDataURL(file);
    await img.decode().catch(() => {});
    let title = $('#poster-title').value.trim();
    let subtitle = $('#poster-subtitle').value.trim();
    const template = $('#poster-template').value;
    const theme = $('#poster-theme').value.trim() || 'ZNQM';
    const canvas = await poster.make({ imgEl: img, theme, title, subtitle, template });
    showCanvasResult(resEl, canvas);
    toast('海报已生成', 'ok'); bumpGen(1);
  }

  /* ---------- AI 文案 ---------- */
  async function genCopy() {
    const theme = $('#poster-theme').value.trim() || $('#poster-title').value.trim();
    if (!theme) { toast('先填海报主题', 'err'); return; }
    const btn = $('#poster-ai'); btn.disabled = true;
    try {
      const c = await api.copy(theme);
      if (c.title) $('#poster-title').value = c.title;
      if (c.subtitle) $('#poster-subtitle').value = c.subtitle;
      toast('AI 文案已生成', 'ok');
    } catch (e) { toast(e.message || '文案生成失败', 'err'); }
    finally { btn.disabled = false; }
  }

  /* ---------- 画廊（真实作品，由构建时生成） ---------- */
  const GALLERY = [
    { src: 'assets/img/gallery/1.jpg', type: 'IMG', prompt: '赛博朋克城市夜景，霓虹降临' },
    { src: 'assets/img/gallery/2.jpg', type: 'IMG', prompt: '未来机械姬肖像，金属光泽' },
    { src: 'assets/img/gallery/3.jpg', type: 'IMG', prompt: '粒子特效展示，流光溢彩' },
    { src: 'assets/img/gallery/4.jpg', type: 'IMG', prompt: '量子计算视觉化，数据流' },
    { src: 'assets/img/gallery/5.jpg', type: 'IMG', prompt: '太空站日出，科幻场景' },
    { src: 'assets/img/gallery/6.jpg', type: 'IMG', prompt: '数字矩阵雨，代码瀑布' },
  ];
  function renderGallery() {
    const grid = $('#galleryGrid');
    GALLERY.forEach((g) => {
      const card = document.createElement('div');
      card.className = 'g-card';
      card.innerHTML = `<span class="g-type">${g.type}</span>
        <img src="${g.src}" alt="${g.prompt}" loading="lazy" />
        <div class="g-over"><div class="g-prompt">${g.prompt}</div><span class="g-btn">生成相似 →</span></div>`;
      card.addEventListener('click', () => {
        // 切到图生图并带入 prompt
        $('.gen-tab[data-tab="img2img"]').click();
        $('#img2img-prompt').value = g.prompt;
        $('#img2img-prompt').dispatchEvent(new Event('input'));
        $('#img2img').scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('已带入提示词：' + g.prompt.slice(0, 16) + '…');
      });
      grid.appendChild(card);
    });
  }

  /* ---------- 粒子背景（轻量） ---------- */
  function particles() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = $('#particles-canvas'); const ctx = c.getContext('2d');
    let w, h, ps;
    function resize() { w = c.width = innerWidth; h = c.height = innerHeight; ps = Array.from({ length: 54 }, () => ({
      x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.6 + .4,
    })); }
    resize(); addEventListener('resize', resize);
    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = 'rgba(0,229,255,.5)'; ctx.fill();
      }
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
        if (d < 120) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = `rgba(0,229,255,${.12 * (1 - d / 120)})`; ctx.stroke(); }
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  /* ---------- 导航 / 计数 / 初始化 ---------- */
  function setupNav() {
    const toggle = $('#navToggle'); const links = $('#navLinks');
    toggle.addEventListener('click', () => { const o = links.classList.toggle('open'); toggle.classList.toggle('open', o); toggle.setAttribute('aria-expanded', o); });
    $$('#navLinks a').forEach((a) => a.addEventListener('click', () => { links.classList.remove('open'); toggle.classList.remove('open'); }));
    // 滚动高亮
    const nav = $('#nav');
    addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 30));
  }
  function countUp() {
    const el = $('[data-count]'); if (!el) return;
    const target = parseInt(el.dataset.count, 10); let v = 0;
    const t = setInterval(() => { v += 1; el.textContent = v; if (v >= target) clearInterval(t); }, 120);
  }
  function bindPromptCount() {
    const ta = $('#img2img-prompt'); const cnt = $('#img2img-count');
    ta.addEventListener('input', () => { cnt.textContent = ta.value.length + '/500'; });
  }

  /* ---------- 启动 ---------- */
  function init() {
    initGen(); setupTabs(); setupNav(); renderGallery(); particles(); countUp(); bindPromptCount();
    // 上传区（各一个实例）
    window.__img2imgImg = null;
    setupDropzone('dz-img2img', { onFiles: (f) => {
      if (f[0]) fileToDataURL(f[0]).then((u) => { window.__img2imgImg = u; });
      else window.__img2imgImg = null;
    } });
    setupDropzone('dz-img2video', { multi: true, onFiles: (f) => { window.__img2videoFiles = f; } });
    setupDropzone('dz-poster', { onFiles: (f) => { window.__posterImg = f; } });
    // 生成按钮
    $$('.gen-go').forEach((b) => b.addEventListener('click', () => doGenerate(b.dataset.act, b)));
    $('#poster-ai').addEventListener('click', genCopy);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
