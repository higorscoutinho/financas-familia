/* =========================================================
   pages.js — Renderização de cada tela
   ADICIONADO: página Dívidas completa
   ALTERADO: Dashboard mostra card de alerta de dívidas
   ========================================================= */

const Pages = {

  render(page) {
    const main = document.getElementById("main-content");
    main.innerHTML = "";
    const map = {
      dashboard:     this.dashboard,
      dividas:       this.dividas,
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

  monthSelector(main) {
    const mk   = App.selectedMonth;
    const wrap = document.createElement("div");
    wrap.className = "month-selector";
    wrap.innerHTML = `
      <button class="ms-arrow" onclick="App.prevMonth()" title="Mês anterior">&#8249;</button>
      <div class="ms-center">
        <span class="ms-label">${Utils.monthLabel(mk)}</span>
        <input class="month-picker-input" type="month" value="${mk}" onchange="App.setMonth(this.value)">
      </div>
      <button class="ms-arrow" onclick="App.nextMonth()" title="Próximo mês">&#8250;</button>`;
    main.appendChild(wrap);
  },

  header(main, title, sub) {
    const h = document.createElement("div");
    h.className = "page-header";
    h.innerHTML = `<div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div>`;
    main.appendChild(h);
  },

  statCard(color, icon, title, value) {
    return `<div class="card"><div class="stat-icon ${color}">${icon}</div><h3>${title}</h3><div class="big-number">${value}</div></div>`;
  },

  listOrEmpty(items, renderFn, emptyMsg="Nenhum registro.") {
    if (!items?.length) return `<div class="empty-state"><div class="emoji">🗂️</div><p>${emptyMsg}</p></div>`;
    return `<div class="list">${items.map(renderFn).join("")}</div>`;
  },

  actionsBar(label, onClick, cls="btn-primary") {
    const div = document.createElement("div");
    div.style.marginBottom = "20px";
    const btn = document.createElement("button");
    btn.className = `btn ${cls}`; btn.textContent = label; btn.onclick = onClick;
    div.appendChild(btn);
    return div;
  },

  // ════════════════════ DASHBOARD ════════════════════════
  dashboard(main) {
    const mk    = App.selectedMonth;
    const mkPrev = Utils.prevMonthKey(mk);
    const isNow = App.isCurrentMonth();

    const despMes  = Store.monthDespesas(mk);
    const recMes   = Store.monthReceitas(mk);
    const fixasMes = Store.monthFixedBills(mk);
    const parcMes  = Store.monthParcelamentos(mk);
    const despPrev = Store.monthDespesas(mkPrev);

    const totalRec     = Store.sum(recMes);
    const totalDespVar = Store.sum(despMes);
    const totalFixas   = Store.sum(fixasMes);
    const totalParc    = parcMes.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    const totalSaidas  = totalDespVar + totalFixas + totalParc;
    const saldo        = totalRec - totalSaidas;
    const fixasAbertas = Store.sum(fixasMes.filter((f)=>!f.pago));
    const diasMes      = Utils.daysInMonth(mk);
    const diaHoje      = isNow ? Utils.dayOfMonthToday() : diasMes;
    const porDia       = isNow && saldo > 0 ? saldo / Math.max(1, diasMes - diaHoje + 1) : 0;
    const metaEcon     = Number(Store.data.configuracoes.metaEconomiaMensal) || 0;
    const totalPrev    = Store.sum(despPrev);
    const delta        = totalPrev ? (((totalSaidas-totalPrev)/totalPrev)*100).toFixed(0) : null;

    // Dívidas para o alerta
    const stats = Store.dividaStats();

    this.header(main,
      isNow ? `Olá, ${App.currentUser.split(" ")[0]} 👋` : `📅 ${Utils.monthLabel(mk)}`,
      `Resumo de ${Utils.monthLabel(mk)}${!isNow?" — modo consulta":""}`
    );
    this.monthSelector(main);

    if (!isNow) {
      const bar = document.createElement("div"); bar.className="notice-bar";
      bar.innerHTML = `🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta`;
      main.appendChild(bar);
    }

    // Alerta de dívidas no dashboard
    if (stats.ativas.length > 0) {
      const maior = stats.maior;
      const alertDiv = document.createElement("div");
      alertDiv.className = "debt-alert-card";
      alertDiv.innerHTML = `
        <div class="debt-alert-icon">⚠️</div>
        <div class="debt-alert-body">
          <div class="debt-alert-title">Você possui ${stats.ativas.length} dívida${stats.ativas.length>1?"s":""}</div>
          <div class="debt-alert-sub">Total em aberto: <strong>${Utils.brl(stats.totalAberto)}</strong>${maior?` · Maior: ${maior.nome}`:""}${stats.atraso.length?` · ${stats.atraso.length} em atraso`:""}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="App.goTo('dividas')">Ver dívidas</button>`;
      main.appendChild(alertDiv);
    }

    const grid = document.createElement("div"); grid.className="grid grid-stats";
    grid.innerHTML = `
      ${this.statCard("blue","💼","Saldo do mês",Utils.brl(saldo))}
      ${this.statCard("green","💰","Receitas",Utils.brl(totalRec))}
      ${this.statCard("red","💸","Total de saídas",Utils.brl(totalSaidas))}
      ${this.statCard("amber","🧮",isNow?"Posso gastar ainda":"Resultado",Utils.brl(saldo))}
      ${this.statCard("red","⏳","Fixas em aberto",Utils.brl(fixasAbertas))}
      ${this.statCard("blue","📌","Contas fixas",Utils.brl(totalFixas))}
      ${this.statCard("amber","🛒","Despesas variáveis",Utils.brl(totalDespVar))}
      ${this.statCard("red","📦","Parcelamentos",Utils.brl(totalParc))}
      ${stats.totalAberto>0?this.statCard("red","🔴","Dívidas em aberto",Utils.brl(stats.totalAberto)):""}
      ${isNow?this.statCard("green","📅","Posso gastar/dia",Utils.brl(porDia)):""}
    `;
    main.appendChild(grid);

    const row2 = document.createElement("div"); row2.className="grid grid-2"; row2.style.marginTop="16px";
    const cDonut = document.createElement("div"); cDonut.className="card";
    cDonut.innerHTML=`<h3>Gastos por categoria</h3><div id="chart-donut"></div>`;
    row2.appendChild(cDonut);
    const cComp = document.createElement("div"); cComp.className="card";
    cComp.innerHTML=`
      <h3>Comparativo — mês anterior</h3><div id="chart-comp"></div>
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-text-faint)"></span>${Utils.monthLabel(mkPrev)}</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-accent)"></span>${Utils.monthLabel(mk)}</div>
      </div>
      <div class="delta ${delta===null?"":(Number(delta)>0?"down":"up")}" style="margin-top:10px;">
        ${delta===null?"Sem dados anteriores":Number(delta)>0?`▲ ${delta}% a mais`:`▼ ${Math.abs(delta)}% a menos`}
      </div>`;
    row2.appendChild(cComp);
    main.appendChild(row2);

    const row3 = document.createElement("div"); row3.className="grid grid-2"; row3.style.marginTop="16px";
    const pct = metaEcon>0?Math.min(100,(Math.max(0,saldo)/metaEcon)*100):0;
    const cMeta = document.createElement("div"); cMeta.className="card";
    cMeta.innerHTML=`<h3>Meta de economia</h3>
      <div class="big-number">${Utils.brl(Math.max(0,saldo))} <span style="font-size:14px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(metaEcon)}</span></div>
      <div class="progress-track" style="margin-top:12px;"><div class="progress-fill green" style="width:${pct}%"></div></div>
      <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% atingida</div>`;
    row3.appendChild(cMeta);
    const topItems=[...despMes,...fixasMes.filter((f)=>f.pago),...parcMes.map((p)=>({nome:p.nome,categoria:"Parcelamento",valor:p.valorParcela}))]
      .sort((a,b)=>(Number(b.valor)||0)-(Number(a.valor)||0)).slice(0,5);
    const cTop=document.createElement("div"); cTop.className="card";
    cTop.innerHTML=`<h3>Maiores gastos do mês</h3>`+this.listOrEmpty(topItems,(g)=>`
      <div class="list-row"><div class="row-main"><div class="row-title">${Utils.escapeHtml(g.nome)}</div><div class="row-sub">${Utils.escapeHtml(g.categoria||"—")}</div></div>
      <div class="row-amount neg">−${Utils.brl(g.valor)}</div></div>`);
    row3.appendChild(cTop);
    main.appendChild(row3);

    if (isNow) {
      const alertas = fixasMes.filter((f)=>!f.pago)
        .map((f)=>({...f,dias:Utils.daysUntil(Number(f.diaVencimento))}))
        .sort((a,b)=>a.dias-b.dias);
      const cAlert=document.createElement("div"); cAlert.className="card"; cAlert.style.marginTop="16px";
      cAlert.innerHTML=`<h3>Alertas de vencimento</h3>`+this.listOrEmpty(alertas,(f)=>{
        const badge=f.dias<0?`<span class="badge red">Atrasada (${Math.abs(f.dias)}d)</span>`:
          f.dias===0?`<span class="badge red">Hoje</span>`:f.dias===1?`<span class="badge amber">Amanhã</span>`:
          f.dias<=3?`<span class="badge amber">Em ${f.dias}d</span>`:`<span class="badge gray">Em ${f.dias}d</span>`;
        return `<div class="list-row">
          <div class="row-main"><div class="row-title">${Utils.escapeHtml(f.nome)}</div><div class="row-sub">Dia ${f.diaVencimento}</div></div>
          ${badge}<button class="btn btn-sm btn-secondary" style="margin-left:8px" onclick="Actions.payFixedBill('${f.id}')">Pago</button></div>`;
      },"🎉 Tudo pago!");
      main.appendChild(cAlert);
    }

    const catTotals={};
    [...despMes,...fixasMes.filter((f)=>f.pago),...parcMes.map((p)=>({categoria:"Parcelamento",valor:p.valorParcela}))]
      .forEach((d)=>{const c=d.categoria||"Outros";catTotals[c]=(catTotals[c]||0)+Number(d.valor||0);});
    Charts.donut(document.getElementById("chart-donut"),Object.entries(catTotals).map(([label,value])=>({label,value,color:Utils.categoryColor(label)})));
    const wk=(list,mkRef)=>[0,0,0,0].map((_,w)=>Store.sum(list.filter((d)=>Utils.monthKey(d.data)===mkRef&&Math.ceil(parseInt(d.data.slice(8,10),10)/7)===w+1)));
    Charts.comparativeLine(document.getElementById("chart-comp"),wk(Store.data.despesas,mkPrev),wk(Store.data.despesas,mk),["S1","S2","S3","S4"]);
  },

  // ════════════════════ DÍVIDAS ══════════════════════════
  dividas(main) {
    Store.checkOverdueBills();
    const stats = Store.dividaStats();

    this.header(main, "Dívidas", "Controle completo do seu passivo financeiro");
    main.appendChild(this.actionsBar("+ Nova Dívida", () => Modals.openDivida(), "btn-danger"));

    // Cards de resumo
    const resumo = document.createElement("div"); resumo.className="grid grid-stats";
    resumo.innerHTML = `
      <div class="card"><div class="stat-icon red">🔴</div><h3>Total em aberto</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAberto)}</div></div>
      <div class="card"><div class="stat-icon red">⚠️</div><h3>Em atraso</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAtraso)}</div><div class="row-sub">${stats.atraso.length} dívida${stats.atraso.length!==1?"s":""}</div></div>
      <div class="card"><div class="stat-icon amber">🤝</div><h3>Negociadas</h3><div class="big-number" style="color:var(--color-warning);">${Utils.brl(stats.totalNegoc)}</div></div>
      <div class="card"><div class="stat-icon green">✅</div><h3>Total quitado</h3><div class="big-number" style="color:var(--color-positive);">${Utils.brl(stats.totalQuitado)}</div></div>
      ${stats.maior?`<div class="card"><div class="stat-icon red">📊</div><h3>Maior dívida</h3><div class="big-number" style="font-size:18px;">${Utils.escapeHtml(stats.maior.nome)}</div><div class="row-sub">${Utils.brl(stats.maior.valorRestante)}</div></div>`:""}`;
    main.appendChild(resumo);

    // Meta de quitar dívidas
    const totalOriginal = Store.data.dividas.reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    const totalQuitadoGeral = Store.data.dividas.filter((d)=>d.status==="quitada").reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    if (totalOriginal > 0) {
      const pctMeta = Math.min(100,(totalQuitadoGeral/totalOriginal)*100);
      const cMeta = document.createElement("div"); cMeta.className="card"; cMeta.style.marginTop="16px";
      cMeta.innerHTML=`<h3>🎯 Meta: ficar sem dívidas</h3>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
          <div class="big-number" style="color:var(--color-positive);">${Utils.brl(totalQuitadoGeral)}</div>
          <span style="color:var(--color-text-muted);font-size:14px;">quitado de ${Utils.brl(totalOriginal)}</span>
        </div>
        <div class="progress-track"><div class="progress-fill green" style="width:${pctMeta}%"></div></div>
        <div class="row-sub" style="margin-top:6px;">${pctMeta.toFixed(0)}% concluído · faltam ${Utils.brl(totalOriginal-totalQuitadoGeral)}</div>`;
      main.appendChild(cMeta);
    }

    // Filtros de status
    const statusFiltros = [
      {v:"todas",l:"Todas"},{v:"em_atraso",l:"Em atraso"},{v:"em_aberto",l:"Em aberto"},
      {v:"negociada",l:"Negociadas"},{v:"parcelada",l:"Parceladas"},{v:"quitada",l:"Quitadas"},
    ];
    const filterBar = document.createElement("div"); filterBar.className="filter-bar"; filterBar.style.marginTop="20px";
    let filtroAtual = "todas";
    filterBar.innerHTML = statusFiltros.map((f)=>
      `<button class="filter-chip ${f.v==="todas"?"active":""}" data-status="${f.v}">${f.l}</button>`
    ).join("");
    main.appendChild(filterBar);

    const listWrap = document.createElement("div"); listWrap.id="dividas-list";
    main.appendChild(listWrap);

    const render = (filtro) => {
      const lista = filtro==="todas"
        ? Store.data.dividas
        : Store.data.dividas.filter((d)=>d.status===filtro);
      const sorted = [...lista].sort((a,b)=>{
        const ord={em_atraso:0,em_aberto:1,negociada:2,parcelada:3,quitada:4};
        return (ord[a.status]??5)-(ord[b.status]??5);
      });
      listWrap.innerHTML = sorted.length===0
        ? `<div class="card"><div class="empty-state"><div class="emoji">🎉</div><p>Nenhuma dívida encontrada!</p></div></div>`
        : sorted.map((d) => this.debtCard(d)).join("");
    };

    filterBar.querySelectorAll(".filter-chip").forEach((chip)=>{
      chip.onclick=()=>{
        filtroAtual=chip.dataset.status;
        filterBar.querySelectorAll(".filter-chip").forEach((c)=>c.classList.remove("active"));
        chip.classList.add("active");
        render(filtroAtual);
      };
    });

    render(filtroAtual);
  },

  debtCard(d) {
    const pagamentos = Store.data.pagamentosDividas.filter((p) => p.dividaId===d.id);
    const pct        = d.valorAtual>0 ? Math.min(100,((Number(d.valorPago)||0)/Number(d.valorAtual))*100) : 0;
    const dias        = Store.diasAtraso(d);
    const prioLabel  = {alta:"Alta",media:"Média",baixa:"Baixa"}[d.prioridade]||"Baixa";
    const statusLabel= {em_aberto:"Em aberto",em_atraso:"Em atraso",negociada:"Negociada",parcelada:"Parcelada",quitada:"Quitada"}[d.status]||d.status;
    const statusCls  = {em_aberto:"gray",em_atraso:"red",negociada:"amber",parcelada:"amber",quitada:"green"}[d.status]||"gray";
    const prioCls    = {alta:"red",media:"amber",baixa:"gray"}[d.prioridade]||"gray";
    const origemTag  = d.origem==="conta" ? `<span class="badge gray" style="font-size:10px;">auto</span>` : "";

    const historicoItems = Store.data.historicoDividas
      .filter((h)=>h.dividaId===d.id).slice(-4).reverse()
      .map((h)=>`<div class="hist-item"><span class="hist-dot hist-${h.tipo}"></span><span class="hist-date">${Utils.fmtDateShort(h.data)}</span><span class="hist-desc">${Utils.escapeHtml(h.descricao)}</span>${h.valor?`<span class="hist-val">${Utils.brl(h.valor)}</span>`:""}</div>`).join("");

    const isQuitada = d.status==="quitada";
    return `
      <div class="debt-card debt-${d.status} prio-${d.prioridade}">
        <div class="debt-card-header">
          <div>
            <div class="debt-card-name">${Utils.escapeHtml(d.nome)} ${origemTag}</div>
            ${d.credor?`<div class="debt-card-credor">${Utils.escapeHtml(d.credor)}</div>`:""}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span class="badge ${statusCls}">${statusLabel}</span>
            <span class="badge ${prioCls}">Prioridade ${prioLabel}</span>
          </div>
        </div>

        <div class="debt-card-values">
          <div>
            <div class="debt-val-label">Valor restante</div>
            <div class="debt-val-big ${isQuitada?"pos":"neg"}">${Utils.brl(d.valorRestante)}</div>
          </div>
          ${dias>0&&!isQuitada?`<div><div class="debt-val-label">Venceu há</div><div class="debt-val-big neg">${dias} dia${dias!==1?"s":""}</div></div>`:""}
          <div>
            <div class="debt-val-label">Pago</div>
            <div class="debt-val-big pos">${Utils.brl(d.valorPago||0)}</div>
          </div>
        </div>

        <div class="debt-progress-wrap">
          <div class="progress-track">
            <div class="progress-fill ${isQuitada?"green":pct>70?"green":pct>30?"":""}" style="width:${pct}%;background:${isQuitada?"var(--color-positive)":pct>70?"var(--color-positive)":pct>30?"var(--color-warning)":"var(--color-accent)"}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-top:4px;">
            <span>Pago ${pct.toFixed(0)}%</span><span>Restante ${Utils.brl(d.valorRestante)}</span>
          </div>
        </div>

        ${historicoItems?`<div class="debt-history">${historicoItems}</div>`:""}

        ${!isQuitada?`
        <div class="debt-card-actions">
          <button class="btn btn-sm btn-primary" onclick="Modals.openPagamentoDivida('${d.id}')">💳 Registrar pagamento</button>
          <button class="btn btn-sm btn-secondary" onclick="Modals.openNegociacaoDivida('${d.id}')">🤝 Negociar</button>
          <button class="btn btn-sm btn-secondary" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="Actions.quitarDivida('${d.id}')">✅ Quitar</button>
        </div>`:`
        <div class="debt-card-actions">
          <button class="btn btn-sm btn-ghost" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('dividas','Dividas','${d.id}')">🗑️ Excluir</button>
        </div>`}
      </div>`;
  },

  // ════════════════════ CONTAS FIXAS ═════════════════════
  fixas(main) {
    const mk = App.selectedMonth;
    this.header(main,"Contas Fixas","Recriadas automaticamente todo mês");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Conta Fixa",()=>Modals.openFixa()));
    if (!App.isCurrentMonth()) {
      const bar=document.createElement("div"); bar.className="notice-bar";
      bar.innerHTML=`🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta`;
      main.appendChild(bar);
    }
    const list=Store.monthFixedBills(mk).sort((a,b)=>Number(a.diaVencimento)-Number(b.diaVencimento));
    const mkOpts=()=>{const o=[];for(let d=-3;d<=3;d++){const dt=new Date();dt.setDate(1);dt.setMonth(dt.getMonth()+d);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;o.push(k);}return o;};
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=this.listOrEmpty(list,(f)=>{
      const dias=Utils.daysUntil(Number(f.diaVencimento));
      const badge=f.pago?`<span class="badge green">Pago</span>`:dias<0?`<span class="badge red">Atrasada</span>`:dias<=3?`<span class="badge amber">Em ${dias}d</span>`:`<span class="badge gray">Dia ${f.diaVencimento}</span>`;
      const divVinc=Store.data.dividas.find((dv)=>dv.contaFixaId===f.id&&dv.status!=="quitada");
      const opts=mkOpts().map((k)=>`<option value="${k}" ${k===f.mesReferencia?"selected":""}>${Utils.monthLabel(k)}</option>`).join("");
      return `<div class="list-row" style="flex-wrap:wrap;gap:8px;">
        <div class="row-main" style="min-width:140px;">
          <div class="row-title">${Utils.escapeHtml(f.nome)}${divVinc?` <span class="badge red" style="font-size:10px;">dívida</span>`:""}` +
          `</div><div class="row-sub">${Utils.escapeHtml(f.categoria||"—")} · dia ${f.diaVencimento}${f.pago?" · pago "+Utils.fmtDateShort(f.dataPagamento):""}</div>
        </div>
        ${badge}
        <div class="row-amount neg">${Utils.brl(f.valor)}</div>
        <button class="btn btn-sm ${f.pago?"btn-secondary":"btn-primary"}" onclick="Actions.payFixedBill('${f.id}')">${f.pago?"Desfazer":"✓ Pago"}</button>
        <select class="month-move-select" title="Mover para outro mês" onchange="Actions.moveFixaToMonth('${f.id}',this.value)">${opts}</select>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openFixa('${f.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('contasFixas','ContasFixas','${f.id}')">🗑️</button>
      </div>`;
    },"Nenhuma conta fixa neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ PARCELAMENTOS ════════════════════
  parcelamentosPage(main) {
    const mk=App.selectedMonth;
    this.header(main,"Parcelamentos",`Ativas em ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Novo Parcelamento",()=>Modals.openParcelamento()));
    const ativos=Store.monthParcelamentos(mk);
    const totalMes=ativos.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    if(ativos.length){const r=document.createElement("div");r.className="card";r.style.marginBottom="12px";r.innerHTML=`<h3>Total em ${Utils.monthLabel(mk)}</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(totalMes)}</div>`;main.appendChild(r);}
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(Store.data.parcelamentos,(p)=>{
      const ativo=ativos.some((a)=>a.id===p.id);
      const num=ativo?Store.getInstallmentForMonth(p,mk):null;
      const total=Number(p.qtdTotal)||1;
      const pct=ativo?Math.min(100,(num/total)*100):Math.min(100,(Number(p.parcelaAtual)/total)*100);
      const pago=ativo&&Store.isParcelamentoPago(p.id,mk);
      return `<div class="list-row" style="flex-wrap:wrap;gap:8px;${!ativo?"opacity:0.4;":""}">
        <div class="row-main" style="min-width:160px;">
          <div class="row-title">${Utils.escapeHtml(p.nome)} ${ativo?`<span class="badge ${pago?"green":"gray"}">${pago?"Pago":`${num}/${total}`}</span>`:`<span class="badge gray">Inativo</span>`}</div>
          <div class="row-sub">${ativo?`Parcela <strong>${num}</strong> de ${total} · termina ${Utils.fmtDateFull(p.dataFinal)}`:`Termina ${Utils.fmtDateFull(p.dataFinal)}`}</div>
          <div class="progress-track" style="margin-top:6px;max-width:200px;"><div class="progress-fill ${pago?"green":""}" style="width:${pct}%"></div></div>
        </div>
        <div class="row-amount neg">${Utils.brl(p.valorParcela)}/mês</div>
        ${ativo?`<button class="btn btn-sm ${pago?"btn-secondary":"btn-primary"}" onclick="Actions.toggleParcelamentoPago('${p.id}')">${pago?"Desfazer":"✓ Pago"}</button>`:""}
        <button class="btn btn-sm btn-ghost" onclick="Modals.openParcelamento('${p.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('parcelamentos','Parcelamentos','${p.id}')">🗑️</button>
      </div>`;
    },"Nenhum parcelamento cadastrado.");
    main.appendChild(card);
  },

  // ════════════════════ DESPESAS ═════════════════════════
  despesas(main) {
    const mk=App.selectedMonth;
    this.header(main,"Despesas Variáveis","Adicione um gasto em segundos");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Despesa",()=>Modals.openDespesa()));
    main.appendChild(this.searchAndFilters("despesas"));
    const list=this.applyFilters(Store.monthDespesas(mk)).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(list,(d)=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(d.nome)}</div><div class="row-sub">${Utils.escapeHtml(d.categoria||"—")} · ${Utils.fmtDateFull(d.data)} · ${Utils.escapeHtml(d.formaPagamento||"—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(d.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDespesa('${d.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('despesas','Despesas','${d.id}')">🗑️</button>
      </div>`,"Nenhuma despesa neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ RECEITAS ═════════════════════════
  receitas(main) {
    const mk=App.selectedMonth;
    this.header(main,"Receitas","Salário, freelas, PIX, 13º, bônus...");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Receita",()=>Modals.openReceita()));
    const list=[...Store.monthReceitas(mk)].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(list,(r)=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(r.nome)}</div><div class="row-sub">${Utils.escapeHtml(r.categoria||"—")} · ${Utils.fmtDateFull(r.data)}</div></div>
        <div class="row-amount pos">+${Utils.brl(r.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openReceita('${r.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('receitas','Receitas','${r.id}')">🗑️</button>
      </div>`,"Nenhuma receita neste mês.");
    main.appendChild(card);
  },

  // ════════════════════ METAS ════════════════════════════
  metas(main) {
    this.header(main,"Metas Financeiras");
    main.appendChild(this.actionsBar("+ Nova Meta",()=>Modals.openMeta()));
    const grid=document.createElement("div");grid.className="grid grid-2";
    if(!Store.data.metas.length){grid.innerHTML=`<div class="card">${this.listOrEmpty([],"","Nenhuma meta criada.")}</div>`;}
    Store.data.metas.forEach((m)=>{
      const pct=Math.min(100,((Number(m.valorAtual)||0)/(Number(m.valorAlvo)||1))*100);
      const card=document.createElement("div");card.className="card";
      card.innerHTML=`<h3>${Utils.escapeHtml(m.nome)}</h3>
        <div class="big-number">${Utils.brl(m.valorAtual)} <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(m.valorAlvo)}</span></div>
        <div class="progress-track" style="margin-top:12px;"><div class="progress-fill green" style="width:${pct}%"></div></div>
        <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% concluída${m.dataLimite?" · até "+Utils.fmtDateFull(m.dataLimite):""}</div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openMeta('${m.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('metas','Metas','${m.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ════════════════════ RELATÓRIOS ═══════════════════════
  relatorios(main) {
    const mk=App.selectedMonth;
    this.header(main,"Relatórios",`Visão de ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("⬇ Exportar CSV",()=>Actions.exportCSV(),"btn-secondary"));
    const despMes=Store.monthDespesas(mk),fixasPagas=Store.monthFixedBills(mk).filter((f)=>f.pago);
    const recMes=Store.monthReceitas(mk),parcMes=Store.monthParcelamentos(mk);
    const totalParc=parcMes.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    const stats=Store.dividaStats();
    const row1=document.createElement("div");row1.className="grid grid-2";
    const c1=document.createElement("div");c1.className="card";c1.innerHTML=`<h3>Gastos por categoria</h3><div id="rel-donut"></div>`;row1.appendChild(c1);
    const porPag={};despMes.forEach((d)=>{if(d.formaPagamento)porPag[d.formaPagamento]=(porPag[d.formaPagamento]||0)+Number(d.valor||0);});
    const c2=document.createElement("div");c2.className="card";c2.innerHTML=`<h3>Por forma de pagamento</h3>`+this.listOrEmpty(Object.entries(porPag).map(([k,v])=>({k,v})),({k,v})=>`<div class="list-row"><div class="row-main"><div class="row-title">${Utils.escapeHtml(k)}</div></div><div class="row-amount neg">${Utils.brl(v)}</div></div>`);row1.appendChild(c2);main.appendChild(row1);
    const row2=document.createElement("div");row2.className="grid grid-2";row2.style.marginTop="16px";
    const totalRec=Store.sum(recMes),totalDesp=Store.sum(despMes),totalFix=Store.sum(fixasPagas);
    const saldo=totalRec-totalDesp-totalFix-totalParc;
    const c3=document.createElement("div");c3.className="card";
    c3.innerHTML=`<h3>Fluxo de caixa — ${Utils.monthLabel(mk)}</h3>
      <div class="list-row"><div class="row-main"><div class="row-title">Receitas</div></div><div class="row-amount pos">+${Utils.brl(totalRec)}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title">Despesas variáveis</div></div><div class="row-amount neg">−${Utils.brl(totalDesp)}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title">Contas fixas pagas</div></div><div class="row-amount neg">−${Utils.brl(totalFix)}</div></div>
      <div class="list-row"><div class="row-main"><div class="row-title">Parcelamentos</div></div><div class="row-amount neg">−${Utils.brl(totalParc)}</div></div>
      <div class="list-row" style="border-top:2px solid var(--color-border);margin-top:4px;"><div class="row-main"><div class="row-title" style="font-weight:800;">Saldo</div></div><div class="row-amount ${saldo>=0?"pos":"neg"}" style="font-weight:800;">${Utils.brl(saldo)}</div></div>
      ${stats.totalAberto>0?`<div class="list-row" style="margin-top:8px;"><div class="row-main"><div class="row-title" style="color:var(--color-negative);">🔴 Dívidas em aberto</div></div><div class="row-amount neg">${Utils.brl(stats.totalAberto)}</div></div>`:""}`;
    row2.appendChild(c3);
    const c4=document.createElement("div");c4.className="card";c4.innerHTML=`<h3>Gastos por semana</h3><div id="rel-bars"></div>`;row2.appendChild(c4);main.appendChild(row2);
    const catT={};[...despMes,...fixasPagas,...parcMes.map((p)=>({categoria:"Parcelamento",valor:p.valorParcela}))].forEach((d)=>{const c=d.categoria||"Outros";catT[c]=(catT[c]||0)+Number(d.valor||0);});
    Charts.donut(document.getElementById("rel-donut"),Object.entries(catT).map(([label,value])=>({label,value,color:Utils.categoryColor(label)})));
    Charts.bars(document.getElementById("rel-bars"),[1,2,3,4].map((w)=>({label:`Sem ${w}`,value:Store.sum(despMes.filter((d)=>Math.ceil(parseInt(d.data.slice(8,10),10)/7)===w))})));
  },

  // ════════════════════ CARTÕES ══════════════════════════
  cartoes(main) {
    this.header(main,"Cartões de Crédito");
    main.appendChild(this.actionsBar("+ Novo Cartão",()=>Modals.openCartao()));
    const grid=document.createElement("div");grid.className="grid grid-2";
    if(!Store.data.cartoes.length){grid.innerHTML=`<div class="card">${this.listOrEmpty([],"","Nenhum cartão.")}</div>`;}
    Store.data.cartoes.forEach((c)=>{
      const usado=Number(c.limiteUsado)||0,limite=Number(c.limite)||1,pct=Math.min(100,(usado/limite)*100);
      const card=document.createElement("div");card.className="card";
      card.innerHTML=`<h3>${Utils.escapeHtml(c.nome)}</h3>
        <div class="big-number">${Utils.brl(limite-usado)} <span style="font-size:13px;color:var(--color-text-muted);font-weight:500;"> disponível</span></div>
        <div class="progress-track" style="margin-top:12px;"><div class="progress-fill ${pct>80?"red":""}" style="width:${pct}%"></div></div>
        <div class="row-sub" style="margin-top:8px;">Usado ${Utils.brl(usado)} de ${Utils.brl(limite)}</div>
        <div class="row-sub">Fechamento dia ${c.fechamento} · Vencimento dia ${c.vencimento}</div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-sm btn-secondary" onclick="Modals.openCartao('${c.id}')">Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('cartoes','Cartoes','${c.id}')">Excluir</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ════════════════════ CONFIGURAÇÕES ════════════════════
  config(main) {
    this.header(main,"Configurações");
    const row=document.createElement("div");row.className="grid grid-2";
    const c1=document.createElement("div");c1.className="card";
    c1.innerHTML=`<h3>Metas e tolerância</h3>
      <div class="field" style="margin-top:8px;"><label>Meta de economia mensal (R$)</label><input type="number" id="cfg-meta" value="${Store.data.configuracoes.metaEconomiaMensal||0}"></div>
      <div class="field" style="margin-top:12px;"><label>Dias de tolerância para gerar dívida</label><input type="number" id="cfg-tolerancia" min="1" value="${Store.data.configuracoes.diasToleranciaAtraso||1}"><div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">Padrão: 1 dia após vencimento</div></div>
      <button class="btn btn-primary btn-sm" style="margin-top:12px;" onclick="Actions.saveConfig()">Salvar</button>`;
    row.appendChild(c1);
    const c2=document.createElement("div");c2.className="card";
    c2.innerHTML=`<h3>Categorias</h3><div id="cat-list" class="legend"></div>
      <div class="field-row" style="margin-top:12px;">
        <input id="new-cat" placeholder="Nova categoria">
        <button class="btn btn-secondary btn-sm" onclick="Actions.addCategory()">Adicionar</button>
      </div>`;
    row.appendChild(c2);
    const c3=document.createElement("div");c3.className="card";
    c3.innerHTML=`<h3>Usuários</h3>
      <p class="row-sub">Usuário 1: <strong>${window.APP_CONFIG?.USER_1||"Usuário 1"}</strong></p>
      <p class="row-sub" style="margin-top:6px;">Usuário 2: <strong>${window.APP_CONFIG?.USER_2||"Usuário 2"}</strong></p>
      <p class="row-sub" style="margin-top:12px;">Para alterar, edite <code>js/config.js</code>.</p>`;
    row.appendChild(c3);
    const c4=document.createElement("div");c4.className="card";
    c4.innerHTML=`<h3>Logs de alterações</h3>`+this.listOrEmpty(Store.data.logs.slice(0,8),(l)=>`
      <div class="list-row"><div class="row-main"><div class="row-title">${Utils.escapeHtml(l.aba)}</div><div class="row-sub">${l.usuario} · ${l.data} ${l.hora}</div></div>
      <div class="row-sub">${l.valorAntigo} → ${l.valorNovo}</div></div>`,"Sem logs.");
    row.appendChild(c4);
    main.appendChild(row);
    this.renderCategoryChips();
  },

  renderCategoryChips() {
    const el=document.getElementById("cat-list");if(!el)return;
    el.innerHTML=Store.data.categorias.map((c)=>`<span class="legend-item"><span class="legend-dot" style="background:${Utils.categoryColor(c)}"></span>${Utils.escapeHtml(c)}</span>`).join("");
  },

  searchAndFilters(context) {
    const wrap=document.createElement("div");
    wrap.innerHTML=`<div class="search-bar"><span class="ic">🔎</span><input id="global-search" placeholder="Buscar..." value="${App.filters.busca}"></div><div class="filter-bar" id="cat-filters"></div>`;
    setTimeout(()=>{
      document.getElementById("global-search").oninput=Utils.debounce((e)=>{App.filters.busca=e.target.value;Pages.render(context);},200);
      const fb=document.getElementById("cat-filters");
      fb.innerHTML=["todas",...Store.data.categorias].map((c)=>`<button class="filter-chip ${App.filters.categoria===c?"active":""}" data-cat="${c}">${c==="todas"?"Todas":c}</button>`).join("");
      fb.querySelectorAll(".filter-chip").forEach((chip)=>{chip.onclick=()=>{App.filters.categoria=chip.dataset.cat;Pages.render(context);};});
    },0);
    return wrap;
  },

  applyFilters(list) {
    return list.filter((item)=>{
      const mc=App.filters.categoria==="todas"||item.categoria===App.filters.categoria;
      const ms=!App.filters.busca||(item.nome||"").toLowerCase().includes(App.filters.busca.toLowerCase());
      return mc&&ms;
    });
  },
};
