/* =========================================================
   store.js — Estado + sincronização
   MUDANÇAS:
   - SEM ensureFixedBillsForMonth: fixas 100% manuais
   - SEM checkOverdueBills: dívidas 100% manuais
   - metas → investimentos (com migração automática)
   - investimentos tem campo aportesMensal
   ========================================================= */

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
    receitas:           [],
    despesas:           [],
    contasFixas:        [],
    parcelamentos:      [],
    categorias:         [...DEFAULT_CATEGORIES],
    investimentos:      [],   // antes: metas
    configuracoes:      { metaEconomiaMensal: 0, dataInicioSistema: "2026-08" },
    logs:               [],
    dividas:            [],
    pagamentosDividas:  [],
    negociacoesDividas: [],
    historicoDividas:   [],
    notas:              [],
  },

  parcelamentosPagos: {},
  queue:   [],
  syncing: false,

  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migração: metas → investimentos
        if (parsed.metas && !parsed.investimentos) {
          parsed.investimentos = parsed.metas;
          delete parsed.metas;
        }
        this.data = { ...this.data, ...parsed };
      }
      const q  = localStorage.getItem(LS_QUEUE);    if (q)  this.queue = JSON.parse(q);
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
        // Migração remota: metas → investimentos
        const inv = remote.investimentos || remote.metas || [];
        this.data = {
          receitas:           remote.receitas           || [],
          despesas:           remote.despesas           || [],
          contasFixas:        remote.contasFixas        || [],
          parcelamentos:      remote.parcelamentos      || [],
          categorias:         remote.categorias?.length ? remote.categorias : [...DEFAULT_CATEGORIES],
          investimentos:      inv,
          configuracoes:      remote.configuracoes      || { metaEconomiaMensal: 0, dataInicioSistema: "2026-08" },
          logs:               remote.logs               || [],
          dividas:            remote.dividas            || [],
          pagamentosDividas:  remote.pagamentosDividas  || [],
          negociacoesDividas: remote.negociacoesDividas || [],
          historicoDividas:   remote.historicoDividas   || [],
          notas:              remote.notas              || [],
        };
        this.saveLocal();
        Utils.toast("Sincronizado ✓");
      } else {
        Utils.toast("Offline — dados locais");
      }
      this.flushQueue();
    }
    // Sem chamadas automáticas de fixas ou dívidas — tudo manual
  },

  // ── Prioridade de dívidas ─────────────────────────────
  getPrioridade(categoria) {
    const cat  = (categoria||"").toLowerCase();
    const alta = ["moradia","aluguel","financiamento","faculdade","educação","educacao","condomínio","condominio"];
    const med  = ["cartão","cartao","empréstimo","emprestimo","assinatura","streaming"];
    if (alta.some(a => cat.includes(a))) return "alta";
    if (med.some(m  => cat.includes(m))) return "media";
    return "baixa";
  },

  // ── Histórico de dívidas ──────────────────────────────
  addHistoricoDivida(dividaId, tipo, descricao, valor) {
    const e = { id:Utils.uid("hist"), dividaId, tipo, data:Utils.todayISO(), descricao:descricao||"", valor:valor||0 };
    this.data.historicoDividas.push(e);
    this.queueChange("HistoricoDividas","create",e);
  },

  recalcularDivida(id) {
    const d = this.data.dividas.find(x => x.id===id); if (!d) return;
    const pags = this.data.pagamentosDividas.filter(p => p.dividaId===id);
    const pago = pags.reduce((s,p) => s+Number(p.valor||0), 0);
    const rest = Math.max(0, Number(d.valorAtual)-pago);
    const st   = rest<=0 ? "quitada" : d.status==="quitada" ? "em_aberto" : d.status;
    this.update("dividas","Dividas",id,{valorPago:pago,valorRestante:rest,status:st});
    if (rest<=0 && d.status!=="quitada") {
      this.addHistoricoDivida(id,"quitada","Quitada — pagamento total",pago);
      if (d.contaFixaId) {
        const c = this.data.contasFixas.find(x => x.id===d.contaFixaId);
        if (c && !c.pago) this.update("contasFixas","ContasFixas",c.id,{pago:true,dataPagamento:Utils.todayISO(),horaPagamento:new Date().toLocaleTimeString("pt-BR")});
      }
    }
  },

  dividaStats() {
    const ativas  = this.data.dividas.filter(d => d.status!=="quitada");
    const atraso  = ativas.filter(d => d.status==="em_atraso");
    const negoc   = ativas.filter(d => d.status==="negociada"||d.status==="parcelada");
    const quit    = this.data.dividas.filter(d => d.status==="quitada");
    return {
      ativas, atraso, negoc, quitadas: quit,
      totalAberto:  ativas.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalAtraso:  atraso.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalNegoc:   negoc.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalQuitado: quit.reduce((s,d)=>s+Number(d.valorOriginal||0),0),
      maior: [...ativas].sort((a,b)=>Number(b.valorRestante||0)-Number(a.valorRestante||0))[0]||null,
    };
  },

  diasAtraso(divida) {
    if (!divida.dataVencimento) return 0;
    const due=new Date(divida.dataVencimento); due.setHours(0,0,0,0);
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
    const k=this.parcPagoKey(id,mk), pago=!this.parcelamentosPagos[k]?.pago;
    if(pago) this.parcelamentosPagos[k]={pago:true,data:Utils.todayISO()};
    else delete this.parcelamentosPagos[k];
    this.saveLocal(); return pago;
  },

  // ── Fila de sincronização ─────────────────────────────
  queueChange(sheet,op,data){
    this.queue.push({sheet,op,data,user:typeof App!=="undefined"?App.currentUser:"Sistema",ts:Date.now()});
    this.saveLocal(); this.flushQueue();
  },

  async flushQueue(){
    if(this.syncing||!API.isConfigured()||!this.queue.length)return;
    this.syncing=true;
    while(this.queue.length){
      const i=this.queue[0], r=await API.send(i.sheet,i.op,i.data,i.user);
      if(!r||r.ok===false)break;
      this.queue.shift(); this.saveLocal();
    }
    this.syncing=false;
  },

  // ── CRUD ──────────────────────────────────────────────
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
    this.data.logs.unshift({id:Utils.uid("log"),usuario:typeof App!=="undefined"?App.currentUser:"?",
      data:Utils.todayISO(),hora:new Date().toLocaleTimeString("pt-BR"),
      aba:sheet,registroId:id,valorAntigo:b.valor??b.pago??b.status??"",valorNovo:a.valor??a.pago??a.status??""});
    this.data.logs=this.data.logs.slice(0,300);
  },

  // ── Consultas por mês ─────────────────────────────────
  monthDespesas(mk)   { return this.data.despesas.filter(d=>Utils.monthKey(d.data)===mk); },
  monthReceitas(mk)   { return this.data.receitas.filter(r=>Utils.monthKey(r.data)===mk); },
  monthFixedBills(mk) { return this.data.contasFixas.filter(c=>c.mesReferencia===mk); },
  monthParcelamentos(mk){
    return this.data.parcelamentos.filter(p=>{
      const total=Number(p.qtdTotal)||1, df=(p.dataFinal||"").slice(0,7);
      if(!df)return true;
      const [ey,em]=df.split("-").map(Number);
      const st=new Date(ey,em-1-(total-1),1);
      const smk=`${st.getFullYear()}-${String(st.getMonth()+1).padStart(2,"0")}`;
      return mk>=smk&&mk<=df;
    });
  },

  // Investimentos com aporte mensal — entram no cálculo do mês
  monthInvestimentos() {
    return this.data.investimentos.filter(i => i.ativo!==false && Number(i.aportesMensal||0)>0);
  },

  sum(list){ return list.reduce((s,x)=>s+(Number(x.valor)||0),0); },
};
