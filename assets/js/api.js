// api.js —— 封装 /api 接口（同源，由 Worker 或本地 dev 代理提供）
window.ZNQM = window.ZNQM || {};
window.ZNQM.api = {
  async img2img({ prompt, image, size = '1024x1024', n = 1 } = {}) {
    const r = await fetch('/api/img2img', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, image, size, n }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || '生成失败');
    return d;
  },
  async describe(image) {
    const r = await fetch('/api/describe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || '描述失败');
    return d.description || '';
  },
  async copy(brief) {
    const r = await fetch('/api/copy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || '文案生成失败');
    return { title: d.title || '', subtitle: d.subtitle || '', tags: d.tags || [] };
  },
};
