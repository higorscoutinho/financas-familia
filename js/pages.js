/* =========================================================
   pages.js — Renderização de cada tela
   MUDANÇAS: sem cartoes/relatorios, metas→investimentos,
   dashboard com "Contas do Mês" incluindo investimentos,
   investimentos com aporte mensal integrado
   ========================================================= */

const Pages = {

  render(page){
    const main=document.getElementById("main-content"); main.innerHTML="";
    const map={dashboard:this.dashboard,dividas:this.dividas,fixas:this.fixas,
      parcelamentos:this.parcelamentosPage,despesas:this.despesas,receitas:this.receitas,
      investimentos:this.investimentos,anotacoes:this.anotacoes,config:this.config};
    (map[page]||this.dashboard).call(this,main);
  },

  monthSelector(main){
    const mk=App.selectedMonth, wrap=document.createElement("div");
    wrap.className="month-selector";
    wrap.innerHTML=`
      <button class="ms-arrow" onclick="App.prevMonth()">&#8249;</button>
      <div class="ms-center">
        <span class="ms-label">${Utils.monthLabel(mk)}</span>
        <input class="month-picker-input" type="month" value="${mk}" onchange="App.setMonth(this.value)">
      </div>
      <button class="ms-arrow" onclick="App.nextMonth()">&#8250;</button>`;
    main.appendChild(wrap);
  },

  header(main,title,sub){
    const h=document.createElement("div"); h.className="page-header";
    h.innerHTML=`<div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div>`;
    main.appendChild(h);
  },

  statCard(color,icon,title,value,sub=""){
    return `<div class="card"><div class="stat-icon ${color}">${icon}</div><h3>${title}</h3>
      <div class="big-number">${value}</div>${sub?`<div class="row-sub" style="margin-top:4px;">${sub}</div>`:""}</div>`;
  },

  listOrEmpty(items,fn,msg="Nenhum registro."){
    if(!items?.length)return`<div class="empty-state"><div class="emoji">🗂️</div><p>${msg}</p></div>`;
    return`<div class="list">${items.map(fn).join("")}</div>`;
  },

  actionsBar(label,onClick,cls="btn-primary"){
    const div=document.createElement("div"); div.style.marginBottom="20px";
    const btn=document.createElement("button"); btn.className=`btn ${cls}`; btn.textContent=label; btn.onclick=onClick;
    div.appendChild(btn); return div;
  },

  // ═══════════════════ DASHBOARD ═══════════════════════
  dashboard(main){
    const mk=App.selectedMonth, mkPrev=Utils.prevMonthKey(mk), isNow=App.isCurrentMonth();
    const despMes=Store.monthDespesas(mk), recMes=Store.monthReceitas(mk);
    const fixasMes=Store.monthFixedBills(mk), parcMes=Store.monthParcelamentos(mk);
    const invAtivos=Store.monthInvestimentos();
    const despPrev=Store.monthDespesas(mkPrev);

    const totalRec   =Store.sum(recMes);
    const totalDesp  =Store.sum(despMes);
    const totalFixas =Store.sum(fixasMes);
    const totalParc  =parcMes.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    const totalInv   =invAtivos.reduce((s,i)=>s+Number(i.aportesMensal||0),0);
    // "Contas do mês" = tudo comprometido: fixas + parcelas + despesas + aportes de investimentos
    const contasMes  =totalFixas+totalParc+totalDesp+totalInv;
    const saldo      =totalRec-contasMes;
    const diasMes    =Utils.daysInMonth(mk), diaHoje=isNow?Utils.dayOfMonthToday():diasMes;
    const porDia     =isNow&&saldo>0?saldo/Math.max(1,diasMes-diaHoje+1):0;
    const metaEcon   =Number(Store.data.configuracoes.metaEconomiaMensal)||0;
    const totalPrev  =Store.sum(despPrev);
    const delta      =totalPrev?(((contasMes-totalPrev)/totalPrev)*100).toFixed(0):null;
    const stats      =Store.dividaStats();

    this.header(main,
      isNow?`Olá, ${App.currentUser.split(" ")[0]} 👋`:`📅 ${Utils.monthLabel(mk)}`,
      `Resumo de ${Utils.monthLabel(mk)}${!isNow?" — modo consulta":""}`);
    this.monthSelector(main);

    if(!isNow){
      const bar=document.createElement("div"); bar.className="notice-bar";
      bar.innerHTML=`🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta`; main.appendChild(bar);
    }

    // Alerta de dívidas
    if(stats.ativas.length>0){
      const maior=stats.maior, alertDiv=document.createElement("div"); alertDiv.className="debt-alert-card";
      alertDiv.innerHTML=`<div class="debt-alert-icon">⚠️</div>
        <div class="debt-alert-body">
          <div class="debt-alert-title">${stats.ativas.length} dívida${stats.ativas.length>1?"s":""} em aberto</div>
          <div class="debt-alert-sub">Total: <strong>${Utils.brl(stats.totalAberto)}</strong>${maior?` · Maior: ${maior.nome}`:""}${stats.atraso.length?` · ${stats.atraso.length} em atraso`:""}</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="App.goTo('dividas')">Ver dívidas</button>`;
      main.appendChild(alertDiv);
    }

    // Cards
    const grid=document.createElement("div"); grid.className="grid grid-stats";
    grid.innerHTML=`
      ${this.statCard("blue","💼","Saldo do mês",Utils.brl(saldo))}
      ${this.statCard("green","💰","Receitas",Utils.brl(totalRec))}
      ${this.statCard("amber","📋","Contas do mês",Utils.brl(contasMes),"Fixas + parcelas + despesas + investimentos")}
      ${totalInv>0?this.statCard("green","📈","Investimentos",Utils.brl(totalInv),"Aportes mensais programados"):""}
      ${stats.totalAberto>0?this.statCard("red","🔴","Dívidas em aberto",Utils.brl(stats.totalAberto)):""}
      ${isNow?this.statCard("green","📅","Posso gastar/dia",Utils.brl(porDia)):""}
    `;
    main.appendChild(grid);

    // Comparativo + Meta
    const row2=document.createElement("div"); row2.className="grid grid-2"; row2.style.marginTop="16px";
    const cComp=document.createElement("div"); cComp.className="card";
    cComp.innerHTML=`<h3>Comparativo — mês anterior</h3><div id="chart-comp"></div>
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-text-faint)"></span>${Utils.monthLabel(mkPrev)}</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--color-accent)"></span>${Utils.monthLabel(mk)}</div>
      </div>
      <div class="delta ${delta===null?"":(Number(delta)>0?"down":"up")}" style="margin-top:10px;">
        ${delta===null?"Sem dados anteriores":Number(delta)>0?`▲ ${delta}% a mais`:`▼ ${Math.abs(delta)}% a menos`}
      </div>`;
    row2.appendChild(cComp);
    const pct=metaEcon>0?Math.min(100,(Math.max(0,saldo)/metaEcon)*100):0;
    const cMeta=document.createElement("div"); cMeta.className="card";
    cMeta.innerHTML=`<h3>Meta de economia</h3>
      <div class="big-number">${Utils.brl(Math.max(0,saldo))} <span style="font-size:14px;color:var(--color-text-muted);font-weight:500;">/ ${Utils.brl(metaEcon)}</span></div>
      <div class="progress-track" style="margin-top:12px;"><div class="progress-fill green" style="width:${pct}%"></div></div>
      <div class="row-sub" style="margin-top:8px;">${pct.toFixed(0)}% atingida</div>`;
    row2.appendChild(cMeta);
    main.appendChild(row2);

    // Top gastos + Alertas
    const row3=document.createElement("div"); row3.className="grid grid-2"; row3.style.marginTop="16px";
    const topItems=[...despMes,...fixasMes.filter(f=>f.pago),...parcMes.map(p=>({nome:p.nome,categoria:"Parcelamento",valor:p.valorParcela}))]
      .sort((a,b)=>(Number(b.valor)||0)-(Number(a.valor)||0)).slice(0,5);
    const cTop=document.createElement("div"); cTop.className="card";
    cTop.innerHTML=`<h3>Maiores gastos do mês</h3>`+this.listOrEmpty(topItems,g=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(g.nome)}</div><div class="row-sub">${Utils.escapeHtml(g.categoria||"—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(g.valor)}</div>
      </div>`);
    row3.appendChild(cTop);

    if(isNow){
      const alertas=fixasMes.filter(f=>!f.pago).map(f=>({...f,dias:Utils.daysUntil(Number(f.diaVencimento))})).sort((a,b)=>a.dias-b.dias);
      const cAlert=document.createElement("div"); cAlert.className="card";
      cAlert.innerHTML=`<h3>Alertas de vencimento</h3>`+this.listOrEmpty(alertas,f=>{
        const badge=f.dias<0?`<span class="badge red">Atrasada (${Math.abs(f.dias)}d)</span>`:
          f.dias===0?`<span class="badge red">Hoje</span>`:f.dias===1?`<span class="badge amber">Amanhã</span>`:
          f.dias<=3?`<span class="badge amber">Em ${f.dias}d</span>`:`<span class="badge gray">Em ${f.dias}d</span>`;
        return`<div class="list-row">
          <div class="row-main"><div class="row-title">${Utils.escapeHtml(f.nome)}</div><div class="row-sub">Dia ${f.diaVencimento}</div></div>
          ${badge}<button class="btn btn-sm btn-secondary" style="margin-left:8px" onclick="Actions.payFixedBill('${f.id}')">Pago</button></div>`;
      },"🎉 Tudo pago!");
      row3.appendChild(cAlert);
    }
    main.appendChild(row3);

    const wk=(list,mkRef)=>[0,0,0,0].map((_,w)=>Store.sum(list.filter(d=>Utils.monthKey(d.data)===mkRef&&Math.ceil(parseInt(d.data.slice(8,10),10)/7)===w+1)));
    Charts.comparativeLine(document.getElementById("chart-comp"),wk(Store.data.despesas,mkPrev),wk(Store.data.despesas,mk),["S1","S2","S3","S4"]);
  },

  // ═══════════════════ INVESTIMENTOS ═══════════════════
  investimentos(main){
    this.header(main,"Investimentos","Reservas, metas de poupança e patrimônio");
    main.appendChild(this.actionsBar("+ Novo Investimento",()=>Modals.openInvestimento()));

    const invs=Store.data.investimentos;
    const totalGuardado=invs.reduce((s,i)=>s+Number(i.valorAtual||0),0);
    const totalMeta=invs.reduce((s,i)=>s+Number(i.valorAlvo||0),0);
    const totalAportes=Store.monthInvestimentos().reduce((s,i)=>s+Number(i.aportesMensal||0),0);

    if(invs.length){
      const resumo=document.createElement("div"); resumo.className="grid grid-stats"; resumo.style.marginBottom="20px";
      resumo.innerHTML=`
        ${this.statCard("green","📈","Total guardado",Utils.brl(totalGuardado))}
        ${this.statCard("blue","🎯","Total das metas",Utils.brl(totalMeta))}
        ${totalAportes>0?this.statCard("amber","💰","Aportes este mês",Utils.brl(totalAportes),"Comprometido no dashboard"):""}
      `;
      main.appendChild(resumo);
    }

    if(!invs.length){
      const card=document.createElement("div"); card.className="card";
      card.innerHTML=`<div class="empty-state"><div class="emoji">📈</div><p>Nenhum investimento cadastrado ainda.<br>Crie sua reserva de emergência, fundo de viagem ou qualquer meta de poupança.</p></div>`;
      main.appendChild(card); return;
    }

    const grid=document.createElement("div"); grid.className="grid grid-2";
    invs.forEach(inv=>{
      const pct=Math.min(100,((Number(inv.valorAtual)||0)/(Number(inv.valorAlvo)||1))*100);
      const falta=Math.max(0,Number(inv.valorAlvo)-Number(inv.valorAtual||0));
      const card=document.createElement("div"); card.className="card";
      card.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div>
            <h3 style="margin-bottom:4px;">${Utils.escapeHtml(inv.nome)}</h3>
            ${inv.descricao?`<div class="row-sub">${Utils.escapeHtml(inv.descricao)}</div>`:""}
          </div>
          ${Number(inv.aportesMensal||0)>0?`<span class="badge green">+${Utils.brl(inv.aportesMensal)}/mês</span>`:""}
        </div>
        <div style="margin:12px 0;">
          <div class="big-number" style="color:var(--color-positive);">${Utils.brl(inv.valorAtual||0)}</div>
          <div class="row-sub">de ${Utils.brl(inv.valorAlvo)} · faltam ${Utils.brl(falta)}</div>
        </div>
        <div class="progress-track"><div class="progress-fill green" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-top:4px;">
          <span>${pct.toFixed(0)}% concluído</span>
          ${inv.dataLimite?`<span>até ${Utils.fmtDateFull(inv.dataLimite)}</span>`:""}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
          <button class="btn btn-sm btn-primary" onclick="Modals.openAporteInvestimento('${inv.id}')">+ Registrar aporte</button>
          <button class="btn btn-sm btn-secondary" onclick="Modals.openInvestimento('${inv.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('investimentos','Investimentos','${inv.id}')">🗑️</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ═══════════════════ DÍVIDAS ═════════════════════════
  dividas(main){
    const stats=Store.dividaStats();
    this.header(main,"Dívidas","Controle do seu passivo financeiro");
    main.appendChild(this.actionsBar("+ Nova Dívida",()=>Modals.openDivida(),"btn-danger"));

    const resumo=document.createElement("div"); resumo.className="grid grid-stats";
    resumo.innerHTML=`
      <div class="card"><div class="stat-icon red">🔴</div><h3>Total em aberto</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAberto)}</div></div>
      <div class="card"><div class="stat-icon red">⚠️</div><h3>Em atraso</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAtraso)}</div><div class="row-sub">${stats.atraso.length} dívida${stats.atraso.length!==1?"s":""}</div></div>
      <div class="card"><div class="stat-icon amber">🤝</div><h3>Negociadas</h3><div class="big-number" style="color:var(--color-warning);">${Utils.brl(stats.totalNegoc)}</div></div>
      <div class="card"><div class="stat-icon green">✅</div><h3>Total quitado</h3><div class="big-number" style="color:var(--color-positive);">${Utils.brl(stats.totalQuitado)}</div></div>
      ${stats.maior?`<div class="card"><div class="stat-icon red">📊</div><h3>Maior dívida</h3><div class="big-number" style="font-size:18px;">${Utils.escapeHtml(stats.maior.nome)}</div><div class="row-sub">${Utils.brl(stats.maior.valorRestante)}</div></div>`:""}`;
    main.appendChild(resumo);

    // Meta de quitar tudo
    const totalOrig=Store.data.dividas.reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    const totalQuit=Store.data.dividas.filter(d=>d.status==="quitada").reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    if(totalOrig>0){
      const p=Math.min(100,(totalQuit/totalOrig)*100);
      const cM=document.createElement("div"); cM.className="card"; cM.style.marginTop="16px";
      cM.innerHTML=`<h3>🎯 Meta: ficar sem dívidas</h3>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
          <div class="big-number" style="color:var(--color-positive);">${Utils.brl(totalQuit)}</div>
          <span style="color:var(--color-text-muted);font-size:14px;">de ${Utils.brl(totalOrig)}</span>
        </div>
        <div class="progress-track"><div class="progress-fill green" style="width:${p}%"></div></div>
        <div class="row-sub" style="margin-top:6px;">${p.toFixed(0)}% · faltam ${Utils.brl(totalOrig-totalQuit)}</div>`;
      main.appendChild(cM);
    }

    const statusFiltros=[{v:"todas",l:"Todas"},{v:"em_atraso",l:"Em atraso"},{v:"em_aberto",l:"Em aberto"},{v:"negociada",l:"Negociadas"},{v:"parcelada",l:"Parceladas"},{v:"quitada",l:"Quitadas"}];
    const fb=document.createElement("div"); fb.className="filter-bar"; fb.style.marginTop="20px";
    fb.innerHTML=statusFiltros.map(f=>`<button class="filter-chip ${f.v==="todas"?"active":""}" data-status="${f.v}">${f.l}</button>`).join("");
    main.appendChild(fb);

    const lw=document.createElement("div"); lw.id="dividas-list"; main.appendChild(lw);
    const renderLista=filtro=>{
      const lista=filtro==="todas"?Store.data.dividas:Store.data.dividas.filter(d=>d.status===filtro);
      const ord={em_atraso:0,em_aberto:1,negociada:2,parcelada:3,quitada:4};
      const sorted=[...lista].sort((a,b)=>(ord[a.status]??5)-(ord[b.status]??5));
      lw.innerHTML=sorted.length===0
        ?`<div class="card"><div class="empty-state"><div class="emoji">🎉</div><p>Nenhuma dívida aqui!</p></div></div>`
        :sorted.map(d=>this.debtCard(d)).join("");
    };
    fb.querySelectorAll(".filter-chip").forEach(chip=>{
      chip.onclick=()=>{fb.querySelectorAll(".filter-chip").forEach(c=>c.classList.remove("active"));chip.classList.add("active");renderLista(chip.dataset.status);};
    });
    renderLista("todas");
  },

  debtCard(d){
    const pct=d.valorAtual>0?Math.min(100,((Number(d.valorPago)||0)/Number(d.valorAtual))*100):0;
    const dias=Store.diasAtraso(d);
    const sLabel={em_aberto:"Em aberto",em_atraso:"Em atraso",negociada:"Negociada",parcelada:"Parcelada",quitada:"Quitada"}[d.status]||d.status;
    const sCls={em_aberto:"gray",em_atraso:"red",negociada:"amber",parcelada:"amber",quitada:"green"}[d.status]||"gray";
    const pCls={alta:"red",media:"amber",baixa:"gray"}[d.prioridade]||"gray";
    const pLabel={alta:"Alta",media:"Média",baixa:"Baixa"}[d.prioridade]||"Baixa";
    const isQ=d.status==="quitada";
    const hist=Store.data.historicoDividas.filter(h=>h.dividaId===d.id).slice(-3).reverse()
      .map(h=>`<div class="hist-item"><span class="hist-dot hist-${h.tipo}"></span><span class="hist-date">${Utils.fmtDateShort(h.data)}</span><span class="hist-desc">${Utils.escapeHtml(h.descricao)}</span>${h.valor?`<span class="hist-val">${Utils.brl(h.valor)}</span>`:""}</div>`).join("");
    return`<div class="debt-card debt-${d.status} prio-${d.prioridade}">
      <div class="debt-card-header">
        <div>
          <div class="debt-card-name">${Utils.escapeHtml(d.nome)}${d.origem==="conta"?` <span class="badge gray" style="font-size:10px;">auto</span>`:""}</div>
          ${d.credor?`<div class="debt-card-credor">${Utils.escapeHtml(d.credor)}</div>`:""}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge ${sCls}">${sLabel}</span>
          <span class="badge ${pCls}">Prioridade ${pLabel}</span>
        </div>
      </div>
      <div class="debt-card-values">
        <div><div class="debt-val-label">Valor restante</div><div class="debt-val-big ${isQ?"pos":"neg"}">${Utils.brl(d.valorRestante)}</div></div>
        ${dias>0&&!isQ?`<div><div class="debt-val-label">Venceu há</div><div class="debt-val-big neg">${dias} dia${dias!==1?"s":""}</div></div>`:""}
        <div><div class="debt-val-label">Pago</div><div class="debt-val-big pos">${Utils.brl(d.valorPago||0)}</div></div>
      </div>
      <div class="debt-progress-wrap">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${isQ?"var(--color-positive)":pct>70?"var(--color-positive)":pct>30?"var(--color-warning)":"var(--color-accent)"}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-top:4px;"><span>Pago ${pct.toFixed(0)}%</span><span>Restante ${Utils.brl(d.valorRestante)}</span></div>
      </div>
      ${hist?`<div class="debt-history">${hist}</div>`:""}
      ${!isQ?`<div class="debt-card-actions">
        <button class="btn btn-sm btn-primary" onclick="Modals.openPagamentoDivida('${d.id}')">💳 Pagamento</button>
        <button class="btn btn-sm btn-secondary" onclick="Modals.openNegociacaoDivida('${d.id}')">🤝 Negociar</button>
        <button class="btn btn-sm btn-secondary" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="Actions.quitarDivida('${d.id}')">✅ Quitar</button>
      </div>`:`<div class="debt-card-actions">
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('dividas','Dividas','${d.id}')">🗑️ Excluir</button>
      </div>`}
    </div>`;
  },

  // ═══════════════════ CONTAS FIXAS ════════════════════
  fixas(main){
    const mk=App.selectedMonth;
    this.header(main,"Contas Fixas",`${Utils.monthLabel(mk)} — adicione manualmente`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Conta Fixa",()=>Modals.openFixa()));
    if(!App.isCurrentMonth()){const bar=document.createElement("div");bar.className="notice-bar";bar.innerHTML=`🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong>`;main.appendChild(bar);}
    const list=Store.monthFixedBills(mk).sort((a,b)=>Number(a.diaVencimento)-Number(b.diaVencimento));
    const mkOpts=()=>{const o=[];for(let d=-3;d<=3;d++){const dt=new Date();dt.setDate(1);dt.setMonth(dt.getMonth()+d);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;o.push(k);}return o;};
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=this.listOrEmpty(list,f=>{
      const dias=Utils.daysUntil(Number(f.diaVencimento));
      const badge=f.pago?`<span class="badge green">Pago</span>`:dias<0?`<span class="badge red">Atrasada</span>`:dias<=3?`<span class="badge amber">Em ${dias}d</span>`:`<span class="badge gray">Dia ${f.diaVencimento}</span>`;
      const dv=Store.data.dividas.find(x=>x.contaFixaId===f.id&&x.status!=="quitada");
      const opts=mkOpts().map(k=>`<option value="${k}" ${k===f.mesReferencia?"selected":""}>${Utils.monthLabel(k)}</option>`).join("");
      return`<div class="list-row" style="flex-wrap:wrap;gap:8px;">
        <div class="row-main" style="min-width:140px;">
          <div class="row-title">${Utils.escapeHtml(f.nome)}${dv?` <span class="badge red" style="font-size:10px;">dívida</span>`:""}</div>
          <div class="row-sub">${Utils.escapeHtml(f.categoria||"—")} · dia ${f.diaVencimento}${f.pago?" · pago "+Utils.fmtDateShort(f.dataPagamento):""}</div>
        </div>
        ${badge}
        <div class="row-amount neg">${Utils.brl(f.valor)}</div>
        <button class="btn btn-sm ${f.pago?"btn-secondary":"btn-primary"}" onclick="Actions.payFixedBill('${f.id}')">${f.pago?"Desfazer":"✓ Pago"}</button>
        <select class="month-move-select" title="Mover para outro mês" onchange="Actions.moveFixaToMonth('${f.id}',this.value)">${opts}</select>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openFixa('${f.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('contasFixas','ContasFixas','${f.id}')">🗑️</button>
      </div>`;
    },"Nenhuma conta fixa adicionada para este mês.");
    main.appendChild(card);
  },

  // ═══════════════════ PARCELAMENTOS ═══════════════════
  parcelamentosPage(main){
    const mk=App.selectedMonth;
    this.header(main,"Parcelamentos",`Ativas em ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Novo Parcelamento",()=>Modals.openParcelamento()));
    const ativos=Store.monthParcelamentos(mk);
    const totalMes=ativos.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    if(ativos.length){const r=document.createElement("div");r.className="card";r.style.marginBottom="12px";r.innerHTML=`<h3>Total em ${Utils.monthLabel(mk)}</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(totalMes)}</div>`;main.appendChild(r);}
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=this.listOrEmpty(Store.data.parcelamentos,p=>{
      const ativo=ativos.some(a=>a.id===p.id);
      const num=ativo?Store.getInstallmentForMonth(p,mk):null;
      const total=Number(p.qtdTotal)||1;
      const pct=ativo?Math.min(100,(num/total)*100):Math.min(100,(Number(p.parcelaAtual)/total)*100);
      const pago=ativo&&Store.isParcelamentoPago(p.id,mk);
      return`<div class="list-row" style="flex-wrap:wrap;gap:8px;${!ativo?"opacity:0.4;":""}">
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

  // ═══════════════════ DESPESAS ════════════════════════
  despesas(main){
    const mk=App.selectedMonth;
    this.header(main,"Despesas Variáveis");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Despesa",()=>Modals.openDespesa()));
    main.appendChild(this.searchAndFilters("despesas"));
    const list=this.applyFilters(Store.monthDespesas(mk)).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=this.listOrEmpty(list,d=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(d.nome)}</div><div class="row-sub">${Utils.escapeHtml(d.categoria||"—")} · ${Utils.fmtDateFull(d.data)} · ${Utils.escapeHtml(d.formaPagamento||"—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(d.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDespesa('${d.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('despesas','Despesas','${d.id}')">🗑️</button>
      </div>`,"Nenhuma despesa neste mês.");
    main.appendChild(card);
  },

  // ═══════════════════ RECEITAS ════════════════════════
  receitas(main){
    const mk=App.selectedMonth;
    this.header(main,"Receitas");
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Receita",()=>Modals.openReceita()));
    const list=[...Store.monthReceitas(mk)].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=this.listOrEmpty(list,r=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(r.nome)}</div><div class="row-sub">${Utils.escapeHtml(r.categoria||"—")} · ${Utils.fmtDateFull(r.data)}</div></div>
        <div class="row-amount pos">+${Utils.brl(r.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openReceita('${r.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('receitas','Receitas','${r.id}')">🗑️</button>
      </div>`,"Nenhuma receita neste mês.");
    main.appendChild(card);
  },

  // ═══════════════════ ANOTAÇÕES ═══════════════════════
  anotacoes(main){
    this.header(main,"Anotações","Notas rápidas e lembretes");
    main.appendChild(this.actionsBar("+ Nova nota",()=>Modals.openNota()));
    const grid=document.createElement("div"); grid.className="notas-grid";
    const notas=[...Store.data.notas].sort((a,b)=>(b.atualizadoEm||"").localeCompare(a.atualizadoEm||""));
    if(!notas.length){
      grid.innerHTML=`<div style="grid-column:1/-1;"><div class="empty-state"><div class="emoji">📝</div><p>Nenhuma nota ainda. Crie a sua primeira!</p></div></div>`;
    } else {
      notas.forEach(n=>{
        const card=document.createElement("div"); card.className="nota-card"; card.style.background=n.cor||"#FFF9C4";
        card.innerHTML=`
          <div class="nota-header"><div class="nota-titulo">${Utils.escapeHtml(n.titulo||"Sem título")}</div>
            <div class="nota-actions">
              <button class="nota-btn" onclick="Modals.openNota('${n.id}')">✏️</button>
              <button class="nota-btn" onclick="Actions.removeNota('${n.id}')">🗑️</button>
            </div>
          </div>
          <div class="nota-body">${Utils.escapeHtml(n.conteudo||"")}</div>
          <div class="nota-date">${Utils.fmtDateFull(n.atualizadoEm)}</div>`;
        grid.appendChild(card);
      });
    }
    main.appendChild(grid);
  },

  // ═══════════════════ CONFIGURAÇÕES ═══════════════════
  config(main){
    this.header(main,"Configurações");
    const row=document.createElement("div"); row.className="grid grid-2";

    const c1=document.createElement("div"); c1.className="card";
    c1.innerHTML=`<h3>Sistema</h3>
      <div class="field" style="margin-top:8px;"><label>Meta de economia mensal (R$)</label><input type="number" id="cfg-meta" value="${Store.data.configuracoes.metaEconomiaMensal||0}"></div>
      <div class="field" style="margin-top:12px;">
        <label>Mês de início do sistema</label>
        <input type="month" id="cfg-inicio" value="${Store.data.configuracoes.dataInicioSistema||"2026-08"}">
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">Contas antes desta data não geram dívidas automáticas</div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="Actions.saveConfig()">Salvar</button>`;
    row.appendChild(c1);

    const c2=document.createElement("div"); c2.className="card";
    c2.innerHTML=`<h3>Limpeza de dados</h3>
      <p class="row-sub" style="margin-bottom:16px;">Use para corrigir dados gerados automaticamente antes de começar o uso real do sistema.</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn btn-danger btn-sm" onclick="Actions.limparDividasAutomaticas()">🗑️ Remover dívidas automáticas de contas fixas</button>
        <button class="btn btn-secondary btn-sm" onclick="Actions.limparFixasAntigas()">🗑️ Remover contas fixas de meses anteriores</button>
        <button class="btn btn-secondary btn-sm" onclick="Actions.exportCSV()">⬇ Exportar CSV do mês</button>
      </div>`;
    row.appendChild(c2);

    const c3=document.createElement("div"); c3.className="card";
    c3.innerHTML=`<h3>Categorias</h3><div id="cat-list" class="legend"></div>
      <div class="field-row" style="margin-top:12px;">
        <input id="new-cat" placeholder="Nova categoria">
        <button class="btn btn-secondary btn-sm" onclick="Actions.addCategory()">Adicionar</button>
      </div>`;
    row.appendChild(c3);

    const c4=document.createElement("div"); c4.className="card";
    c4.innerHTML=`<h3>Usuários</h3>
      <p class="row-sub">Usuário 1: <strong>${window.APP_CONFIG?.USER_1||"Usuário 1"}</strong></p>
      <p class="row-sub" style="margin-top:6px;">Usuário 2: <strong>${window.APP_CONFIG?.USER_2||"Usuário 2"}</strong></p>
      <p class="row-sub" style="margin-top:12px;">Para alterar nomes, edite <code>js/config.js</code>.<br>Para redefinir códigos de acesso, use o link na tela de login.</p>`;
    row.appendChild(c4);

    main.appendChild(row);
    this.renderCategoryChips();
  },

  renderCategoryChips(){
    const el=document.getElementById("cat-list"); if(!el)return;
    el.innerHTML=Store.data.categorias.map(c=>`<span class="legend-item"><span class="legend-dot" style="background:${Utils.categoryColor(c)}"></span>${Utils.escapeHtml(c)}</span>`).join("");
  },

  searchAndFilters(ctx){
    const wrap=document.createElement("div");
    wrap.innerHTML=`<div class="search-bar"><span class="ic">🔎</span><input id="global-search" placeholder="Buscar..." value="${App.filters.busca}"></div><div class="filter-bar" id="cat-filters"></div>`;
    setTimeout(()=>{
      document.getElementById("global-search").oninput=Utils.debounce(e=>{App.filters.busca=e.target.value;Pages.render(ctx);},200);
      const fb=document.getElementById("cat-filters");
      fb.innerHTML=["todas",...Store.data.categorias].map(c=>`<button class="filter-chip ${App.filters.categoria===c?"active":""}" data-cat="${c}">${c==="todas"?"Todas":c}</button>`).join("");
      fb.querySelectorAll(".filter-chip").forEach(chip=>{chip.onclick=()=>{App.filters.categoria=chip.dataset.cat;Pages.render(ctx);};});
    },0);
    return wrap;
  },

  applyFilters(list){
    return list.filter(item=>{
      const mc=App.filters.categoria==="todas"||item.categoria===App.filters.categoria;
      const ms=!App.filters.busca||(item.nome||"").toLowerCase().includes(App.filters.busca.toLowerCase());
      return mc&&ms;
    });
  },
};
