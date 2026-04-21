'use strict';

const Charts = (() => {
  const dpr = () => window.devicePixelRatio || 1;

  function setup(canvas) {
    const w = canvas.offsetWidth  || canvas.parentElement?.offsetWidth  || 280;
    const h = canvas.offsetHeight || canvas.parentElement?.offsetHeight || 180;
    const r = dpr();
    canvas.width  = w * r;
    canvas.height = h * r;
    const ctx = canvas.getContext('2d');
    ctx.scale(r, r);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (w <= 0) return;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  return {
    /* ─────────────────────────────────────────────────────────────────
       Donut / Ring chart
       segments: [{value, color}]
    ───────────────────────────────────────────────────────────────── */
    drawDonut(canvas, segments, total, centerLabel, centerSub) {
      const { ctx, w, h } = setup(canvas);
      const cx   = w / 2;
      const cy   = h / 2;
      const size = Math.min(w, h);
      const R    = size * 0.40;
      const lw   = size * 0.13;

      if (!segments.length || total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth   = lw;
        ctx.stroke();
      } else {
        let angle = -Math.PI / 2;
        const gap = 0.025;
        segments.forEach(seg => {
          const arc = (seg.value / total) * Math.PI * 2 - gap;
          ctx.beginPath();
          ctx.arc(cx, cy, R, angle, angle + arc);
          ctx.strokeStyle = seg.color;
          ctx.lineWidth   = lw;
          ctx.lineCap     = 'round';
          ctx.stroke();
          angle += arc + gap;
        });
      }

      // Center labels
      ctx.textAlign    = 'center';
      ctx.fillStyle    = '#F9FAFB';
      ctx.font         = `700 ${size * 0.13}px -apple-system,sans-serif`;
      ctx.fillText(centerLabel, cx, cy + size * 0.04);
      ctx.fillStyle    = '#9CA3AF';
      ctx.font         = `${size * 0.075}px -apple-system,sans-serif`;
      ctx.fillText(centerSub, cx, cy + size * 0.14);
    },

    /* ─────────────────────────────────────────────────────────────────
       Smooth line / area chart
    ───────────────────────────────────────────────────────────────── */
    drawLine(canvas, labels, data, color = '#7C3AED') {
      const { ctx, w, h } = setup(canvas);
      if (data.length < 2) return;

      const padT = 12, padB = 26, padL = 4, padR = 4;
      const cw   = w - padL - padR;
      const ch   = h - padT - padB;
      const maxV = Math.max(...data, 1);
      const px   = i  => padL + (i / (data.length - 1)) * cw;
      const py   = v  => padT + (1 - v / maxV) * ch;

      // Gradient fill
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
      grad.addColorStop(0,   color + '55');
      grad.addColorStop(1,   color + '00');

      // Area
      ctx.beginPath();
      ctx.moveTo(px(0), py(data[0]));
      for (let i = 1; i < data.length; i++) {
        const cx1 = px(i - 1) + (px(i) - px(i - 1)) / 2;
        const cx2 = px(i)     - (px(i) - px(i - 1)) / 2;
        ctx.bezierCurveTo(cx1, py(data[i-1]), cx2, py(data[i]), px(i), py(data[i]));
      }
      ctx.lineTo(px(data.length - 1), padT + ch);
      ctx.lineTo(px(0), padT + ch);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(px(0), py(data[0]));
      for (let i = 1; i < data.length; i++) {
        const cx1 = px(i - 1) + (px(i) - px(i - 1)) / 2;
        const cx2 = px(i)     - (px(i) - px(i - 1)) / 2;
        ctx.bezierCurveTo(cx1, py(data[i-1]), cx2, py(data[i]), px(i), py(data[i]));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.lineJoin    = 'round';
      ctx.stroke();

      // X-axis labels (sparse)
      const step = Math.max(1, Math.floor(labels.length / 5));
      ctx.fillStyle   = '#6B7280';
      ctx.font        = `10px -apple-system,sans-serif`;
      ctx.textAlign   = 'center';
      labels.forEach((lbl, i) => {
        if (i % step === 0 || i === labels.length - 1) {
          ctx.fillText(lbl, px(i), h - 6);
        }
      });
    },

    /* ─────────────────────────────────────────────────────────────────
       Horizontal bar chart (budget vs actual)
       rows: [{label, actual, budget, color}]
    ───────────────────────────────────────────────────────────────── */
    drawBars(canvas, rows) {
      const { ctx, w, h } = setup(canvas);
      if (!rows.length) return;

      const padX  = 8;
      const labelW = 72;
      const amtW   = 52;
      const barH   = 22;
      const gap    = 14;
      const trackW = w - padX * 2 - labelW - amtW;
      const maxVal = Math.max(...rows.flatMap(r => [r.actual, r.budget || 0]), 1);

      rows.forEach((row, i) => {
        const y     = 8 + i * (barH + gap);
        const barX  = padX + labelW;
        const actW  = Math.min((row.actual  / maxVal) * trackW, trackW);
        const budW  = row.budget ? Math.min((row.budget / maxVal) * trackW, trackW) : 0;
        const isOver = row.budget > 0 && row.actual > row.budget;
        const barColor = isOver ? '#EF4444' : (row.color || '#7C3AED');

        // Label
        ctx.fillStyle  = '#9CA3AF';
        ctx.font       = `500 11px -apple-system,sans-serif`;
        ctx.textAlign  = 'left';
        const shortLabel = row.label.length > 9 ? row.label.slice(0, 9) + '…' : row.label;
        ctx.fillText(shortLabel, padX, y + barH / 2 + 4);

        // Track
        roundRect(ctx, barX, y, trackW, barH, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fill();

        // Budget ghost
        if (budW > 0) {
          roundRect(ctx, barX, y, budW, barH, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fill();
        }

        // Actual fill
        if (actW > 0) {
          roundRect(ctx, barX, y, actW, barH, 5);
          ctx.fillStyle = barColor;
          ctx.fill();
        }

        // Amount
        ctx.fillStyle  = '#F9FAFB';
        ctx.font       = `600 11px -apple-system,sans-serif`;
        ctx.textAlign  = 'right';
        const amtLabel = (typeof window !== 'undefined' && window.App && typeof window.App.fmt === 'function')
          ? window.App.fmt(row.actual)
          : `$${row.actual.toFixed(0)}`;
        ctx.fillText(amtLabel, w - padX, y + barH / 2 + 4);
      });
    },
  };
})();
