const Pages={
  render(page){
    const main=document.getElementById("main-content");main.innerHTML="";
    const map={
      dashboard:this.dashboard,despesas:this.despesas,fixas:this.fixas,
      parcelamentos:this.parcelamentosPage,investimentos:this.investimentos,
      receitas:this.receitas,dividas:this.dividas,anotacoes:this.anotacoes,config:this.config,
    };
    (map[page]||this.dashboard).call(this,main);
  },

  monthSelector(main){
    const mk=App.selectedMonth,wrap=document.createElement("div");
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
    const h=document.createElement("div");h.className="page-header";
    h.innerHTML=`<div><h1>${title}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div>`;
    main.appendChild(h);
  },

  statCard(color,icon,title,value,sub){
    return`<div class="card"><div class="stat-icon ${color}">${icon}</div><h3>${title}</h3>
      <div class="big-number">${value}</div>${sub?`<div class="row-sub" style="margin-top:4px;">${sub}</div>`:""}</div>`;
  },

  listOrEmpty(items,fn,msg="Nenhum registro."){
    if(!items?.length)return`<div class="empty-state"><div class="emoji">🗂️</div><p>${msg}</p></div>`;
    return`<div class="list">${items.map(fn).join("")}</div>`;
  },

  actionsBar(label,onClick,cls="btn-primary"){
    const div=document.createElement("div");div.style.marginBottom="20px";
    const btn=document.createElement("button");btn.className=`btn ${cls}`;btn.textContent=label;btn.onclick=onClick;
    div.appendChild(btn);return div;
  },

  // ═══ DASHBOARD ══════════════════════════════════════════════
  // Removidos: comparativo com mês anterior, meta de economia
  // Novo: "Falta pagar este mês" (fixas + parcelas em aberto)
  dashboard(main){
    const mk=App.selectedMonth,isNow=App.isCurrentMonth();
    const despMes=Store.monthDespesas(mk),recMes=Store.monthReceitas(mk);
    const fixasMes=Store.monthFixedBills(mk),parcMes=Store.monthParcelamentos(mk);
    const invAtivos=Store.monthInvestimentos();

    const totalRec=Store.sum(recMes);
    const totalDesp=Store.sum(despMes);
    const totalFixas=Store.sum(fixasMes);
    const totalParc=parcMes.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    const totalInv=invAtivos.reduce((s,i)=>s+Number(i.aportesMensal||0),0);
    const contasMes=totalFixas+totalParc+totalDesp+totalInv;
    const saldo=totalRec-contasMes;

    // Falta pagar: fixas não pagas + parcelas não marcadas do mês
    const fixasAbertas=fixasMes.filter(f=>!f.pago);
    const faltaFixas=Store.sum(fixasAbertas);
    const faltaParc=parcMes.filter(p=>!Store.isParcelamentoPago(p.id,mk))
      .reduce((s,p)=>s+Number(p.valorParcela||0),0);
    const faltaPagar=faltaFixas+faltaParc;

    this.header(main,
      isNow?`Olá, ${App.currentUser.split(" ")[0]} 👋`:`📅 ${Utils.monthLabel(mk)}`,
      `Resumo de ${Utils.monthLabel(mk)}${!isNow?" — modo consulta":""}`);
    this.monthSelector(main);

    if(!isNow){
      const bar=document.createElement("div");bar.className="notice-bar";
      bar.innerHTML=`🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong> — modo consulta`;
      main.appendChild(bar);
    }

    const grid=document.createElement("div");grid.className="grid grid-stats";
    grid.innerHTML=`
      ${this.statCard("blue","💼","Saldo do mês",Utils.brl(saldo))}
      ${this.statCard("green","💰","Receitas",Utils.brl(totalRec))}
      ${this.statCard("amber","📋","Contas do mês",Utils.brl(contasMes),"Fixas + parcelas + despesas")}
      ${this.statCard("red","⏳","Falta pagar este mês",Utils.brl(faltaPagar),"Fixas e parcelas em aberto")}
      ${totalInv>0?this.statCard("green","📈","Investimentos",Utils.brl(totalInv),"Aportes mensais programados"):""}
    `;
    main.appendChild(grid);

    // Top gastos + Contas em aberto (sem botão "Pago")
    const row=document.createElement("div");row.className="grid grid-2";row.style.marginTop="16px";

    const topItems=[...despMes,...fixasMes.filter(f=>f.pago),...parcMes.map(p=>({nome:p.nome,categoria:"Parcelamento",valor:p.valorParcela}))]
      .sort((a,b)=>(Number(b.valor)||0)-(Number(a.valor)||0)).slice(0,5);
    const cTop=document.createElement("div");cTop.className="card";
    cTop.innerHTML=`<h3>Maiores gastos do mês</h3>`+this.listOrEmpty(topItems,g=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(g.nome)}</div><div class="row-sub">${Utils.escapeHtml(g.categoria||"—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(g.valor)}</div>
      </div>`);
    row.appendChild(cTop);

    // Contas em aberto — apenas lista, SEM botão Pago (paga na aba Contas Fixas)
    if(isNow){
      const cAlert=document.createElement("div");cAlert.className="card";
      cAlert.innerHTML=`<h3>Contas em aberto este mês</h3>`+this.listOrEmpty(
        fixasAbertas.map(f=>({...f,dias:Utils.daysUntilInMonth(Number(f.diaVencimento),f.mesReferencia)}))
          .sort((a,b)=>a.dias-b.dias),
        f=>{
          const badge=f.dias<0?`<span class="badge red">Atrasada (${Math.abs(f.dias)}d)</span>`:
            f.dias===0?`<span class="badge red">Vence hoje</span>`:
            f.dias===1?`<span class="badge amber">Amanhã</span>`:
            f.dias<=3?`<span class="badge amber">Em ${f.dias}d</span>`:`<span class="badge gray">Em ${f.dias}d</span>`;
          const isInv=!!f.investimentoId;
          return`<div class="list-row">
            <div class="row-main">
              <div class="row-title">${Utils.escapeHtml(f.nome)}${isInv?` <span class="badge green" style="font-size:10px;">Investimento</span>`:""}</div>
              <div class="row-sub">Dia ${f.diaVencimento} · ${Utils.brl(f.valor)}</div>
            </div>
            ${badge}
          </div>`;
        },
        "🎉 Tudo pago neste mês!"
      );
      row.appendChild(cAlert);
    }
    main.appendChild(row);
  },

  // ═══ DESPESAS ══════════════════════════════════════════════
  despesas(main){
    const mk=App.selectedMonth;
    this.header(main,"Despesas Variáveis");this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Despesa",()=>Modals.openDespesa()));
    main.appendChild(this.searchAndFilters("despesas"));
    const list=this.applyFilters(Store.monthDespesas(mk)).sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(list,d=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(d.nome)}</div><div class="row-sub">${Utils.escapeHtml(d.categoria||"—")} · ${Utils.fmtDateFull(d.data)} · ${Utils.escapeHtml(d.formaPagamento||"—")}</div></div>
        <div class="row-amount neg">−${Utils.brl(d.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDespesa('${d.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('despesas','Despesas','${d.id}')">🗑️</button>
      </div>`,"Nenhuma despesa neste mês.");
    main.appendChild(card);
  },

  // ═══ CONTAS FIXAS ══════════════════════════════════════════
  // Bug corrigido: usa daysUntilInMonth para calcular dias corretamente por mês
  fixas(main){
    const mk=App.selectedMonth;
    this.header(main,"Contas Fixas",`${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Conta Fixa",()=>Modals.openFixa()));
    if(!App.isCurrentMonth()){
      const bar=document.createElement("div");bar.className="notice-bar";
      bar.innerHTML=`🔍 Visualizando <strong>${Utils.monthLabel(mk)}</strong>`;main.appendChild(bar);
    }
    const list=Store.monthFixedBills(mk).sort((a,b)=>Number(a.diaVencimento)-Number(b.diaVencimento));
    const mkOpts=()=>{const o=[];for(let d=-3;d<=3;d++){const dt=new Date();dt.setDate(1);dt.setMonth(dt.getMonth()+d);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;o.push(k);}return o;};
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(list,f=>{
      // CORREÇÃO: usa daysUntilInMonth com o mesReferencia da conta
      const dias=Utils.daysUntilInMonth(Number(f.diaVencimento),f.mesReferencia);
      const badge=f.pago?`<span class="badge green">Pago</span>`:
        dias<0?`<span class="badge red">Atrasada</span>`:
        dias===0?`<span class="badge red">Vence hoje</span>`:
        dias<=3?`<span class="badge amber">Em ${dias}d</span>`:`<span class="badge gray">Dia ${f.diaVencimento}</span>`;
      const isInv=!!f.investimentoId;
      const opts=mkOpts().map(k=>`<option value="${k}" ${k===Store._normMk(f.mesReferencia)?"selected":""}>${Utils.monthLabel(k)}</option>`).join("");
      return`<div class="list-row" style="flex-wrap:wrap;gap:8px;">
        <div class="row-main" style="min-width:140px;">
          <div class="row-title">${Utils.escapeHtml(f.nome)}${isInv?` <span class="badge green" style="font-size:10px;">Investimento</span>`:""}</div>
          <div class="row-sub">${Utils.escapeHtml(f.categoria||"—")} · dia ${f.diaVencimento}${f.pago?" · pago "+Utils.fmtDateShort(f.dataPagamento):""}</div>
        </div>
        ${badge}
        <div class="row-amount neg">${Utils.brl(f.valor)}</div>
        <button class="btn btn-sm ${f.pago?"btn-secondary":"btn-primary"}" onclick="Actions.payFixedBill('${f.id}')">${f.pago?"Desfazer":"✓ Pago"}</button>
        ${!isInv?`
          <select class="month-move-select" title="Mover para outro mês" onchange="Actions.moveFixaToMonth('${f.id}',this.value)">${opts}</select>
          <button class="btn btn-sm btn-ghost" onclick="Modals.openFixa('${f.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.excluirContaFixa('${f.id}')">🗑️</button>
        `:`<button class="btn btn-sm btn-ghost" onclick="Modals.openInvestimento('${f.investimentoId}')">⚙️</button>`}
      </div>`;
    },"Nenhuma conta fixa neste mês.");
    main.appendChild(card);
  },

  // ═══ PARCELAMENTOS ══════════════════════════════════════════
  // Novo: badge de "Atrasado" baseado em diaVencimento
  parcelamentosPage(main){
    const mk=App.selectedMonth;
    this.header(main,"Parcelamentos",`Ativas em ${Utils.monthLabel(mk)}`);
    this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Novo Parcelamento",()=>Modals.openParcelamento()));
    const ativos=Store.monthParcelamentos(mk);
    const totalMes=ativos.reduce((s,p)=>s+Number(p.valorParcela||0),0);
    if(ativos.length){
      const r=document.createElement("div");r.className="card";r.style.marginBottom="12px";
      r.innerHTML=`<h3>Total em ${Utils.monthLabel(mk)}</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(totalMes)}</div>`;
      main.appendChild(r);
    }
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(Store.data.parcelamentos,p=>{
      const ativo=ativos.some(a=>a.id===p.id);
      const num=ativo?Store.getInstallmentForMonth(p,mk):null;
      const total=Number(p.qtdTotal)||1;
      const pct=ativo?Math.min(100,(num/total)*100):Math.min(100,(Number(p.parcelaAtual)/total)*100);
      const pago=ativo&&Store.isParcelamentoPago(p.id,mk);

      // Badge com diaVencimento do parcelamento
      let badge=`<span class="badge gray">Inativo</span>`;
      if(ativo){
        if(pago){
          badge=`<span class="badge green">Pago</span>`;
        } else {
          const diaVenc=Number(p.diaVencimento||10);
          const diasParc=Utils.daysUntilInMonth(diaVenc,mk);
          badge=diasParc<0?`<span class="badge red">Atrasado (${Math.abs(diasParc)}d)</span>`:
            diasParc===0?`<span class="badge red">Vence hoje</span>`:
            diasParc<=3?`<span class="badge amber">Em ${diasParc}d</span>`:
            `<span class="badge gray">${num}/${total}</span>`;
        }
      }

      return`<div class="list-row" style="flex-wrap:wrap;gap:8px;${!ativo?"opacity:0.4;":""}">
        <div class="row-main" style="min-width:160px;">
          <div class="row-title">${Utils.escapeHtml(p.nome)} ${badge}</div>
          <div class="row-sub">${ativo?`Parcela <strong>${num}</strong> de ${total} · termina ${Utils.fmtDateFull(p.dataFinal)}${p.diaVencimento?` · vence dia ${p.diaVencimento}`:""}`:`Termina ${Utils.fmtDateFull(p.dataFinal)}`}</div>
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

  // ═══ INVESTIMENTOS ══════════════════════════════════════════
  // Mostra status do aporte do mês atual
  investimentos(main){
    const mk=App.selectedMonth;
    this.header(main,"Investimentos","Reservas, metas de poupança e patrimônio");
    main.appendChild(this.actionsBar("+ Novo Investimento",()=>Modals.openInvestimento()));
    const invs=Store.data.investimentos;
    const totalGuardado=invs.reduce((s,i)=>s+Number(i.valorAtual||0),0);
    const totalMeta=invs.reduce((s,i)=>s+Number(i.valorAlvo||0),0);
    const totalAportes=Store.monthInvestimentos().reduce((s,i)=>s+Number(i.aportesMensal||0),0);
    if(invs.length){
      const r=document.createElement("div");r.className="grid grid-stats";r.style.marginBottom="20px";
      r.innerHTML=`
        ${this.statCard("green","📈","Total guardado",Utils.brl(totalGuardado))}
        ${this.statCard("blue","🎯","Total das metas",Utils.brl(totalMeta))}
        ${totalAportes>0?this.statCard("amber","💰","Aportes este mês",Utils.brl(totalAportes),"Comprometido em Contas Fixas"):""}
      `;
      main.appendChild(r);
    }
    if(!invs.length){
      const c=document.createElement("div");c.className="card";
      c.innerHTML=`<div class="empty-state"><div class="emoji">📈</div><p>Nenhum investimento cadastrado.</p></div>`;
      main.appendChild(c);return;
    }
    const grid=document.createElement("div");grid.className="grid grid-2";
    invs.forEach(inv=>{
      const pct=Math.min(100,((Number(inv.valorAtual)||0)/(Number(inv.valorAlvo)||1))*100);
      const falta=Math.max(0,Number(inv.valorAlvo)-Number(inv.valorAtual||0));
      // Verifica status do aporte do mês selecionado
      const fixaMes=Store.data.contasFixas.find(c=>c.investimentoId===inv.id&&Store._normMk(c.mesReferencia)===Store._normMk(mk));
      const aportePago=fixaMes?.pago||false;
      const aporte=Number(inv.aportesMensal||0);

      const card=document.createElement("div");card.className="card";
      card.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
          <div>
            <h3 style="margin-bottom:4px;">${Utils.escapeHtml(inv.nome)}</h3>
            ${inv.descricao?`<div class="row-sub">${Utils.escapeHtml(inv.descricao)}</div>`:""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${aporte>0?`<span class="badge ${aportePago?"green":"gray"}">${aportePago?"✓ Aporte pago":"Aporte pendente"}</span>`:""}
            ${aporte>0?`<span style="font-size:11px;color:var(--color-text-muted);">${Utils.brl(aporte)}/mês</span>`:""}
          </div>
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
          ${aporte>0&&fixaMes&&!aportePago?`<button class="btn btn-sm btn-primary" onclick="Actions.payFixedBill('${fixaMes.id}')">✓ Registrar aporte ${Utils.monthLabel(mk)}</button>`:""}
          ${aporte>0&&aportePago?`<button class="btn btn-sm btn-secondary" onclick="Actions.payFixedBill('${fixaMes.id}')">Desfazer aporte</button>`:""}
          <button class="btn btn-sm btn-secondary" onclick="Modals.openAporteInvestimento('${inv.id}')">+ Aporte avulso</button>
          <button class="btn btn-sm btn-ghost" onclick="Modals.openInvestimento('${inv.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="Actions.remove('investimentos','Investimentos','${inv.id}')">🗑️</button>
        </div>`;
      grid.appendChild(card);
    });
    main.appendChild(grid);
  },

  // ═══ RECEITAS ══════════════════════════════════════════════
  receitas(main){
    const mk=App.selectedMonth;
    this.header(main,"Receitas");this.monthSelector(main);
    main.appendChild(this.actionsBar("+ Nova Receita",()=>Modals.openReceita()));
    const list=[...Store.monthReceitas(mk)].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
    const card=document.createElement("div");card.className="card";
    card.innerHTML=this.listOrEmpty(list,r=>`
      <div class="list-row">
        <div class="row-main"><div class="row-title">${Utils.escapeHtml(r.nome)}</div><div class="row-sub">${Utils.escapeHtml(r.categoria||"—")} · ${Utils.fmtDateFull(r.data)}</div></div>
        <div class="row-amount pos">+${Utils.brl(r.valor)}</div>
        <button class="btn btn-sm btn-ghost" onclick="Modals.openReceita('${r.id}')">✏️</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.remove('receitas','Receitas','${r.id}')">🗑️</button>
      </div>`,"Nenhuma receita neste mês.");
    main.appendChild(card);
  },

  // ═══ DÍVIDAS ════════════════════════════════════════════════
  dividas(main){
    const stats=Store.dividaStats();
    this.header(main,"Dívidas","Controle do seu passivo financeiro");
    main.appendChild(this.actionsBar("+ Nova Dívida",()=>Modals.openDivida(),"btn-danger"));
    const resumo=document.createElement("div");resumo.className="grid grid-stats";
    resumo.innerHTML=`
      <div class="card"><div class="stat-icon red">🔴</div><h3>Total em aberto</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAberto)}</div></div>
      <div class="card"><div class="stat-icon red">⚠️</div><h3>Em atraso</h3><div class="big-number" style="color:var(--color-negative);">${Utils.brl(stats.totalAtraso)}</div><div class="row-sub">${stats.atraso.length} dívida${stats.atraso.length!==1?"s":""}</div></div>
      <div class="card"><div class="stat-icon amber">🤝</div><h3>Negociadas</h3><div class="big-number" style="color:var(--color-warning);">${Utils.brl(stats.totalNegoc)}</div></div>
      <div class="card"><div class="stat-icon green">✅</div><h3>Total quitado</h3><div class="big-number" style="color:var(--color-positive);">${Utils.brl(stats.totalQuitado)}</div></div>
      ${stats.maior?`<div class="card"><div class="stat-icon red">📊</div><h3>Maior dívida</h3><div class="big-number" style="font-size:18px;">${Utils.escapeHtml(stats.maior.nome)}</div><div class="row-sub">${Utils.brl(stats.maior.valorRestante)}</div></div>`:""}`;
    main.appendChild(resumo);
    const totalOrig=Store.data.dividas.reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    const totalQuit=Store.data.dividas.filter(d=>d.status==="quitada").reduce((s,d)=>s+Number(d.valorOriginal||0),0);
    if(totalOrig>0){
      const p=Math.min(100,(totalQuit/totalOrig)*100);
      const cM=document.createElement("div");cM.className="card";cM.style.marginTop="16px";
      cM.innerHTML=`<h3>🎯 Meta: ficar sem dívidas</h3>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px;">
          <div class="big-number" style="color:var(--color-positive);">${Utils.brl(totalQuit)}</div>
          <span style="color:var(--color-text-muted);font-size:14px;">de ${Utils.brl(totalOrig)}</span>
        </div>
        <div class="progress-track"><div class="progress-fill green" style="width:${p}%"></div></div>
        <div class="row-sub" style="margin-top:6px;">${p.toFixed(0)}% · faltam ${Utils.brl(totalOrig-totalQuit)}</div>`;
      main.appendChild(cM);
    }
    const sfiltros=[{v:"todas",l:"Todas"},{v:"em_atraso",l:"Em atraso"},{v:"em_aberto",l:"Em aberto"},{v:"negociada",l:"Negociadas"},{v:"parcelada",l:"Parceladas"},{v:"quitada",l:"Quitadas"}];
    const fb=document.createElement("div");fb.className="filter-bar";fb.style.marginTop="20px";
    fb.innerHTML=sfiltros.map(f=>`<button class="filter-chip ${f.v==="todas"?"active":""}" data-status="${f.v}">${f.l}</button>`).join("");
    main.appendChild(fb);
    const lw=document.createElement("div");lw.id="dividas-list";main.appendChild(lw);
    const renderLista=filtro=>{
      const lista=filtro==="todas"?Store.data.dividas:Store.data.dividas.filter(d=>d.status===filtro);
      const ord={em_atraso:0,em_aberto:1,negociada:2,parcelada:3,quitada:4};
      lw.innerHTML=[...lista].sort((a,b)=>(ord[a.status]??5)-(ord[b.status]??5)).map(d=>this.debtCard(d)).join("")
        ||`<div class="card"><div class="empty-state"><div class="emoji">🎉</div><p>Nenhuma dívida aqui!</p></div></div>`;
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
    return`<div class="debt-card debt-${d.status}">
      <div class="debt-card-header">
        <div><div class="debt-card-name">${Utils.escapeHtml(d.nome)}</div>${d.credor?`<div class="debt-card-credor">${Utils.escapeHtml(d.credor)}</div>`:""}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge ${sCls}">${sLabel}</span><span class="badge ${pCls}">${pLabel}</span>
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
      ${!isQ?`
      <div class="debt-card-actions">
        <button class="btn btn-sm btn-primary" onclick="Modals.openPagamentoDivida('${d.id}')">💳 Pagar</button>
        <button class="btn btn-sm btn-secondary" onclick="Modals.openParcelarDivida('${d.id}')">📦 Parcelar</button>
        <button class="btn btn-sm btn-secondary" onclick="Modals.openNegociacaoDivida('${d.id}')">🤝 Negociar</button>
        <button class="btn btn-sm btn-secondary" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" onclick="Actions.quitarDivida('${d.id}')">✅ Quitar</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.excluirDivida('${d.id}')">🗑️ Excluir</button>
      </div>`:`
      <div class="debt-card-actions">
        <button class="btn btn-sm btn-ghost" onclick="Modals.openDivida('${d.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-ghost" onclick="Actions.excluirDivida('${d.id}')">🗑️ Excluir</button>
      </div>`}
    </div>`;
  },

  // ═══ ANOTAÇÕES ══════════════════════════════════════════════
  anotacoes(main){
    this.header(main,"Anotações","Notas rápidas e lembretes");
    main.appendChild(this.actionsBar("+ Nova nota",()=>Modals.openNota()));
    const grid=document.createElement("div");grid.className="notas-grid";
    const notas=[...Store.data.notas].sort((a,b)=>(b.atualizadoEm||"").localeCompare(a.atualizadoEm||""));
    if(!notas.length){
      grid.innerHTML=`<div style="grid-column:1/-1;"><div class="empty-state"><div class="emoji">📝</div><p>Nenhuma nota ainda.</p></div></div>`;
    }else{
      notas.forEach(n=>{
        const card=document.createElement("div");card.className="nota-card";card.style.background=n.cor||"#FFF9C4";
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

  // ═══ CONFIGURAÇÕES ══════════════════════════════════════════
  config(main){
    this.header(main,"Configurações");
    const row=document.createElement("div");row.className="grid grid-2";
    const temaAtual=document.documentElement.getAttribute("data-theme")||"light";

    const c1=document.createElement("div");c1.className="card";
    c1.innerHTML=`<h3>Sistema</h3>
      <div class="field" style="margin-top:8px;">
        <label>Mês de início do sistema</label>
        <input type="month" id="cfg-inicio" value="${Store.data.configuracoes.dataInicioSistema||"2026-08"}">
        <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">Contas antes desta data não geram dívidas automáticas</div>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:16px;" onclick="Actions.saveConfig()">Salvar</button>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--color-border);">
        <div style="font-size:12.5px;font-weight:600;color:var(--color-text-muted);margin-bottom:10px;">SINCRONIZAÇÃO</div>
        <button class="btn btn-secondary" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="Actions.syncSheets()">
          🔄 Sincronizar com Google Sheets
        </button>
        <div style="font-size:11px;color:var(--color-text-muted);">Use quando os dados estiverem desatualizados entre dispositivos.</div>
      </div>

      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border);">
        <div style="font-size:12.5px;font-weight:600;color:var(--color-text-muted);margin-bottom:10px;">APARÊNCIA</div>
        <button class="btn btn-secondary" onclick="Actions.toggleTheme(this)" style="width:100%;justify-content:center;">
          ${temaAtual==="dark"?"☀️ Mudar para tema claro":"🌙 Mudar para tema escuro"}
        </button>
      </div>`;
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
      <p class="row-sub">Usuário 1: <strong>${window.APP_CONFIG?.USER_1||"Higor"}</strong></p>
      <p class="row-sub" style="margin-top:6px;">Usuário 2: <strong>${window.APP_CONFIG?.USER_2||"Bia"}</strong></p>
      <p class="row-sub" style="margin-top:12px;">Para alterar nomes ou senhas, edite <code>js/config.js</code>.</p>`;
    row.appendChild(c3);

    const c4=document.createElement("div");c4.className="card";
    c4.innerHTML=`<h3>Exportar dados</h3>
      <p class="row-sub" style="margin-bottom:12px;">Exporta o mês atual em CSV (abre no Excel).</p>
      <button class="btn btn-secondary btn-sm" onclick="Actions.exportCSV()">⬇ Exportar CSV</button>`;
    row.appendChild(c4);

    main.appendChild(row);
    this.renderCategoryChips();
  },

  renderCategoryChips(){
    const el=document.getElementById("cat-list");if(!el)return;
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
