/* =========================================================
   pages.js — Renderização de cada tela
   CORREÇÕES:
   1. render(): usa `const fn = map[page] || fallback; fn.call()`
      em vez de `?.call() ??` — eliminado o bug do dashboard duplo
   2. monthSelector(): removido o botão "Hoje"
   3. parcelamentosPage(): mostra número da parcela calculado
      para o mês selecionado + botão "Pago" por mês
   4. Contas fixas: menu de mover para outros meses
   ========================================================= */

const Pages = {

  // ── Roteador de páginas ───────────────────────────────
  // CORREÇÃO CRÍTICA: não usar `?? dashboard` aqui pois funções void
  // retornam undefined, fazendo o dashboard renderizar duas vezes.
  render(page) {
    const main = document.getElementById("main-content");
    main.innerHTML = "";
    const map = {
      dashboard:     this.dashboard,
      fixas:         this.fixas,
      parcelamentos: this.parcelamentosPage,
      despesas:      this.despesas,
      receitas:      this.receitas,
      metas:         this.metas,
      relatorios:    this.relatorios,
      cartoes:       this.cartoes,
      config:        this.config,
    };
    const fn = map[page] || this.dashboard;
    fn.call(this, main);
  },

  // ── Seletor de mês (SEM botão "Hoje") ────────────────
  monthSelector(main) {
    const mk   = App.selectedMonth;
    const wrap = document.createElement("div");
    wrap.className = "month-selector";
    wrap.innerHTML = `
      <button class="ms-arrow" onclick="App.prevMonth()" title="Mês anterior (←)">&#8249;</button>
      <div class="ms-center">
        <span class="ms-label">${Utils.monthLabel(mk)}</span>
        <input class="month-picker-input" type="month" value="${mk}"
               title="Clique para escolher o mês" onchange="App.setMonth(this.value)">
      </div>
      <button class="ms-arrow" onclick="App.nextMonth()" title="Próximo mês (→)">&#8250;</button>`;
    main.appendChild(wrap);
  },

  // ── Cabeçalho de página ───────────────────────────────
  header(main, title, sub) {
    const h = document.createElement("div");
    h.className = "page-header";
    h.innerHTML = `<div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
    main.appendChild(h);
  },

  // ════════════════════ DASHBOARD ════════════════════════
  dashboard(main) {
    const mk      = App.selectedMonth;
    const mkPrev  = Utils.prevMonthKey(mk);
    const isNow   = App.isCurrentMonth();

    const despMes   = Store.monthDespesas(mk);
    const recMes    = Store.monthReceitas(mk);
    const fixasMes  = Store.monthFixedBills(mk);
    const parcMes   = Store.monthParcelamentos(mk);
    const despPrev  = Store.monthDespesas(mkPrev);

    const totalRec      = Store.sum(recMes);
    const totalDespVar  = Store.sum(despMes);
    const totalFixas    = Store.sum(fixasMes);
    const totalParcelas = parcMes.reduce((s, p) => s + Number(p.valorParcela || 0), 0);
    const totalSaidas   = totalDespVar + totalFixas + totalParcelas;
    const saldo         = totalRec - totalSaidas;
    const fixasAbertas  = Store.sum(fixasMes.filter((f) => !f.pago));

    const diasMes       = Utils.daysInMonth(mk);
    const diaHoje       = isNow ? Utils.dayOfMonthToday() : diasMes;
    const diasRestantes = Math.max(1, diasMes - diaHoje + 1);
    const porDia        = isNow && saldo > 0 ? saldo / diasRestantes : 0;

    const metaEconomia = Number(Store.data.configuracoes.metaEconomiaMensal) || 0;
    const economizado  = Math.max(0, saldo);
    const totalPrev    = Store.sum(despPrev);
    const delta        = totalPrev
      ? (((totalSaidas - totalPrev) / totalPrev) * 100).toFixed(0)
      : null;

    this.header(main,
      isNow ? `Olá, ${App.currentUser.split(" ")[0]} 👋` : `📅 ${Utils.monthLabel(mk)}`,
      `Resumo de ${Utils.monthLabel(mk)}${!isNow ? " — modo consulta" : ""}`
    );
    this.monthSelector(main);

    if (!isNow) {
      const bar = document.createElement("div");
      bar.className = "notice-bar";
      bar.innerHTML = `🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta. Use as setas para navegar.`;
      main.appendChild(bar);
    }

    // Cards de estatísticas
    const grid = document.createElement("div");
    grid.className = "grid grid-stats";
    grid.innerHTML = `
      ${this.statCard("blue",  "💼", "Saldo do mês",          Utils.brl(saldo))}
      ${this.statCard("green", "💰", "Receitas",              Utils.brl(totalRec))}
      ${this.statCard("red",   "💸", "Total de saídas",       Utils.brl(totalSaidas))}
      ${this.statCard("amber", "🧮", isNow ? "Posso gastar ainda" : "Resultado", Utils.brl(saldo))}
      ${this.statCard("red",   "⏳", "Fixas em aberto",       Utils.brl(fixasAbertas))}
      ${this.statCard("blue",  "📌", "Contas fixas",          Utils.brl(totalFixas))}
      ${this.statCard("amber", "🛒", "Despesas variáveis",    Utils.brl(totalDespVar))}
      ${this.statCard("red",   "📦", "Parcelamentos no mês",  Utils.brl(totalParcelas))}
      ${isNow ? this.statCard("green","📅","Posso gastar/dia", Utils.brl(porDia)) : ""}
    `;
    main.appendChild(grid);

    // Gráficos
    const row2 = document.createElement("div");
    row2.className = "grid grid-2"; row2.style.marginTop = "16px";

    const cDonut = document.createElement("div");
    cDonut.className = "card";
    cDonut.innerHTML = `<h3>Gastos por categoria</h3><div id="chart-donut"></div>`;
    row2.appendChild(cDonut);

    const cComp = document.createElement("div");
    cComp.className = "card";
    cComp.innerHTML = `
      <h3>Comparativo — mês anterior</h3>
      <div id="chart-comp"></div>
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-text-faint)"></span>${Utils.monthLabel(mkPrev)}</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-accent)"></span>${Utils.monthLabel(mk)}</div>
      </div>
      <div class="delta ${delta === null ? "" : Number(delta) > 0 ? "down" : "up"}" style="margin-top:10px;">
        ${delta === null
          ? "Sem dados do mês anterior"
          : Number(delta) > 0
            ? `▲ ${delta}% a mais que o mês passado`
            : `▼ ${Math.abs(delta)}% a menos que o mês passado`}
      </div>`;
    row2.appendChild(cComp);
    main.appendChild(row2);

    // Meta + Top gastos
    const row3 = document.createElement("div");
    row3.className = "grid grid-2"; row3.style.marginTop = "16px";

    const pct = metaEconomia > 0 ? Math.min(100, (economizado / metaEconomia) * 100) : 0;
    const cMeta = document.createElement("div");
    cMeta.className = "card";
    cMeta.innerHTML = `
      <h3>Meta de economia</h3>
      <div class="big-number">${Utils.brl(economizado)}
        <span style="font-size:14px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(metaEconomia)}</span>
      </div>
      <div class="progress-track" style="margin-top:12px;">
        <div class="progress-fill green" style="width:${pct}%"></div>
      </div>
      <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% atingida</div>`;
    row3.appendChild(cMeta);

    const topItems = [
      ...despMes,
      ...fixasMes.filter((f) => f.pago),
      ...parcMes.map((p) => ({ nome: p.nome, categoria: "Parcelamento", valor: p.valorParcela })),
    ].sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0)).slice(0, 5);

    const cTop = document.createElement("div");
    cTop.className = "card";
    cTop.innerHTML = `<h3>Maiores gastos do mês</h3>` + this.listOrEmpty(topItems, (g) => `
      <div class="list-row">
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(g.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(g.categoria || "—")}</div>
        </div>
        <div class="row-amount neg">−${Utils.brl(g.valor)}</div>
      </div>`);
    row3.appendChild(cTop);
    main.appendChild(row3);

    // Alertas (só no mês atual)
    if (isNow) {
      const alertas = fixasMes
        .filter((f) => !f.pago)
        .map((f) => ({ ...f, dias: Utils.daysUntil(Number(f.diaVencimento)) }))
        .sort((a, b) => a.dias - b.dias);

      const cAlert = document.createElement("div");
      cAlert.className = "card"; cAlert.style.marginTop = "16px";
      cAlert.innerHTML = `<h3>Alertas de vencimento</h3>` + this.listOrEmpty(alertas, (f) => {
        const badge =
          f.dias < 0   ? `<span class="badge red">Atrasada (${Math.abs(f.dias)}d)</span>` :
          f.dias === 0 ? `<span class="badge red">Vence hoje</span>` :
          f.dias === 1 ? `<span class="badge amber">Vence amanhã</span>` :
          f.dias <= 3  ? `<span class="badge amber">Em ${f.dias} dias</span>` :
                         `<span class="badge gray">Em ${f.dias} dias</span>`;
        return `
          <div class="list-row">
            <div class="row-main">
              <div class="row-title">${Utils.escapeHtml(f.nome)}</div>
              <div class="row-sub">Dia ${f.diaVencimento}</div>
            </div>
            ${badge}
            <button class="btn btn-sm btn-secondary" style="margin-left:8px"
              onclick="Actions.payFixedBill('${f.id}')">Pago</button>
          </div>`;
      }, "🎉 Tudo pago!");
      main.appendChild(cAlert);
    }

    // Renderiza gráficos após DOM estar pronto
    const catTotals = {};
    [
      ...despMes,
      ...fixasMes.filter((f) => f.pago),
      ...parcMes.map((p) => ({ categoria: "Parcelamento", valor: p.valorParcela })),
    ].forEach((d) => {
      const c = d.categoria || "Outros";
      catTotals[c] = (catTotals[c] || 0) + Number(d.valor || 0);
    });
    Charts.donut(
      document.getElementById("chart-donut"),
      Object.entries(catTotals).map(([label, value]) => ({ label, value, color: Utils.categoryColor(label) }))
    );

    const weekSplit = (list, mkRef) =>
      [0,0,0,0].map((_, w) =>
        Store.sum(list.filter((d) =>
          Utils.monthKey(d.data) === mkRef &&
          Math.ceil(parseInt(d.data.slice(8, 10), 10) / 7) === w + 1
        ))
      );
    Charts.comparativeLine(
      document.getElementById("chart-comp"),
      weekSplit(Store.data.despesas, mkPrev),
      weekSplit(Store.data.despesas, mk),
      ["S1","S2","S3","S4"]
    );
  },

  statCard(color, icon, title, value) {
    return `<div class="card">
      <div class="stat-icon ${color}">${icon}</div>
      <h3>${title}</h3>
      <div class="big-number">${value}</div>
    </div>`;
  },

  listOrEmpty(items, renderFn, emptyMsg = "Nenhum registro.") {
    if (!items?.length) {
      return `<div class="empty-state"><div class="emoji">🗂️</div><p>${emptyMsg}</p></div>`;
    }
    return `<div class="list">${items.map(renderFn).join("")}</div>`;
  },

  // ════════════════════ CONTAS FIXAS ═════════════════════
  fixas(main) {
    const mk = App.selectedMonth;
    this.header(main, "Contas Fixas", "Recriadas automaticamente todo mês");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Conta Fixa", () => Modals.openFixa()));

    if (!App.isCurrentMonth()) {
      const bar = document.createElement("div");
      bar.className = "notice-bar";
      bar.innerHTML = `🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta`;
      main.appendChild(bar);
    }

    const list = Store.monthFixedBills(mk)
      .sort((a, b) => Number(a.diaVencimento) - Number(b.diaVencimento));

    // Meses disponíveis para mover: 3 atrás e 3 à frente do mês atual
    const monthOptions = () => {
      const opts = [];
      for (let d = -3; d <= 3; d++) {
        const dt = new Date();
        dt.setDate(1);
        dt.setMonth(dt.getMonth() + d);
        const k = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
        opts.push(k);
      }
      return opts;
    };

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (f) => {
      const dias = Utils.daysUntil(Number(f.diaVencimento));
      const badge =
        f.pago         ? `<span class="badge green">Pago</span>` :
        dias < 0       ? `<span class="badge red">Atrasada</span>` :
        dias <= 3      ? `<span class="badge amber">Em ${dias}d</span>` :
                         `<span class="badge gray">Dia ${f.diaVencimento}</span>`;

      const opts = monthOptions().map((k) =>
        `<option value="${k}" ${k === f.mesReferencia ? "selected" : ""}>${Utils.monthLabel(k)}</option>`
      ).join("");

      return `
        <div class="list-row" style="flex-wrap:wrap; gap:8px; align-items:center;">
          <div class="row-main" style="min-width:140px;">
            <div class="row-title">${Utils.escapeHtml(f.nome)}</div>
            <div class="row-sub">${Utils.escapeHtml(f.categoria || "—")} · dia ${f.diaVencimento}${f.pago ? " · pago " + Utils.fmtDateShort(f.dataPagamento) : ""}</div>
          </div>
          ${badge}
          <div class="row-amount neg">${Utils.brl(f.valor)}</div>
          <button class="btn btn-sm ${f.pago ? "btn-secondary" : "btn-primary"}"
            onclick="Actions.payFixedBill('${f.id}')">${f.pago ? "Desfazer" : "✓ Pago"}</button>
          <select class="month-move-select" title="Mover para outro mês"
            onchange="Actions.moveFixaToMonth('${f.id}', this.value)">${opts}</select>
          <button class="btn btn-sm btn-ghost" onclick="Modals.openFixa('${f.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost"
            onclick="Actions.remove('contasFixas','ContasFixas','${f.id}')">🗑️</button>
        </div>`;
    }, "Nenhuma conta fixa neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ PARCELAMENTOS ════════════════════
  parcelamentosPage(main) {
    const mk = App.selectedMonth;
    this.header(main, "Parcelamentos", `Parcelas ativas em ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Novo Parcelamento", () => Modals.openParcelamento()));

    const ativos = Store.monthParcelamentos(mk);
    const totalMes = ativos.reduce((s, p) => s + Number(p.valorParcela || 0), 0);

    if (ativos.length) {
      const resumo = document.createElement("div");
      resumo.className = "card"; resumo.style.marginBottom = "12px";
      resumo.innerHTML = `
        <h3>Total de parcelas em ${Utils.monthLabel(mk)}</h3>
        <div class="big-number" style="color:var(--color-negative);">${Utils.brl(totalMes)}</div>
        <div class="row-sub" style="margin-top:4px;">${ativos.length} parcelamento${ativos.length > 1 ? "s" : ""} ativo${ativos.length > 1 ? "s" : ""}</div>`;
      main.appendChild(resumo);
    }

    const card = document.createElement("div");
    card.className = "card";

    // Lista completa: ativos no mês aparecem com destaque e botão de pago
    card.innerHTML = this.listOrEmpty(Store.data.parcelamentos, (p) => {
      const ativo    = ativos.some((a) => a.id === p.id);
      const numParc  = ativo ? Store.getInstallmentForMonth(p, mk) : null;
      const total    = Number(p.qtdTotal) || 1;
      const pct      = ativo ? Math.min(100, (numParc / total) * 100) : Math.min(100, (Number(p.parcelaAtual)/total)*100);
      const pago     = ativo && Store.isParcelamentoPago(p.id, mk);

      return `
        <div class="list-row" style="flex-wrap:wrap; gap:8px; ${!ativo ? "opacity:0.4;" : ""}">
          <div class="row-main" style="min-width:160px;">
            <div class="row-title">
              ${Utils.escapeHtml(p.nome)}
              ${ativo
                ? `<span class="badge ${pago ? "green" : "gray"}" style="margin-left:6px;">${pago ? "Pago" : `${numParc}/${total}`}</span>`
                : `<span class="badge gray" style="margin-left:6px;">Inativo neste mês</span>`}
            </div>
            <div class="row-sub">
              ${ativo
                ? `Parcela <strong>${numParc}</strong> de ${total} · termina ${Utils.fmtDateFull(p.dataFinal)}`
                : `Termina ${Utils.fmtDateFull(p.dataFinal)}`}
            </div>
            <div class="progress-track" style="margin-top:6px; max-width:200px;">
              <div class="progress-fill ${pago ? "green" : ""}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="row-amount neg">${Utils.brl(p.valorParcela)}/mês</div>
          ${ativo ? `
            <button class="btn btn-sm ${pago ? "btn-secondary" : "btn-primary"}"
              onclick="Actions.toggleParcelamentoPago('${p.id}')">
              ${pago ? "Desfazer" : "✓ Pago"}
            </button>` : ""}
          <button class="btn btn-sm btn-ghost" onclick="Modals.openParcelamento('${p.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost"
            onclick="Actions.remove('parcelamentos','Parcelamentos','${p.id}')">🗑️</button>
        </div>`;
    }, "Nenhum parcelamento cadastrado.");
    main.appendChild(card);
  },

  // ════════════════════ DESPESAS ═════════════════════════
  despesas(main) {
    const mk = App.selectedMonth;
    this.header(main, "Despesas Variáveis", "Adicione um gasto em segundos");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Despesa", () => Modals.openDespesa()));
    main.appendChild(this.searchAndFilters("despesas"));

    const list = this.applyFilters(Store.monthDespesas(mk))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (d) => `
      <div class="list-row">
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(d.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(d.categoria || "—")} · ${Utils.fmtDateFull(d.data)} · ${Utils.escapeHtml(d.formaPagamento || "—")}</div>
        </div>
        <div class="row-amount neg">−${Utils.brl(d.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDespesa('${d.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost"
          onclick="Actions.remove('despesas','Despesas','${d.id}')">🗑️</button>
      </div>`, "Nenhuma despesa neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ RECEITAS ═════════════════════════
  receitas(main) {
    const mk = App.selectedMonth;
    this.header(main, "Receitas", "Salário, freelas, PIX, 13º, bônus...");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Receita", () => Modals.openReceita()));

    const list = [...Store.monthReceitas(mk)]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (r) => `
      <div class="list-row">
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(r.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(r.categoria || "—")} · ${Utils.fmtDateFull(r.data)}</div>
        </div>
        <div class="row-amount pos">+${Utils.brl(r.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openReceita('${r.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost"
          onclick="Actions.remove('receitas','Receitas','${r.id}')">🗑️</button>
      </div>`, "Nenhuma receita neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ METAS ════════════════════════════
  metas(main) {
    this.header(main, "Metas Financeiras");
    main.appendChild(this.actionsBar("+ Nova Meta", () => Modals.openMeta()));

    const grid = document.createElement("div");
    grid.className = "grid grid-2";
    if (!Store.data.metas.length) {
      grid.innerHTML = `<div class="card">${this.listOrEmpty([], null, "Nenhuma meta criada ainda.")}</div>`;
    }
    Store.data.metas.forEach((m) => {
      const pct  = Math.min(100, ((Number(m.valorAtual) || 0) / (Number(m.valorAlvo) || 1)) * 100);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${Utils.escapeHtml(m.nome)}</h3>
        <div class="big-number">${Utils.brl(m.valorAtual)}
          <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(m.valorAlvo)}</span>
        </div>
        <div class="progress-track" style="margin-top:12px;">
          <div class="progress-fill green" style="width:${pct}%"></div>
        </div>
        <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% concluída${m.dataLimite ? " · até " + Utils.fmtDateFull(m.dataLimite) : ""}</div>
        <div style="display:flex; gap:8px; margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openMeta('${m.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost"
            onclick="Actions.remove('metas','Metas','${m.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ════════════════════ RELATÓRIOS ═══════════════════════
  relatorios(main) {
    const mk = App.selectedMonth;
    this.header(main, "Relatórios", `Visão financeira de ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("⬇ Exportar CSV", () => Actions.exportCSV(), "btn-secondary"));

    const despMes   = Store.monthDespesas(mk);
    const fixasPagas= Store.monthFixedBills(mk).filter((f) => f.pago);
    const recMes    = Store.monthReceitas(mk);
    const parcMes   = Store.monthParcelamentos(mk);
    const totalParc = parcMes.reduce((s, p) => s + Number(p.valorParcela || 0), 0);
    const totalRec  = Store.sum(recMes);
    const totalDesp = Store.sum(despMes);
    const totalFix  = Store.sum(fixasPagas);
    const saldo     = totalRec - totalDesp - totalFix - totalParc;

    const row1 = document.createElement("div");
    row1.className = "grid grid-2";

    const c1 = document.createElement("div");
    c1.className = "card";
    c1.innerHTML = `<h3>Gastos por categoria</h3><div id="rel-donut"></div>`;
    row1.appendChild(c1);

    const porPagamento = {};
    despMes.forEach((d) => {
      if (d.formaPagamento) porPagamento[d.formaPagamento] = (porPagamento[d.formaPagamento] || 0) + Number(d.valor || 0);
    });
    const c2 = document.createElement("div");
    c2.className = "card";
    c2.innerHTML = `<h3>Por forma de pagamento</h3>` + this.listOrEmpty(
      Object.entries(porPagamento).map(([k, v]) => ({ k, v })),
      ({ k, v }) => `
        <div class="list-row">
          <div class="row-main"><div class="row-title">${Utils.escapeHtml(k)}</div></div>
          <div class="row-amount neg">${Utils.brl(v)}</div>
        </div>`
    );
    row1.appendChild(c2);
    main.appendChild(row1);

    const row2 = document.createElement("div");
    row2.className = "grid grid-2"; row2.style.marginTop = "16px";

    const c3 = document.createElement("div");
    c3.className = "card";
    c3.innerHTML = `
      <h3>Fluxo de caixa — ${Utils.monthLabel(mk)}</h3>
      <div class="list-row">
        <div class="row-main"><div class="row-title">Receitas</div></div>
        <div class="row-amount pos">+${Utils.brl(totalRec)}</div>
      </div>
      <div class="list-row">
        <div class="row-main"><div class="row-title">Despesas variáveis</div></div>
        <div class="row-amount neg">−${Utils.brl(totalDesp)}</div>
      </div>
      <div class="list-row">
        <div class="row-main"><div class="row-title">Contas fixas pagas</div></div>
        <div class="row-amount neg">−${Utils.brl(totalFix)}</div>
      </div>
      <div class="list-row">
        <div class="row-main"><div class="row-title">Parcelamentos</div></div>
        <div class="row-amount neg">−${Utils.brl(totalParc)}</div>
      </div>
      <div class="list-row" style="border-top:2px solid var(--color-border); margin-top:4px;">
        <div class="row-main"><div class="row-title" style="font-weight:800;">Saldo</div></div>
        <div class="row-amount ${saldo >= 0 ? "pos" : "neg"}" style="font-weight:800;">${Utils.brl(saldo)}</div>
      </div>`;
    row2.appendChild(c3);

    const c4 = document.createElement("div");
    c4.className = "card";
    c4.innerHTML = `<h3>Gastos por semana</h3><div id="rel-bars"></div>`;
    row2.appendChild(c4);
    main.appendChild(row2);

    // Gráficos
    const catTotals = {};
    [
      ...despMes,
      ...fixasPagas,
      ...parcMes.map((p) => ({ categoria: "Parcelamento", valor: p.valorParcela })),
    ].forEach((d) => {
      const c = d.categoria || "Outros";
      catTotals[c] = (catTotals[c] || 0) + Number(d.valor || 0);
    });
    Charts.donut(
      document.getElementById("rel-donut"),
      Object.entries(catTotals).map(([label, value]) => ({ label, value, color: Utils.categoryColor(label) }))
    );
    Charts.bars(
      document.getElementById("rel-bars"),
      [1,2,3,4].map((w) => ({
        label: `Sem ${w}`,
        value: Store.sum(despMes.filter((d) => Math.ceil(parseInt(d.data.slice(8,10), 10) / 7) === w)),
      }))
    );
  },

  // ════════════════════ CARTÕES ══════════════════════════
  cartoes(main) {
    this.header(main, "Cartões de Crédito");
    main.appendChild(this.actionsBar("+ Novo Cartão", () => Modals.openCartao()));

    const grid = document.createElement("div");
    grid.className = "grid grid-2";
    if (!Store.data.cartoes.length) {
      grid.innerHTML = `<div class="card">${this.listOrEmpty([], null, "Nenhum cartão cadastrado.")}</div>`;
    }
    Store.data.cartoes.forEach((c) => {
      const usado    = Number(c.limiteUsado) || 0;
      const limite   = Number(c.limite) || 1;
      const pct      = Math.min(100, (usado / limite) * 100);
      const restante = limite - usado;
      const card     = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${Utils.escapeHtml(c.nome)}</h3>
        <div class="big-number">${Utils.brl(restante)}
          <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;"> disponível</span>
        </div>
        <div class="progress-track" style="margin-top:12px;">
          <div class="progress-fill ${pct > 80 ? "red" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="row-sub" style="margin-top:8px;">Usado ${Utils.brl(usado)} de ${Utils.brl(limite)}</div>
        <div class="row-sub">Fechamento dia ${c.fechamento} · Vencimento dia ${c.vencimento}</div>
        <div style="display:flex; gap:8px; margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openCartao('${c.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost"
            onclick="Actions.remove('cartoes','Cartoes','${c.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ════════════════════ CONFIGURAÇÕES ════════════════════
  config(main) {
    this.header(main, "Configurações");
    const row = document.createElement("div");
    row.className = "grid grid-2";

    const c1 = document.createElement("div");
    c1.className = "card";
    c1.innerHTML = `
      <h3>Meta de economia mensal</h3>
      <div class="field" style="margin-top:8px;">
        <input type="number" id="cfg-meta" value="${Store.data.configuracoes.metaEconomiaMensal || 0}">
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;"
        onclick="Actions.saveMetaEconomia()">Salvar</button>`;
    row.appendChild(c1);

    const c2 = document.createElement("div");
    c2.className = "card";
    c2.innerHTML = `
      <h3>Categorias</h3>
      <div id="cat-list" class="legend"></div>
      <div class="field-row" style="margin-top:12px;">
        <input id="new-cat" placeholder="Nova categoria">
        <button class="btn btn-secondary btn-sm" onclick="Actions.addCategory()">Adicionar</button>
      </div>`;
    row.appendChild(c2);

    const c3 = document.createElement("div");
    c3.className = "card";
    c3.innerHTML = `
      <h3>Usuários</h3>
      <p class="row-sub">Usuário 1: <strong>${window.APP_CONFIG?.USER_1 || "Usuário 1"}</strong></p>
      <p class="row-sub" style="margin-top:6px;">Usuário 2: <strong>${window.APP_CONFIG?.USER_2 || "Usuário 2"}</strong></p>
      <p class="row-sub" style="margin-top:12px;">Para alterar os nomes, edite <code>js/config.js</code> e reenvie o arquivo.</p>`;
    row.appendChild(c3);

    const c4 = document.createElement("div");
    c4.className = "card";
    c4.innerHTML = `<h3>Logs de alterações</h3>` + this.listOrEmpty(
      Store.data.logs.slice(0, 8),
      (l) => `
        <div class="list-row">
          <div class="row-main">
            <div class="row-title">${Utils.escapeHtml(l.aba)}</div>
            <div class="row-sub">${l.usuario} · ${l.data} ${l.hora}</div>
          </div>
          <div class="row-sub">${l.valorAntigo} → ${l.valorNovo}</div>
        </div>`,
      "Nenhuma alteração registrada."
    );
    row.appendChild(c4);
    main.appendChild(row);
    this.renderCategoryChips();
  },

  renderCategoryChips() {
    const el = document.getElementById("cat-list");
    if (!el) return;
    el.innerHTML = Store.data.categorias.map((c) =>
      `<span class="legend-item">
        <span class="legend-dot" style="background:${Utils.categoryColor(c)}"></span>
        ${Utils.escapeHtml(c)}
      </span>`
    ).join("");
  },

  // ── Componentes auxiliares ────────────────────────────
  actionsBar(label, onClick, cls = "btn-primary") {
    const div = document.createElement("div");
    div.style.marginBottom = "20px";
    const btn = document.createElement("button");
    btn.className  = `btn ${cls}`;
    btn.textContent = label;
    btn.onclick    = onClick;
    div.appendChild(btn);
    return div;
  },

  searchAndFilters(context) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="search-bar">
        <span class="ic">🔎</span>
        <input id="global-search" placeholder="Buscar por nome..." value="${App.filters.busca}">
      </div>
      <div class="filter-bar" id="cat-filters"></div>`;
    setTimeout(() => {
      document.getElementById("global-search").oninput = Utils.debounce((e) => {
        App.filters.busca = e.target.value;
        Pages.render(context);
      }, 200);
      const fb = document.getElementById("cat-filters");
      fb.innerHTML = ["todas", ...Store.data.categorias].map((c) =>
        `<button class="filter-chip ${App.filters.categoria === c ? "active" : ""}" data-cat="${c}">${c === "todas" ? "Todas" : c}</button>`
      ).join("");
      fb.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.onclick = () => { App.filters.categoria = chip.dataset.cat; Pages.render(context); };
      });
    }, 0);
    return wrap;
  },

  applyFilters(list) {
    return list.filter((item) => {
      const matchCat    = App.filters.categoria === "todas" || item.categoria === App.filters.categoria;
      const matchSearch = !App.filters.busca || (item.nome || "").toLowerCase().includes(App.filters.busca.toLowerCase());
      return matchCat && matchSearch;
    });
  },
};
