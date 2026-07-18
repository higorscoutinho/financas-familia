const DEFAULT_CATEGORIES = [
  "Moradia","Mercado","Farmácia","Restaurantes","Lazer","Combustível",
  "Carro","Moto","Pets","Saúde","Educação","Assinaturas","Streaming",
  "Viagem","Investimentos","Outros",
];
const LS_KEY="ff_data_v1",LS_QUEUE="ff_queue_v1",LS_USER="ff_user_v1",LS_THEME="ff_theme_v1",LS_PARC="ff_parc_pagos_v1";

const Store={
  data:{
    receitas:[],despesas:[],contasFixas:[],parcelamentos:[],
    categorias:[...DEFAULT_CATEGORIES],investimentos:[],
    configuracoes:{metaEconomiaMensal:0,dataInicioSistema:"2026-08"},
    logs:[],dividas:[],pagamentosDividas:[],negociacoesDividas:[],historicoDividas:[],notas:[],
  },
  parcelamentosPagos:{},queue:[],syncing:false,

  /* Merge: o Sheets é a fonte da verdade.
     Itens locais ainda na fila (não confirmados) são preservados. */
  _merge(remote,local){
    if(!Array.isArray(remote)) remote=[];
    if(!Array.isArray(local))  local=[];
    const remoteIds=new Set(remote.map(i=>i?.id).filter(Boolean));
    // IDs ainda pendentes na fila → preserva no local
    const pendingIds=new Set(this.queue.filter(q=>q.op==="create").map(q=>q.data?.id).filter(Boolean));
    const extras=local.filter(i=>i?.id&&!remoteIds.has(i.id)&&pendingIds.has(i.id));
    return [...remote,...extras];
  },

  loadLocal(){
    try{
      const raw=localStorage.getItem(LS_KEY);
      if(raw){
        const p=JSON.parse(raw);
        if(p.metas&&!p.investimentos){p.investimentos=p.metas;delete p.metas;}
        this.data={...this.data,...p};
      }
      const q=localStorage.getItem(LS_QUEUE);   if(q)  this.queue=JSON.parse(q);
      const pp=localStorage.getItem(LS_PARC);   if(pp) this.parcelamentosPagos=JSON.parse(pp);
    }catch(e){console.warn("Cache corrompido",e);}
  },

  saveLocal(){
    localStorage.setItem(LS_KEY,JSON.stringify(this.data));
    localStorage.setItem(LS_QUEUE,JSON.stringify(this.queue));
    localStorage.setItem(LS_PARC,JSON.stringify(this.parcelamentosPagos));
  },

  async init(){
    this.loadLocal();
    if(API.isConfigured()){
      const remote=await API.getAll();
      if(remote){
        const inv=remote.investimentos||remote.metas||[];
        this.data={
          receitas:          this._merge(remote.receitas,          this.data.receitas),
          despesas:          this._merge(remote.despesas,          this.data.despesas),
          contasFixas:       this._merge(remote.contasFixas,       this.data.contasFixas),
          parcelamentos:     this._merge(remote.parcelamentos,     this.data.parcelamentos),
          categorias:        remote.categorias?.length?remote.categorias:this.data.categorias,
          investimentos:     this._merge(inv,                      this.data.investimentos),
          configuracoes:     remote.configuracoes||this.data.configuracoes,
          logs:              this._merge(remote.logs,              this.data.logs),
          dividas:           this._merge(remote.dividas,           this.data.dividas),
          pagamentosDividas: this._merge(remote.pagamentosDividas, this.data.pagamentosDividas),
          negociacoesDividas:this._merge(remote.negociacoesDividas,this.data.negociacoesDividas),
          historicoDividas:  this._merge(remote.historicoDividas,  this.data.historicoDividas),
          notas:             this._merge(remote.notas,             this.data.notas),
        };
        this.saveLocal();
        Utils.toast("Sincronizado ✓");
      }else{
        Utils.toast("Offline — dados locais");
      }
      this.flushQueue();
    }
    // Garante instâncias do mês atual para fixas já existentes
    this.ensureFixedBillsForMonth(Utils.currentMonthKey());
  },

  // ═══════════════ CONTAS FIXAS RECORRENTES ═══════════════

  // Cria conta fixa para o mês atual; meses seguintes criados ao navegar
  criarContaFixa(dados){
    const grupoId=Utils.uid("grp");
    const mk=typeof App!=="undefined"?App.selectedMonth:Utils.currentMonthKey();
    const inst={
      id:Utils.uid("fix"),grupoId,
      nome:dados.nome,categoria:dados.categoria,
      valor:dados.valor,diaVencimento:dados.diaVencimento,obs:dados.obs||"",
      mesReferencia:mk,pago:false,dataPagamento:"",horaPagamento:"",
      criadoPor:typeof App!=="undefined"?App.currentUser:"Sistema",
    };
    this.data.contasFixas.push(inst);
    this.queueChange("ContasFixas","create",inst);
    this.saveLocal();
    return inst;
  },

  // Ao navegar para um mês: cria automaticamente as fixas recorrentes que faltam
  ensureFixedBillsForMonth(mk){
    const grupos={};
    this.data.contasFixas.forEach(c=>{
      if(!c.grupoId)return;
      if(!grupos[c.grupoId])grupos[c.grupoId]=[];
      grupos[c.grupoId].push(c);
    });
    let criou=false;
    Object.entries(grupos).forEach(([grupoId,instances])=>{
      if(instances.some(c=>c.mesReferencia===mk))return;
      const sorted=[...instances].sort((a,b)=>a.mesReferencia.localeCompare(b.mesReferencia));
      const tpl=sorted[0];
      if(tpl.mesReferencia>mk)return; // conta não existia ainda neste mês
      const novo={
        ...tpl,
        id:Utils.uid("fix"),grupoId,mesReferencia:mk,
        pago:false,dataPagamento:"",horaPagamento:"",
      };
      this.data.contasFixas.push(novo);
      this.queueChange("ContasFixas","create",novo);
      criou=true;
    });
    if(criou)this.saveLocal();
  },

  // Editar: aplica do mês atual em diante nos meses NÃO pagos
  editarContaFixa(id,patch){
    const base=this.data.contasFixas.find(c=>c.id===id);
    if(!base)return;
    const {grupoId,mesReferencia:mk}=base;
    this.data.contasFixas.forEach((c,i)=>{
      if(c.grupoId!==grupoId||c.mesReferencia<mk||c.pago)return;
      this.data.contasFixas[i]={
        ...c,...patch,
        id:c.id,grupoId,mesReferencia:c.mesReferencia,
        pago:c.pago,dataPagamento:c.dataPagamento,horaPagamento:c.horaPagamento,
      };
      this.queueChange("ContasFixas","update",this.data.contasFixas[i]);
    });
    this.saveLocal();
  },

  // Excluir: remove do mês atual em diante; passado/pago fica
  excluirContaFixa(id){
    const base=this.data.contasFixas.find(c=>c.id===id);
    if(!base)return;
    const {grupoId,mesReferencia:mk}=base;
    this.data.contasFixas
      .filter(c=>c.grupoId===grupoId&&c.mesReferencia>=mk)
      .forEach(c=>{
        this.queueChange("ContasFixas","delete",{id:c.id});
      });
    this.data.contasFixas=this.data.contasFixas.filter(
      c=>!(c.grupoId===grupoId&&c.mesReferencia>=mk)
    );
    this.saveLocal();
  },

  // ═══════════════ DÍVIDAS ═══════════════
  getPrioridade(cat){
    cat=(cat||"").toLowerCase();
    if(["moradia","aluguel","financiamento","faculdade","educação","educacao","condomínio","condominio"].some(a=>cat.includes(a)))return"alta";
    if(["cartão","cartao","empréstimo","emprestimo","assinatura","streaming"].some(m=>cat.includes(m)))return"media";
    return"baixa";
  },
  addHistoricoDivida(dividaId,tipo,descricao,valor){
    const e={id:Utils.uid("hist"),dividaId,tipo,data:Utils.todayISO(),descricao:descricao||"",valor:valor||0};
    this.data.historicoDividas.push(e);
    this.queueChange("HistoricoDividas","create",e);
  },
  recalcularDivida(id){
    const d=this.data.dividas.find(x=>x.id===id);if(!d)return;
    const pago=this.data.pagamentosDividas.filter(p=>p.dividaId===id).reduce((s,p)=>s+Number(p.valor||0),0);
    const rest=Math.max(0,Number(d.valorAtual)-pago);
    const st=rest<=0?"quitada":d.status==="quitada"?"em_aberto":d.status;
    this.update("dividas","Dividas",id,{valorPago:pago,valorRestante:rest,status:st});
    if(rest<=0&&d.status!=="quitada"){
      this.addHistoricoDivida(id,"quitada","Quitada — pagamento total",pago);
      if(d.contaFixaId){
        const c=this.data.contasFixas.find(x=>x.id===d.contaFixaId);
        if(c&&!c.pago)this.update("contasFixas","ContasFixas",c.id,{pago:true,dataPagamento:Utils.todayISO(),horaPagamento:new Date().toLocaleTimeString("pt-BR")});
      }
    }
  },
  dividaStats(){
    const ativas=this.data.dividas.filter(d=>d.status!=="quitada");
    const atraso=ativas.filter(d=>d.status==="em_atraso");
    const negoc=ativas.filter(d=>d.status==="negociada"||d.status==="parcelada");
    const quit=this.data.dividas.filter(d=>d.status==="quitada");
    return{
      ativas,atraso,negoc,quitadas:quit,
      totalAberto:ativas.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalAtraso:atraso.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalNegoc:negoc.reduce((s,d)=>s+Number(d.valorRestante||0),0),
      totalQuitado:quit.reduce((s,d)=>s+Number(d.valorOriginal||0),0),
      maior:[...ativas].sort((a,b)=>Number(b.valorRestante||0)-Number(a.valorRestante||0))[0]||null,
    };
  },
  diasAtraso(d){
    if(!d.dataVencimento)return 0;
    const due=new Date(d.dataVencimento);due.setHours(0,0,0,0);
    const now=new Date();now.setHours(0,0,0,0);
    return Math.max(0,Math.floor((now-due)/86400000));
  },

  // ═══════════════ PARCELAMENTOS ═══════════════
  getInstallmentForMonth(p,mk){
    const total=Number(p.qtdTotal)||1,df=(p.dataFinal||"").slice(0,7);
    if(!df)return Number(p.parcelaAtual)||1;
    const [ey,em]=df.split("-").map(Number);
    const st=new Date(ey,em-1-(total-1),1);
    const [my,mm]=mk.split("-").map(Number);
    return Math.max(1,Math.min(total,(my-st.getFullYear())*12+(mm-st.getMonth()-1)+1));
  },
  parcPagoKey(id,mk){return`${id}_${mk}`;},
  isParcelamentoPago(id,mk){return!!this.parcelamentosPagos[this.parcPagoKey(id,mk)]?.pago;},
  toggleParcelamentoPago(id,mk){
    const k=this.parcPagoKey(id,mk),pago=!this.parcelamentosPagos[k]?.pago;
    if(pago)this.parcelamentosPagos[k]={pago:true,data:Utils.todayISO()};
    else delete this.parcelamentosPagos[k];
    this.saveLocal();return pago;
  },

  // ═══════════════ FILA ═══════════════
  queueChange(sheet,op,data){
    const user=typeof App!=="undefined"?App.currentUser:"Sistema";
    this.queue.push({sheet,op,data,user,ts:Date.now()});
    this.saveLocal();this.flushQueue();
  },
  async flushQueue(){
    if(this.syncing||!API.isConfigured()||!this.queue.length)return;
    this.syncing=true;
    while(this.queue.length){
      const item=this.queue[0];
      const res=await API.send(item.sheet,item.op,item.data,item.user);
      if(!res||res.ok===false)break;
      this.queue.shift();this.saveLocal();
    }
    this.syncing=false;
  },

  // ═══════════════ CRUD ═══════════════
  add(col,sheet,record){
    record.id=record.id||Utils.uid(col.slice(0,3));
    record.criadoPor=typeof App!=="undefined"?App.currentUser:"Sistema";
    this.data[col].push(record);this.saveLocal();this.queueChange(sheet,"create",record);
    return record;
  },
  update(col,sheet,id,patch){
    const i=this.data[col].findIndex(r=>r.id===id);if(i===-1)return null;
    const before={...this.data[col][i]};
    this.data[col][i]={...before,...patch};
    this.saveLocal();this.queueChange(sheet,"update",this.data[col][i]);
    this.logChange(sheet,id,before,this.data[col][i]);
    return this.data[col][i];
  },
  remove(col,sheet,id){
    this.data[col]=this.data[col].filter(r=>r.id!==id);
    this.saveLocal();this.queueChange(sheet,"delete",{id});
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

  // ═══════════════ CONSULTAS ═══════════════
  monthDespesas(mk)  {return this.data.despesas.filter(d=>Utils.monthKey(d.data)===mk);},
  monthReceitas(mk)  {return this.data.receitas.filter(r=>Utils.monthKey(r.data)===mk);},
  monthFixedBills(mk){return this.data.contasFixas.filter(c=>c.mesReferencia===mk);},
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
  monthInvestimentos(){return this.data.investimentos.filter(i=>i.ativo!==false&&Number(i.aportesMensal||0)>0);},
  sum(list){return list.reduce((s,x)=>s+(Number(x.valor)||0),0);},
};
