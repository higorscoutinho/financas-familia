/* =========================================================
   charts.js — Gráficos nativos em SVG (sem bibliotecas externas)
   ========================================================= */

const Charts = {
  /** Gráfico de barras simples (gastos por dia/mês) */
  bars(container, data, opts = {}) {
    const w = opts.width || container.clientWidth || 320;
    const h = opts.height || 160;
    const pad = 24;
    const max = Math.max(1, ...data.map((d) => d.value));
    const barW = (w - pad * 2) / data.length;

    let bars = "";
    let labels = "";
    data.forEach((d, i) => {
      const bh = max ? (d.value / max) * (h - 40) : 0;
      const x = pad + i * barW;
      const y = h - 24 - bh;
      bars += `<rect x="${x + barW * 0.18}" y="${y}" width="${barW * 0.64}" height="${bh}" rx="4"
                 fill="${d.color || "var(--color-accent)"}" opacity="0.92">
                 <title>${Utils.escapeHtml(d.label)}: ${Utils.brl(d.value)}</title>
               </rect>`;
      labels += `<text x="${x + barW / 2}" y="${h - 6}" text-anchor="middle" font-size="9.5"
                  fill="var(--color-text-faint)">${Utils.escapeHtml(d.label)}</text>`;
    });

    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="overflow:visible">${bars}${labels}</svg>`;
  },

  /** Gráfico de rosca (donut) por categoria, com legenda */
  donut(container, data, opts = {}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const size = opts.size || 160;
    const r = size / 2 - 14;
    const cx = size / 2;
    const cy = size / 2;
    let angleStart = -90;
    let paths = "";

    if (total <= 0) {
      container.innerHTML = `<div class="empty-state"><div class="emoji">📊</div><p>Sem dados ainda neste período</p></div>`;
      return;
    }

    data.forEach((d) => {
      const frac = d.value / total;
      const angleEnd = angleStart + frac * 360;
      const large = angleEnd - angleStart > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos((Math.PI * angleStart) / 180);
      const y1 = cy + r * Math.sin((Math.PI * angleStart) / 180);
      const x2 = cx + r * Math.cos((Math.PI * angleEnd) / 180);
      const y2 = cy + r * Math.sin((Math.PI * angleEnd) / 180);
      paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z"
                  fill="${d.color}" stroke="var(--color-surface)" stroke-width="2">
                  <title>${Utils.escapeHtml(d.label)}: ${Utils.brl(d.value)}</title>
                </path>`;
      angleStart = angleEnd;
    });

    const legend = data
      .map(
        (d) =>
          `<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span>${Utils.escapeHtml(
            d.label
          )} · ${((d.value / total) * 100).toFixed(0)}%</div>`
      )
      .join("");

    container.innerHTML = `
      <div class="chart-wrap" style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
          ${paths}
          <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--color-surface)"/>
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="11" fill="var(--color-text-muted)" font-weight="600">Total</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="12" fill="var(--color-text)" font-weight="700">${Utils.brl(
      total
    ).replace("R$", "R$ ").split(",")[0]}</text>
        </svg>
        <div class="legend" style="flex-direction:column; margin-top:0;">${legend}</div>
      </div>`;
  },

  /** Linha simples comparando dois meses */
  comparativeLine(container, seriesA, seriesB, labelsX, opts = {}) {
    const w = opts.width || container.clientWidth || 320;
    const h = opts.height || 140;
    const pad = 20;
    const max = Math.max(1, ...seriesA, ...seriesB);
    const stepX = (w - pad * 2) / (labelsX.length - 1 || 1);

    const toPoints = (series) =>
      series
        .map((v, i) => `${pad + i * stepX},${h - 20 - (v / max) * (h - 40)}`)
        .join(" ");

    container.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <polyline points="${toPoints(seriesA)}" fill="none" stroke="var(--color-text-faint)" stroke-width="2" stroke-dasharray="4 3"/>
        <polyline points="${toPoints(seriesB)}" fill="none" stroke="var(--color-accent)" stroke-width="2.5"/>
        ${labelsX
          .map((l, i) => `<text x="${pad + i * stepX}" y="${h - 4}" font-size="9.5" text-anchor="middle" fill="var(--color-text-faint)">${l}</text>`)
          .join("")}
      </svg>`;
  },
};
