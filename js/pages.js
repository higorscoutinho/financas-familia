/* =========================================================
   pages.js — Renderização de cada página do sistema
   ========================================================= */

const Pages = {
  render(page) {
    const main = document.getElementById("main-content");
    main.innerHTML = "";
    const fns = {
      dashboard: this.dashboard,
      fixas: this.fixas,
      despesas: this.despesas,
      receitas: this.receitas,
      cartoes: this.cartoes,
      parcelamentos: this.parcelamentos,
      metas: this.metas,
      relatorios: this.relatorios,
      config: this.config,
    };
    (fns[page] || this.dashboard).call(this, main);
    document.getElementById("fab-add").style.display = ["dashboard", "despesas", "receitas", "fixas"].includes(page) ? "flex" : "flex";
  },

  header(main, title, sub) {
    const h = document.createElement("div");
    h.className = "page-header";
    h.innerHTML = `<div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
    main.appendChild(h);
    return h;
  },

  // ================= DASHBOARD =================
  dashboard(main) {
    const mk = Utils.currentMonthKey();
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const mkPrev = prevDate.toISOString().slice(0, 7);

    const despesasMes = Store.monthDespesas(mk);
    const receitasMes = Store.monthReceitas(mk);
    const fixasMes = Store.monthFixedBills(mk);
    const despesasPrev = Store.monthDespesas(mkPrev);

    const totalReceitas = Store.sum(receitasMes);
    const totalDespesasVar = Store.sum(despesasMes);
    const totalFixas = Store.sum(fixasMes);
    const totalFixasPagas = Store.sum(fixasMes.filter((f) => f.pago));
    const totalFixasAbertas = totalFixas - totalFixasPagas;
    const saldo = totalReceitas - totalDespesasVar - totalFixas;
    const podeGastar = totalReceitas - totalDespesasVar - totalFixas;
    const totalDespesasPrev = Store.sum(despesasPrev);

    const diasNoMes = Utils.daysInMonth(mk);
    const diaHoje = Utils.dayOfMonthToday();
    const diasRestantes = Math.max(1, diasNoMes - diaHoje + 1);
    const porDia = podeGastar > 0 ? podeGastar / diasRestantes : 0;

    const metaEconomia = Number(Store.data.configuracoes.metaEconomiaMensal) || 0;
    const economizado = Math.max(0, saldo);

    this.header(main, `Olá, ${App.currentUser.split(" ")[0]} 👋`, `Resumo de ${Utils.monthLabel(mk)}`);

    const statsWrap = document.createElement("div");
    statsWrap.className = "grid grid-stats";
    const delta = totalDespesasPrev ? (((totalDespesasVar - totalDespesasPrev) / totalDespesasPrev) * 100).toFixed(0) : null;

    statsWrap.innerHTML = `
      ${this.statCard("blue", "💼", "Saldo do mês", Utils.brl(saldo))}
      ${this.statCard("green", "💰", "Receitas", Utils.brl(totalReceitas))}
      ${this.statCard("red", "💸", "Despesas totais", Utils.brl(totalDespesasVar + totalFixas))}
      ${this.statCard("amber", "🧮", "Posso gastar ainda", Utils.brl(podeGastar))}
      ${this.statCard("red", "⏳", "Falta pagar (fixas)", Utils.brl(totalFixasAbertas))}
      ${this.statCard("blue", "📌", "Total contas fixas", Utils.brl(totalFixas))}
      ${this.statCard("amber", "🛒", "Total despesas variáveis", Utils.brl(totalDespesasVar))}
      ${this.statCard("green", "📅", "Posso gastar por dia", Utils.brl(porDia))}
    `;
    main.appendChild(statsWrap);

    // segunda fileira: gráficos
    const row2 = document.createElement("div");
    row2.className = "grid grid-2";
    row2.style.marginTop = "16px";

    const cardCat = document.createElement("div");
    cardCat.className = "card";
    cardCat.innerHTML = `<h3>Gastos por categoria</h3><div id="chart-donut"></div>`;
    row2.appendChild(cardCat);

    const cardComp = document.createElement("div");
    cardComp.className = "card";
    cardComp.innerHTML = `
      <h3>Comparativo entre meses</h3>
      <div id="chart-comp"></div>
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-text-faint)"></span>${Utils.monthLabel(mkPrev)}</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-accent)"></span>${Utils.monthLabel(mk)}</div>
      </div>
      <div class="delta ${delta === null ? "" : delta > 0 ? "down" : "up"}" style="margin-top:10px;">
        ${delta === null ? "Sem dados do mês anterior" : delta > 0 ? `▲ ${delta}% a mais que o mês passado` : `▼ ${Math.abs(delta)}% a menos que o mês passado`}
      </div>`;
    row2.appendChild(cardComp);
    main.appendChild(row2);

    // terceira fileira: meta de economia + top gastos + alertas
    const row3 = document.createElement("div");
    row3.className = "grid grid-2";
    row3.style.marginTop = "16px";

    const cardMeta = document.createElement("div");
    cardMeta.className = "card";
    const pct = metaEconomia > 0 ? Math.min(100, (economizado / metaEconomia) * 100) : 0;
    cardMeta.innerHTML = `
      <h3>Meta de economia mensal</h3>
      <div class="big-number">${Utils.brl(economizado)} <span style="font-size:14px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(metaEconomia)}</span></div>
      <div class="progress-track" style="margin-top:12px;"><div class="progress-fill green" style="width:${pct}%"></div></div>
      <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% da meta atingida</div>`;
    row3.appendChild(cardMeta);

    const cardTop = document.createElement("div");
    cardTop.className = "card";
    const topGastos = [...despesasMes, ...fixasMes.filter((f) => f.pago)]
      .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
      .slice(0, 5);
    cardTop.innerHTML = `<h3>Maiores gastos do mês</h3>` + this.listOrEmpty(topGastos, (g) => `
      <div class="list-row">
        <div class="row-icon">${this.catIcon(g.categoria)}</div>
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(g.nome)}</div><div class="row-sub">${Utils.escapeHtml(g.categoria || "—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(g.valor)}</div>
      </div>`);
    row3.appendChild(cardTop);
    main.appendChild(row3);

    // Alertas de vencimento
    const alertCard = document.createElement("div");
    alertCard.className = "card";
    alertCard.style.marginTop = "16px";
    alertCard.innerHTML = `<h3>Alertas de vencimento</h3>`;
    const alerts = fixasMes
      .filter((f) => !f.pago)
      .map((f) => ({ ...f, dias: Utils.daysUntil(Number(f.diaVencimento)) }))
      .sort((a, b) => a.dias - b.dias);
    alertCard.innerHTML += this.listOrEmpty(alerts, (f) => {
      let badge = `<span class="badge gray">Em ${f.dias} dias</span>`;
      if (f.dias < 0) badge = `<span class="badge red">Atrasada (${Math.abs(f.dias)}d)</span>`;
      else if (f.dias === 0) badge = `<span class="badge red">Vence hoje</span>`;
      else if (f.dias === 1) badge = `<span class="badge amber">Vence amanhã</span>`;
      else if (f.dias <= 3) badge = `<span class="badge amber">Em ${f.dias} dias</span>`;
      return `
        <div class="list-row">
          <div class="row-icon">${this.catIcon(f.categoria)}</div>
          <div class="row-main"><div class="row-title">${Utils.escapeHtml(f.nome)}</div><div class="row-sub">Vence dia ${f.diaVencimento}</div></div>
          ${badge}
          <button class="btn btn-sm btn-secondary" style="margin-left:8px" onclick="Actions.payFixedBill('${f.id}')">Pago</button>
        </div>`;
    }, "🎉 Tudo pago por aqui!");
    main.appendChild(alertCard);

    // Renderiza gráficos depois de inserido no DOM
    const catTotals = {};
    [...despesasMes, ...fixasMes.filter((f) => f.pago)].forEach((d) => {
      const c = d.categoria || "Outros";
      catTotals[c] = (catTotals[c] || 0) + Number(d.valor || 0);
    });
    const donutData = Object.entries(catTotals).map(([label, value]) => ({ label, value, color: Utils.categoryColor(label) }));
    Charts.donut(document.getElementById("chart-donut"), donutData);

    const labels = ["S1", "S2", "S3", "S4"];
    const splitWeeks = (list, mkRef) =>
      [0, 0, 0, 0].map((_, w) =>
        Store.sum(list.filter((d) => Utils.monthKey(d.data) === mkRef && Math.ceil((parseInt(d.data.slice(8, 10), 10)) / 7) === w + 1))
      );
    Charts.comparativeLine(document.getElementById("chart-comp"), splitWeeks(Store.data.despesas, mkPrev), splitWeeks(Store.data.despesas, mk), labels);
  },

  statCard(color, icon, title, value, delta) {
    return `<div class="card">
      <div class="stat-icon ${color}">${icon}</div>
      <h3>${title}</h3>
      <div class="big-number">${value}</div>
      ${delta ? `<div class="delta">${delta}</div>` : ""}
    </div>`;
  },

  catIcon() { return "🏷️"; },

  listOrEmpty(items, renderFn, emptyMsg = "Nenhum registro ainda") {
    if (!items.length) return `<div class="empty-state"><div class="emoji">🗂️</div><p>${emptyMsg}</p></div>`;
    return `<div class="list">${items.map(renderFn).join("")}</div>`;
  },

  // ================= CONTAS FIXAS =================
  fixas(main) {
    const mk = Utils.currentMonthKey();
    this.header(main, "Contas Fixas", "Recriadas automaticamente todo mês");
    main.appendChild(this.actionsBar("+ Nova Conta Fixa", () => Modals.openFixa()));

    const list = Store.monthFixedBills(mk).sort((a, b) => Number(a.diaVencimento) - Number(b.diaVencimento));
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (f) => {
      const dias = Utils.daysUntil(Number(f.diaVencimento));
      let statusBadge = f.pago
        ? `<span class="badge green">Pago</span>`
        : dias < 0
        ? `<span class="badge red">Atrasada</span>`
        : dias <= 3
        ? `<span class="badge amber">Vence em ${dias}d</span>`
        : `<span class="badge gray">Dia ${f.diaVencimento}</span>`;
      return `
      <div class="list-row">
        <div class="row-icon">${this.catIcon()}</div>
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(f.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(f.categoria || "—")} · vence dia ${f.diaVencimento}${f.pago ? ` · pago em ${Utils.fmtDateShort(f.dataPagamento)}` : ""}</div>
        </div>
        ${statusBadge}
        <div class="row-amount neg" style="margin-left:10px;">${Utils.brl(f.valor)}</div>
        <button class="btn btn-sm ${f.pago ? "btn-secondary" : "btn-primary"}" style="margin-left:10px"
          onclick="Actions.payFixedBill('${f.id}')">${f.pago ? "Desfazer" : "Marcar pago"}</button>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openFixa('${f.id}')">✏️</button>
      </div>`;
    }, "Nenhuma conta fixa cadastrada. Clique em “Nova Conta Fixa”.");
    main.appendChild(card);
  },

  // ================= DESPESAS =================
  despesas(main) {
    this.header(main, "Despesas Variáveis", "Adicione um gasto em segundos");
    main.appendChild(this.actionsBar("+ Nova Despesa", () => Modals.openDespesa()));
    main.appendChild(this.searchAndFilters("despesas"));

    const list = this.applyFilters(Store.data.despesas).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (d) => `
      <div class="list-row">
        <div class="row-icon">${this.catIcon()}</div>
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(d.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(d.categoria || "—")} · ${Utils.fmtDateFull(d.data)} · ${Utils.escapeHtml(d.formaPagamento || "—")}</div>
        </div>
        <div class="row-amount neg">−${Utils.brl(d.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDespesa('${d.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('despesas','Despesas','${d.id}')">🗑️</button>
      </div>`, "Nenhuma despesa encontrada.");
    main.appendChild(card);
  },

  // ================= RECEITAS =================
  receitas(main) {
    this.header(main, "Receitas", "Salário, freelas, PIX, 13º, bônus...");
    main.appendChild(this.actionsBar("+ Nova Receita", () => Modals.openReceita()));

    const list = [...Store.data.receitas].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(list, (r) => `
      <div class="list-row">
        <div class="row-icon">💵</div>
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(r.nome)}</div>
          <div class="row-sub">${Utils.escapeHtml(r.categoria || "—")} · ${Utils.fmtDateFull(r.data)}</div>
        </div>
        <div class="row-amount pos">+${Utils.brl(r.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openReceita('${r.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('receitas','Receitas','${r.id}')">🗑️</button>
      </div>`, "Nenhuma receita cadastrada ainda.");
    main.appendChild(card);
  },

  // ================= CARTÕES =================
  cartoes(main) {
    this.header(main, "Cartões de Crédito");
    main.appendChild(this.actionsBar("+ Novo Cartão", () => Modals.openCartao()));

    const grid = document.createElement("div");
    grid.className = "grid grid-2";
    if (!Store.data.cartoes.length) {
      grid.innerHTML = `<div class="card">${this.listOrEmpty([], null, "Nenhum cartão cadastrado.")}</div>`;
    }
    Store.data.cartoes.forEach((c) => {
      const usado = Number(c.limiteUsado) || 0;
      const limite = Number(c.limite) || 1;
      const pct = Math.min(100, (usado / limite) * 100);
      const restante = limite - usado;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${Utils.escapeHtml(c.nome)}</h3>
        <div class="big-number">${Utils.brl(restante)} <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;">disponível</span></div>
        <div class="progress-track" style="margin-top:12px;"><div class="progress-fill ${pct > 80 ? "red" : ""}" style="width:${pct}%"></div></div>
        <div class="row-sub" style="margin-top:8px;">Usado ${Utils.brl(usado)} de ${Utils.brl(limite)}</div>
        <div class="row-sub">Fechamento dia ${c.fechamento} · Vencimento dia ${c.vencimento}</div>
        <div style="display:flex; gap:8px; margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openCartao('${c.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('cartoes','Cartoes','${c.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ================= PARCELAMENTOS =================
  parcelamentos(main) {
    this.header(main, "Parcelamentos", "Atualizados automaticamente a cada mês");
    main.appendChild(this.actionsBar("+ Novo Parcelamento", () => Modals.openParcelamento()));

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = this.listOrEmpty(Store.data.parcelamentos, (p) => {
      const pct = Math.min(100, (Number(p.parcelaAtual) / Number(p.qtdTotal)) * 100);
      return `
      <div class="list-row" style="flex-wrap:wrap;">
        <div class="row-icon">📦</div>
        <div class="row-main">
          <div class="row-title">${Utils.escapeHtml(p.nome)}</div>
          <div class="row-sub">Parcela ${p.parcelaAtual}/${p.qtdTotal} · termina em ${Utils.fmtDateFull(p.dataFinal)}</div>
          <div class="progress-track" style="margin-top:6px; max-width:220px;"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="row-amount neg">${Utils.brl(p.valorParcela)}/mês</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openParcelamento('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('parcelamentos','Parcelamentos','${p.id}')">🗑️</button>
      </div>`;
    }, "Nenhum parcelamento cadastrado.");
    main.appendChild(card);
  },

  // ================= METAS =================
  metas(main) {
    this.header(main, "Metas Financeiras");
    main.appendChild(this.actionsBar("+ Nova Meta", () => Modals.openMeta()));

    const grid = document.createElement("div");
    grid.className = "grid grid-2";
    if (!Store.data.metas.length) grid.innerHTML = `<div class="card">${this.listOrEmpty([], null, "Nenhuma meta criada ainda.")}</div>`;
    Store.data.metas.forEach((m) => {
      const pct = Math.min(100, ((Number(m.valorAtual) || 0) / (Number(m.valorAlvo) || 1)) * 100);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${Utils.escapeHtml(m.nome)}</h3>
        <div class="big-number">${Utils.brl(m.valorAtual)} <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(m.valorAlvo)}</span></div>
        <div class="progress-track" style="margin-top:12px;"><div class="progress-fill green" style="width:${pct}%"></div></div>
        <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% concluída ${m.dataLimite ? `· até ${Utils.fmtDateFull(m.dataLimite)}` : ""}</div>
        <div style="display:flex; gap:8px; margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openMeta('${m.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('metas','Metas','${m.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ================= RELATÓRIOS =================
  relatorios(main) {
    this.header(main, "Relatórios", "Visão completa das suas finanças");
    main.appendChild(this.actionsBar("⬇ Exportar CSV", () => Actions.exportCSV(), "btn-secondary"));

    const mk = Utils.currentMonthKey();
    const despesasMes = Store.monthDespesas(mk);
    const fixasMes = Store.monthFixedBills(mk).filter((f) => f.pago);
    const receitasMes = Store.monthReceitas(mk);

    const row = document.createElement("div");
    row.className = "grid grid-2";

    const c1 = document.createElement("div");
    c1.className = "card";
    c1.innerHTML = `<h3>Gastos por categoria</h3><div id="rel-donut"></div>`;
    row.appendChild(c1);

    const c2 = document.createElement("div");
    c2.className = "card";
    const porCartao = {};
    despesasMes.forEach((d) => { if (d.formaPagamento) porCartao[d.formaPagamento] = (porCartao[d.formaPagamento] || 0) + Number(d.valor || 0); });
    c2.innerHTML = `<h3>Gastos por forma de pagamento</h3>` + this.listOrEmpty(
      Object.entries(porCartao).map(([k, v]) => ({ k, v })),
      ({ k, v }) => `<div class="list-row"><div class="row-main"><div class="row-title">${Utils.escapeHtml(k)}</div></div><div class="row-amount neg">${Utils.brl(v)}</div></div>`
    );
    row.appendChild(c2);
    main.appendChild(row);

    const row2 = document.createElement("div");
    row2.className = "grid grid-2";
    row2.style.marginTop = "16px";

    const c3 = document.createElement("div");
    c3.className = "card";
    c3.innerHTML = `
      <h3>Fluxo de caixa do mês</h3>
      <div class="list-row"><div class="row-main"><div class="row-title">Receitas</div></div><div class="row-amount pos">+${Utils.brl(Store.sum(receitasMes))}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title">Despesas variáveis</div></div><div class="row-amount neg">−${Utils.brl(Store.sum(despesasMes))}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title">Contas fixas pagas</div></div><div class="row-amount neg">−${Utils.brl(Store.sum(fixasMes))}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title" style="font-weight:800;">Saldo</div></div><div class="row-amount pos" style="font-weight:800;">${Utils.brl(Store.sum(receitasMes) - Store.sum(despesasMes) - Store.sum(fixasMes))}</div></div>`;
    row2.appendChild(c3);

    const c4 = document.createElement("div");
    c4.className = "card";
    c4.innerHTML = `<h3>Resumo semanal</h3><div id="rel-bars"></div>`;
    row2.appendChild(c4);
    main.appendChild(row2);

    const catTotals = {};
    [...despesasMes, ...fixasMes].forEach((d) => { const c = d.categoria || "Outros"; catTotals[c] = (catTotals[c] || 0) + Number(d.valor || 0); });
    Charts.donut(document.getElementById("rel-donut"), Object.entries(catTotals).map(([label, value]) => ({ label, value, color: Utils.categoryColor(label) })));

    const weeks = [1, 2, 3, 4].map((w) => ({
      label: `Sem ${w}`,
      value: Store.sum(despesasMes.filter((d) => Math.ceil(parseInt(d.data.slice(8, 10), 10) / 7) === w)),
    }));
    Charts.bars(document.getElementById("rel-bars"), weeks);
  },

  // ================= CONFIGURAÇÕES =================
  config(main) {
    this.header(main, "Configurações");
    const row = document.createElement("div");
    row.className = "grid grid-2";

    const c1 = document.createElement("div");
    c1.className = "card";
    c1.innerHTML = `
      <h3>Meta de economia mensal</h3>
      <div class="field" style="margin-top:8px;">
        <input type="number" id="cfg-meta" value="${Store.data.configuracoes.metaEconomiaMensal || 0}" />
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="Actions.saveMetaEconomia()">Salvar</button>`;
    row.appendChild(c1);

    const c2 = document.createElement("div");
    c2.className = "card";
    c2.innerHTML = `
      <h3>Categorias</h3>
      <div id="cat-list" class="legend"></div>
      <div class="field-row" style="margin-top:12px;">
        <input id="new-cat" placeholder="Nova categoria" />
        <button class="btn btn-secondary btn-sm" onclick="Actions.addCategory()">Adicionar</button>
      </div>`;
    row.appendChild(c2);

    const c3 = document.createElement("div");
    c3.className = "card";
    c3.innerHTML = `
      <h3>Conexão com Google Sheets</h3>
      <p class="row-sub">${API.isConfigured() ? "✅ Conectado ao Web App do Apps Script." : "⚠️ Configure a API_URL em js/config.js para sincronizar com a planilha."}</p>`;
    row.appendChild(c3);

    const c4 = document.createElement("div");
    c4.className = "card";
    c4.innerHTML = `<h3>Logs de alterações</h3>` + this.listOrEmpty(Store.data.logs.slice(0, 8), (l) => `
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(l.aba)}</div><div class="row-sub">${l.usuario} · ${l.data} ${l.hora}</div></div>
        <div class="row-sub">${l.valorAntigo} → ${l.valorNovo}</div>
      </div>`, "Nenhuma alteração registrada ainda.");
    row.appendChild(c4);

    main.appendChild(row);
    this.renderCategoryChips();
  },

  renderCategoryChips() {
    const el = document.getElementById("cat-list");
    if (!el) return;
    el.innerHTML = Store.data.categorias
      .map((c) => `<span class="legend-item"><span class="legend-dot" style="background:${Utils.categoryColor(c)}"></span>${Utils.escapeHtml(c)}</span>`)
      .join("");
  },

  // ================= COMPONENTES AUXILIARES =================
  actionsBar(label, onClick, cls = "btn-primary") {
    const div = document.createElement("div");
    div.style.marginBottom = "20px";
    const btn = document.createElement("button");
    btn.className = `btn ${cls}`;
    btn.textContent = label;
    btn.onclick = onClick;
    div.appendChild(btn);
    return div;
  },

  searchAndFilters(context) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="search-bar">
        <span class="ic">🔎</span>
        <input id="global-search" placeholder="Buscar por nome..." value="${App.filters.busca}" />
      </div>
      <div class="filter-bar" id="cat-filters"></div>`;
    setTimeout(() => {
      document.getElementById("global-search").oninput = Utils.debounce((e) => {
        App.filters.busca = e.target.value;
        Pages.render(context);
      }, 200);
      const fb = document.getElementById("cat-filters");
      const cats = ["todas", ...Store.data.categorias];
      fb.innerHTML = cats
        .map((c) => `<button class="filter-chip ${App.filters.categoria === c ? "active" : ""}" data-cat="${c}">${c === "todas" ? "Todas" : c}</button>`)
        .join("");
      fb.querySelectorAll(".filter-chip").forEach((chip) => {
        chip.onclick = () => { App.filters.categoria = chip.dataset.cat; Pages.render(context); };
      });
    }, 0);
    return wrap;
  },

  applyFilters(list) {
    return list.filter((item) => {
      const matchCat = App.filters.categoria === "todas" || item.categoria === App.filters.categoria;
      const matchSearch = !App.filters.busca || (item.nome || "").toLowerCase().includes(App.filters.busca.toLowerCase());
      return matchCat && matchSearch;
    });
  },
};
