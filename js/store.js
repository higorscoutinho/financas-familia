const DEFAULT_CATEGORIES = [
  "Moradia","Mercado","Farmácia","Restaurantes","Lazer","Combustível",
  "Carro","Moto","Pets","Saúde","Educação","Assinaturas","Streaming",
  "Viagem","Investimentos","Outros",
];

const LS_KEY        = "ff_data_v1";
const LS_QUEUE      = "ff_queue_v1";
const LS_USER       = "ff_user_v1";
const LS_THEME      = "ff_theme_v1";
const LS_PARC_PAGOS = "ff_parc_pagos_v1";

const Store = {
  data: {
    receitas:[], despesas:[], contasFixas:[], parcelamentos:[],
    categorias:[...DEFAULT_CATEGORIES], investimentos:[],
    configuracoes:{ metaEconomiaMensal:0, dataInicioSistema:"2026-08" },
    logs:[], dividas:[], pagamentosDividas:[], negociacoesDividas:[],
    historicoDividas:[], notas:[],
  },
  parcelamentosPagos:{}, queue:[], syncing:false,

  // ── Merge: nunca apaga dados locais com array vazio do Sheets ──
  _merge(remote, local) {
    if (Array.isArray(remote) && remote.length > 0) return remote;
    if (Array.isArray(local)  && local.length  > 0) return local;
    return [];
  },

  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.metas && !p.investimentos) { p.investimentos = p.metas; delete p.metas; }
        this.data = { ...this.data, ...p };
      }
      const q  = localStorage.getItem(LS_QUEUE);      if (q)  this.queue = JSON.parse(q);
      const pp = localStorage.getItem(LS_PARC_PAGOS); if (pp) this.parcelamentosPagos = JSON.parse(pp);
    } catch(e) { console.warn("Cache corrompido", e); }
  },

  saveLocal() {
    localStorage.setItem(LS_KEY,        JSON.stringify(this.data));
    localStorage.setItem(LS_QUEUE,      JSON.stringify(this.queue));
    localStorage.setItem(LS_PARC_PAGOS, JSON.stringify(this.parcelamentosPagos));
  },

  async init() {
    this.loadLocal();
    if (API.isConfigured()) {
      const remote = await API.getAll();
      if (remote) {
        const inv = remote.investimentos || remote.metas || [];
        // MERGE: remote vence se tiver dados; senão mantém local
        this.data = {
          receitas:           this._merge(remote.receitas,           this.data.receitas),
          despesas:           this._merge(remote.despesas,           this.data.despesas),
          contasFixas:        this._merge(remote.contasFixas,        this.data.contasFixas),
          parcelamentos:      this._merge(remote.parcelamentos,      this.data.parcelamentos),
          categorias:         remote.categorias?.length ? remote.categorias : this.data.categorias,
          investimentos:      this._merge(inv,                       this.data.investimentos),
          configuracoes:      remote.configuracoes || this.data.configuracoes,
          logs:               this._merge(remote.logs,               this.data.logs),
          dividas:            this._merge(remote.dividas,            this.data.dividas),
          pagamentosDividas:  this._merge(remote.pagamentosDividas,  this.data.pagamentosDividas),
          negociacoesDividas: this._merge(remote.negociacoesDividas, this.data.negociacoesDividas),
          historicoDividas:   this._merge(remote.historicoDividas,   this.data.historicoDividas),
          notas:              this._merge(remote.notas,              this.data.notas),
        };
        this.saveLocal();
        Utils.toast("Sincronizado ✓");
      } else {
        Utils.toast("Offline — dados locais");
      }
      this.flushQueue();
    }
    // Garante fixas do mês atual
    this.ensureFixedBillsForMonth(Utils.currentMonthKey());
  },

  // ══════════════════════════════════════════════════════
  //  CONTAS FIXAS RECORRENTES
  //  Cada conta tem um grupoId. Ao criar, gera instâncias
  //  para os próximos 13 meses. Ao editar/excluir, afeta
  //  apenas o mês selecionado em diante (não pagas).
  // ══════════════════════════════════════════════════════

  // Cria conta fixa + instâncias dos próximos 13 meses
  criarContaFixaRecorrente(dados) {
    const grupoId = Utils.uid("grp");
    const mk      = typeof App !== "undefined" ? App.selectedMonth : Utils.currentMonthKey();
    const [y, m]  = mk.split("-").map(Number);
    const usuario = typeof App !== "undefined" ? App.currentUser : "Sistema";

    for (let i = 0; i <= 12; i++) {
      const dt     = new Date(y, m - 1 + i, 1);
      const mesRef = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      const inst   = {
        ...dados,
        id:            Utils.uid("fix"),
        grupoId,
        mesReferencia: mesRef,
        pago:          false,
        dataPagamento: "",
        horaPagamento: "",
        criadoPor:     usuario,
      };
      this.data.contasFixas.push(inst);
      this.queueChange("ContasFixas", "create", inst);
    }
    this.saveLocal();
  },

  // Edita conta: atualiza este mês em diante (apenas não pagas)
  editarContaFixaForward(id, patch) {
    const base = this.data.contasFixas.find(c => c.id === id);
    if (!base) return;
    const { grupoId, mesReferencia: mk } = base;

    this.data.contasFixas.forEach((c, i) => {
      if (c.grupoId !== grupoId)     return;
      if (c.mesReferencia < mk)      return;
      if (c.pago)                    return; // não altera meses já pagos
      this.data.contasFixas[i] = {
        ...c, ...patch,
        id: c.id, grupoId, mesReferencia: c.mesReferencia,
        pago: c.pago, dataPagamento: c.dataPagamento, horaPagamento: c.horaPagamento,
      };
      this.queueChange("ContasFixas", "update", this.data.contasFixas[i]);
    });
    this.saveLocal();
  },

  // Exclui este mês em diante; meses passados/pagos permanecem
  excluirContaFixaForward(id) {
    const base = this.data.contasFixas.find(c => c.id === id);
    if (!base) return;
    const { grupoId, mesReferencia: mk } = base;

    const remover = this.data.contasFixas.filter(
      c => c.grupoId === grupoId && c.mesReferencia >= mk
    );
    remover.forEach(c => {
      this.data.contasFixas = this.data.contasFixas.filter(x => x.id !== c.id);
      this.queueChange("ContasFixas", "delete", { id: c.id });
    });
    this.saveLocal();
  },

  // Garante que todo mês visitado tem suas fixas recorrentes
  ensureFixedBillsForMonth(mk) {
    const grupos = {};
    this.data.contasFixas.forEach(c => {
      if (!c.grupoId) return;
      if (!grupos[c.grupoId]) grupos[c.grupoId] = [];
      grupos[c.grupoId].push(c);
    });

    let criou = false;
    Object.entries(grupos).forEach(([grupoId, instances]) => {
      if (instances.some(c => c.mesReferencia === mk)) return; // já existe

      // Ordena e pega a mais antiga como template
      const sorted   = [...instances].sort((a,b) => a.mesReferencia.localeCompare(b.mesReferencia));
      const template = sorted[0];
      if (template.mesReferencia > mk) return; // conta ainda não existia nesse mês

      const novo = {
        ...template,
        id:            Utils.uid("fix"),
        grupoId,
        mesReferencia: mk,
        pago:          false,
        dataPagamento: "",
        horaPagamento: "",
      };
      this.data.contasFixas.push(novo);
      this.queueChange("ContasFixas", "create", novo);
      criou = true;
    });
    if (criou) this.saveLocal();
  },

  // ── Dívidas ───────────────────────────────────────────
  getPrioridade(cat) {
    cat = (cat||"").toLowerCase();
    if (["moradia","aluguel","financiamento","faculdade","educação","educacao","condomínio","condominio"]
        .some(a => cat.includes(a))) return "alta";
    if (["cartão","cartao","empréstimo","emprestimo","assinatura","streaming"]
        .some(m => cat.includes(m)))  return "media";
    return "baixa";
  },

  addHistoricoDivida(dividaId, tipo, descricao, valor) {
    const e = { id:Utils.uid("hist"), dividaId, tipo, data:Utils.todayISO(), descricao:descricao||"", valor:valor||0 };
    this.data.historicoDividas.push(e);
    this.queueChange("HistoricoDividas","create",e);
  },

  recalcularDivida(id) {
    const d = this.data.dividas.find(x => x.id===id); if (!d) return;
    const pago = this.data.pagamentosDividas.filter(p=>p.dividaId===id).reduce((s,p)=>s+Number(p.valor||0),0);
    const rest = Math.max(0, Number(d.valorAtual)-pago);
    const st   = rest<=0 ? "quitada" : d.status==="quitada" ? "em_aberto" : d.status;
    this.update("dividas","Dividas",id,{valorPago:pago,valorRestante:rest,status:st});
    if (rest<=0 && d.status!=="quitada") {
      this.addHistoricoDivida(id,"quitada","Quitada — pagamento total",pago);
      if (d.contaFixaId) {
        const c = this.data.contasFixas.find(x=>x.id===d.contaFixaId);
        if (c&&!c.pago) this.update("contasFixas","ContasFixas",c.id,{pago:true,dataPagamento:Utils.todayISO(),horaPagamento:new Date().toLocaleTimeString("pt-BR")});
      }
    }
  },

  dividaStats() {
    const ativas  = this.data.dividas.filter(d=>d.status!=="quitada");
    const atraso  = ativas.filter(d=>d.status==="em_atraso");
    const negoc   = ativas.filter(d=>d.status==="negociada"||d.status==="parcelada");
    const quit    = this.data.dividas.filter(d=>d.status==="quitada");
    return {
      ativas, atraso, negoc, quitadas:quit,
      totalAberto:  ativas.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalAtraso:  atraso.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalNegoc:   negoc.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalQuitado: quit.reduce((s,d)=>s+Number(d.valorOriginal||0),0),
      maior:[...ativas].sort((a,b)=>Number(b.valorRestante||0)-Number(a.valorRestante||0))[0]||null,
    };
  },

  diasAtraso(d) {
    if (!d.dataVencimento) return 0;
    const due=new Date(d.dataVencimento); due.setHours(0,0,0,0);
    const now=new Date(); now.setHours(0,0,0,0);
    return Math.max(0,Math.floor((now-due)/86400000));
  },

  // ── Parcelamentos ─────────────────────────────────────
  getInstallmentForMonth(p,mk) {
    const total=Number(p.qtdTotal)||1, df=(p.dataFinal||"").slice(0,7);
    if (!df) return Number(p.parcelaAtual)||1;
    const [ey,em]=df.split("-").map(Number);
    const st=new Date(ey,em-1-(total-1),1);
    const [my,mm]=mk.split("-").map(Number);
    return Math.max(1,Math.min(total,(my-st.getFullYear())*12+(mm-st.getMonth()-1)+1));
  },

  parcPagoKey(id,mk){ return `${id}_${mk}`; },
  isParcelamentoPago(id,mk){ return !!this.parcelamentosPagos[this.parcPagoKey(id,mk)]?.pago; },
  toggleParcelamentoPago(id,mk){
    const k=this.parcPagoKey(id,mk),pago=!this.parcelamentosPagos[k]?.pago;
    if(pago) this.parcelamentosPagos[k]={pago:true,data:Utils.todayISO()};
    else delete this.parcelamentosPagos[k];
    this.saveLocal(); return pago;
  },

  // ── Fila de sincronização ─────────────────────────────
  queueChange(sheet,op,data){
    const user=typeof App!=="undefined"?App.currentUser:"Sistema";
    this.queue.push({sheet,op,data,user,ts:Date.now()});
    this.saveLocal(); this.flushQueue();
  },

  async flushQueue(){
    if(this.syncing||!API.isConfigured()||!this.queue.length)return;
    this.syncing=true;
    while(this.queue.length){
      const i=this.queue[0],r=await API.send(i.sheet,i.op,i.data,i.user);
      if(!r||r.ok===false)break;
      this.queue.shift(); this.saveLocal();
    }
    this.syncing=false;
  },

  // ── CRUD genérico ─────────────────────────────────────
  add(col,sheet,record){
    record.id=record.id||Utils.uid(col.slice(0,3));
    record.criadoPor=typeof App!=="undefined"?App.currentUser:"Sistema";
    this.data[col].push(record); this.saveLocal(); this.queueChange(sheet,"create",record);
    return record;
  },
  update(col,sheet,id,patch){
    const i=this.data[col].findIndex(r=>r.id===id); if(i===-1)return null;
    const before={...this.data[col][i]};
    this.data[col][i]={...before,...patch};
    this.saveLocal(); this.queueChange(sheet,"update",this.data[col][i]);
    this.logChange(sheet,id,before,this.data[col][i]);
    return this.data[col][i];
  },
  remove(col,sheet,id){
    this.data[col]=this.data[col].filter(r=>r.id!==id);
    this.saveLocal(); this.queueChange(sheet,"delete",{id});
  },
  logChange(sheet,id,b,a){
    this.data.logs.unshift({id:Utils.uid("log"),
      usuario:typeof App!=="undefined"?App.currentUser:"?",
      data:Utils.todayISO(),hora:new Date().toLocaleTimeString("pt-BR"),
      aba:sheet,registroId:id,
      valorAntigo:b.valor??b.pago??b.status??"",
      valorNovo:a.valor??a.pago??a.status??""});
    this.data.logs=this.data.logs.slice(0,300);
  },

  // ── Consultas por mês ─────────────────────────────────
  monthDespesas(mk)   { return this.data.despesas.filter(d=>Utils.monthKey(d.data)===mk); },
  monthReceitas(mk)   { return this.data.receitas.filter(r=>Utils.monthKey(r.data)===mk); },
  monthFixedBills(mk) { return this.data.contasFixas.filter(c=>c.mesReferencia===mk); },
  monthParcelamentos(mk){
    return this.data.parcelamentos.filter(p=>{
      const total=Number(p.qtdTotal)||1,df=(p.dataFinal||"").slice(0,7);
      if(!df)return true;
      const [ey,em]=df.split("-").map(Number);
      const st=new Date(ey,em-1-(total-1),1);
      const smk=`${st.getFullYear()}-${String(st.getMonth()+1).padStart(2,"0")}`;
      return mk>=smk&&mk<=df;
    });
  },
  monthInvestimentos(){
    return this.data.investimentos.filter(i=>i.ativo!==false&&Number(i.aportesMensal||0)>0);
  },
  sum(list){ return list.reduce((s,x)=>s+(Number(x.valor)||0),0); },
};
