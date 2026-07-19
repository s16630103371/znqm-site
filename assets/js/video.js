// video.js —— 前端 Canvas + MediaRecorder 视频合成（图生视频，离线可用）
window.ZNQM = window.ZNQM || {};
(function () {
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  // 把图片绘制到 canvas，按风格做动效；逐帧绘制并录制
  async function compose({ images, style, title, onProgress }) {
    const W = 720, H = 1280;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const fps = 30, secPer = 2.2, total = Math.max(images.length, 1) * secPer;
    const frames = Math.round(fps * total);

    // 标题片头
    function drawTitle(progress) {
      ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, W, H);
      const a = Math.min(1, progress * 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#00e5ff';
      ctx.font = '800 54px "PingFang SC",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(title || 'ZNQM', W / 2, H / 2 - 10);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '400 24px "PingFang SC",sans-serif';
      ctx.fillText('AI 生成视频', W / 2, H / 2 + 40);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    function drawImage(img, t, idx) {
      // cover
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (style === 'kenburns') {
        const z = 1 + 0.12 * Math.sin(t * Math.PI); // 轻微推拉
        const cw = dw * z, ch = dh * z;
        ctx.drawImage(img, (W - cw) / 2, (H - ch) / 2, cw, ch);
      } else if (style === 'zoom') {
        const z = 1 + 0.18 * t;
        const cw = dw * z, ch = dh * z;
        ctx.drawImage(img, (W - cw) / 2, (H - ch) / 2, cw, ch);
      } else { // fade
        ctx.drawImage(img, dx, dy, dw, dh);
      }
      // 过渡淡入
      if (t < 0.18) { ctx.fillStyle = `rgba(7,7,15,${1 - t / 0.18})`; ctx.fillRect(0, 0, W, H); }
      // 角标
      ctx.fillStyle = 'rgba(0,229,255,.9)'; ctx.font = '600 22px "PingFang SC",sans-serif';
      ctx.fillText(`ZNQM · ${idx + 1}/${images.length}`, 30, H - 30);
    }

    const stream = canvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime })); });

    rec.start();
    const introSec = 1.2;
    for (let f = 0; f < frames; f++) {
      const time = f / fps;
      if (time < introSec) { drawTitle(time / introSec); }
      else {
        const vt = (time - introSec);
        const idx = Math.min(images.length - 1, Math.floor(vt / secPer));
        const localT = (vt - idx * secPer) / secPer;
        drawImage(images[idx], localT, idx);
      }
      if (onProgress) onProgress(Math.round((f / frames) * 100));
      await new Promise((r) => requestAnimationFrame(r));
    }
    rec.stop();
    const blob = await done;
    return { blob, url: URL.createObjectURL(blob), mime };
  }

  window.ZNQM.video = {
    isSupported() { return typeof MediaRecorder !== 'undefined' && document.createElement('canvas').captureStream; },
    async make({ dataUrls, style, title }) {
      const imgs = [];
      for (const u of dataUrls) imgs.push(await loadImage(u));
      return compose({ images: imgs, style, title });
    },
    download(blob, mime, name = 'znqm-video') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name + (mime.includes('mp4') ? '.mp4' : '.webm'); a.click();
    },
  };
})();
