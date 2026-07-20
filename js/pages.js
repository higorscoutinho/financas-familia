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
