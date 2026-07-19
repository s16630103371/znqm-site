// poster.js —— 前端 Canvas 海报合成（图生海报，离线可用）
window.ZNQM = window.ZNQM || {};
(function () {
  const TEMPLATES = {
    cinematic: { bg: '#0a0d1a', accent: '#00e5ff', accent2: '#ff3df0', font: '900 56px "PingFang SC",sans-serif', sub: '400 22px "PingFang SC",sans-serif', grad: ['rgba(0,229,255,.35)', 'rgba(255,61,240,.25)'] },
    minimal:   { bg: '#f4f4f6', accent: '#111418', accent2: '#888', font: '800 52px "PingFang SC",sans-serif', sub: '400 22px "PingFang SC",sans-serif', grad: ['rgba(0,0,0,.04)', 'rgba(0,0,0,.02)'] },
    neon:      { bg: '#0c0014', accent: '#ff3df0', accent2: '#00e5ff', font: '900 56px "PingFang SC",sans-serif', sub: '400 22px "PingFang SC",sans-serif', grad: ['rgba(255,61,240,.4)', 'rgba(0,229,255,.35)'] },
    retro:     { bg: '#1a1206', accent: '#ffb347', accent2: '#ff6b35', font: '900 54px "PingFang SC",sans-serif', sub: '400 22px "PingFang SC",sans-serif', grad: ['rgba(255,179,71,.35)', 'rgba(255,107,53,.25)'] },
  };

  function fitText(ctx, text, maxW, maxLines) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
      if (lines.length === maxLines - 1 && ctx.measureText(line + ch).width > maxW) break;
    }
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  function render(canvas, { img, theme, title, subtitle, template }) {
    const t = TEMPLATES[template] || TEMPLATES.cinematic;
    const W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // bg
    ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
    // image (cover, bottom 70%)
    if (img) {
      const iw = img.width, ih = img.height;
      const cw = W, ch = H * 0.66;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) + (H * 0.34 - (H - dh)) / 2, dw, dh);
      // gradient overlay for text legibility
      const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, t.bg);
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    }
    // top accent bar
    const ag = ctx.createLinearGradient(0, 0, W, 0);
    ag.addColorStop(0, t.grad[0]); ag.addColorStop(1, t.grad[1]);
    ctx.fillStyle = ag; ctx.fillRect(0, 0, W, 10);
    // theme tag
    ctx.fillStyle = t.accent; ctx.font = '600 26px "PingFang SC",sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText((theme || 'ZNQM').toUpperCase(), 70, 56);
    // title
    ctx.fillStyle = (template === 'minimal') ? '#111418' : '#ffffff';
    ctx.font = t.font;
    const titleLines = fitText(ctx, title || '未命名作品', W - 140, 3);
    let y = H - 320;
    titleLines.forEach((ln) => { ctx.fillText(ln, 70, y); y += 66; });
    // subtitle
    ctx.fillStyle = (template === 'minimal') ? '#555' : t.accent2;
    ctx.font = t.sub;
    const subLines = fitText(ctx, subtitle || '', W - 140, 2);
    subLines.forEach((ln) => { ctx.fillText(ln, 70, y + 6); y += 32; });
    // footer brand
    ctx.fillStyle = (template === 'minimal') ? '#999' : 'rgba(255,255,255,.6)';
    ctx.font = '500 22px "PingFang SC",sans-serif';
    ctx.fillText('ZNQM · AI 生成工作室', 70, H - 70);
    return canvas;
  }

  window.ZNQM.poster = {
    render,
    async make({ imgEl, theme, title, subtitle, template }) {
      const canvas = document.createElement('canvas');
      render(canvas, { img: imgEl, theme, title, subtitle, template });
      return canvas;
    },
    download(canvas, name = 'znqm-poster.png') {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = name; a.click();
    },
  };
})();
