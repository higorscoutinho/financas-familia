/* =========================================================
   actions.js
   MUDANÇAS: metas→investimentos, limparDividasAutomaticas,
   registrarAporteInvestimento
   ========================================================= */

const Actions = {

  payFixedBill(id) {
    const item = Store.data.contasFixas.find(c=>c.id===id); if(!item)return;
    const pago = !item.pago;
    Store.update("contasFixas","ContasFixas",id,{
      pago, dataPagamento:pago?Utils.todayISO():"", horaPagamento:pago?new Date().toLocaleTimeString("pt-BR"):"",
    });
    const dv = Store.data.dividas.find(d=>d.contaFixaId===id);
    if(dv){
      if(pago){
        Store.update("dividas","Dividas",dv.id,{status:"quitada",valorPago:dv.valorOriginal,valorRestante:0});
        Store.addHistoricoDivida(dv.id,"quitada","Conta paga — dívida encerrada",dv.valorOriginal);
        Utils.toast("Conta paga e dívida encerrada ✓");
      } else {
        Store.update("dividas","Dividas",dv.id,{status:"em_atraso",valorPago:0,valorRestante:dv.valorOriginal});
        Utils.toast("Pagamento desfeito");
      }
    } else {
      Utils.toast(pago?"Conta paga ✓":"Pagamento desfeito");
    }
    Pages.render(App.currentPage);
  },

  moveFixaToMonth(id,mk){
    if(!mk)return;
    const item=Store.data.contasFixas.find(c=>c.id===id); if(!item)return;
    if(Store.data.contasFixas.some(c=>c.nome===item.nome&&c.mesReferencia===mk&&c.id!==id)){
      Utils.toast(`"${item.nome}" já existe em ${Utils.monthLabel(mk)}`); return;
    }
    Store.update("contasFixas","ContasFixas",id,{mesReferencia:mk,pago:false,dataPagamento:"",horaPagamento:""});
    Utils.toast(`Conta movida para ${Utils.monthLabel(mk)}`);
    Pages.render(App.currentPage);
  },

  toggleParcelamentoPago(id){
    const pago=Store.toggleParcelamentoPago(id,App.selectedMonth);
    Utils.toast(pago?"Parcela paga ✓":"Marcação desfeita");
    Pages.render(App.currentPage);
  },

  // ── Dívidas ───────────────────────────────────────────
  registrarPagamentoDivida(dividaId,valor,data,obs){
    const dv=Store.data.dividas.find(d=>d.id===dividaId); if(!dv)return;
    const p={id:Utils.uid("pag"),dividaId,valor:Number(valor)||0,data:data||Utils.todayISO(),obs:obs||"",criadoPor:App.currentUser};
    Store.data.pagamentosDividas.push(p); Store.saveLocal();
    Store.queueChange("PagamentosDividas","create",p);
    Store.addHistoricoDivida(dividaId,"pagamento","Pagamento registrado",p.valor);
    Store.recalcularDivida(dividaId);
    Utils.toast(`Pagamento de ${Utils.brl(p.valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  negociarDivida(dividaId,dados){
    const dv=Store.data.dividas.find(d=>d.id===dividaId); if(!dv)return;
    const n={id:Utils.uid("neg"),dividaId,valorOriginal:Number(dados.valorOriginal)||dv.valorAtual,
      valorNegociado:Number(dados.valorNegociado)||dv.valorAtual,
      economia:Number(dados.valorOriginal)-Number(dados.valorNegociado),
      numeroParcelas:Number(dados.numeroParcelas)||1,valorParcela:Number(dados.valorParcela)||0,
      dataNegociacao:dados.dataNegociacao||Utils.todayISO(),obs:dados.obs||""};
    Store.data.negociacoesDividas.push(n);
    Store.update("dividas","Dividas",dividaId,{valorAtual:n.valorNegociado,
      valorRestante:Math.max(0,n.valorNegociado-Number(dv.valorPago||0)),
      status:n.numeroParcelas>1?"parcelada":"negociada"});
    Store.saveLocal(); Store.queueChange("NegociacoesDividas","create",n);
    Store.addHistoricoDivida(dividaId,"negociacao",`Negociada: ${Utils.brl(n.valorOriginal)}→${Utils.brl(n.valorNegociado)}`,n.valorNegociado);
    Utils.toast(`Economia de ${Utils.brl(n.economia)} ✓`);
    Pages.render(App.currentPage);
  },

  quitarDivida(id){
    const dv=Store.data.dividas.find(d=>d.id===id); if(!dv)return;
    if(!confirm(`Marcar "${dv.nome}" como quitada?`))return;
    Store.update("dividas","Dividas",id,{status:"quitada",valorPago:dv.valorAtual,valorRestante:0});
    Store.addHistoricoDivida(id,"quitada","Quitada manualmente",dv.valorAtual);
    if(dv.contaFixaId){const c=Store.data.contasFixas.find(x=>x.id===dv.contaFixaId);
      if(c&&!c.pago)Store.update("contasFixas","ContasFixas",c.id,{pago:true,dataPagamento:Utils.todayISO(),horaPagamento:new Date().toLocaleTimeString("pt-BR")});}
    Utils.toast("Dívida quitada ✓"); Pages.render(App.currentPage);
  },

  // Remove dívidas que foram geradas automaticamente (limpeza inicial)
  limparDividasAutomaticas(){
    const auto=Store.data.dividas.filter(d=>d.origem==="conta");
    if(!auto.length){Utils.toast("Nenhuma dívida automática encontrada");return;}
    if(!confirm(`Remover ${auto.length} dívida(s) gerada(s) automaticamente de contas fixas?`))return;
    auto.forEach(d=>Store.remove("dividas","Dividas",d.id));
    Utils.toast(`${auto.length} dívida(s) removida(s) ✓`);
    Pages.render(App.currentPage);
  },

  // Remove fixas de meses anteriores ao início do sistema
  limparFixasAntigas(){
    const inicio=Store.data.configuracoes.dataInicioSistema||"2026-08";
    const antigas=Store.data.contasFixas.filter(c=>(c.mesReferencia||"")< inicio);
    if(!antigas.length){Utils.toast("Nenhuma conta fixa anterior encontrada");return;}
    if(!confirm(`Remover ${antigas.length} conta(s) fixa(s) anteriores a ${Utils.monthLabel(inicio)}?`))return;
    antigas.forEach(c=>Store.remove("contasFixas","ContasFixas",c.id));
    Utils.toast(`${antigas.length} conta(s) removida(s) ✓`);
    Pages.render(App.currentPage);
  },

  // ── Investimentos ─────────────────────────────────────
  registrarAporteInvestimento(id,valor){
    const inv=Store.data.investimentos.find(i=>i.id===id); if(!inv)return;
    const novo=Math.max(0,(Number(inv.valorAtual)||0)+Number(valor||0));
    Store.update("investimentos","Investimentos",id,{valorAtual:novo});
    Utils.toast(`Aporte de ${Utils.brl(valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  // ── Notas ─────────────────────────────────────────────
  saveNota(dados){
    const existe=dados.id?Store.data.notas.find(n=>n.id===dados.id):null;
    if(existe){Store.update("notas","Notas",existe.id,{titulo:dados.titulo,conteudo:dados.conteudo,cor:dados.cor,atualizadoEm:Utils.todayISO()}); Utils.toast("Nota atualizada ✓");}
    else{Store.add("notas","Notas",{titulo:dados.titulo,conteudo:dados.conteudo,cor:dados.cor||"#FFF9C4",criadoEm:Utils.todayISO(),atualizadoEm:Utils.todayISO()}); Utils.toast("Nota criada ✓");}
    Pages.render(App.currentPage);
  },

  removeNota(id){
    if(!confirm("Excluir esta nota?"))return;
    Store.remove("notas","Notas",id); Utils.toast("Nota removida");
    Pages.render(App.currentPage);
  },

  remove(col,sheet,id){
    if(!confirm("Excluir este registro?"))return;
    Store.remove(col,sheet,id); Utils.toast("Removido");
    Pages.render(App.currentPage);
  },

  addCategory(){
    const input=document.getElementById("new-cat"), val=input.value.trim();
    if(!val)return;
    if(Store.data.categorias.includes(val)){Utils.toast("Já existe");return;}
    Store.data.categorias.push(val); Store.saveLocal();
    Store.queueChange("Categorias","create",{nome:val});
    input.value=""; Pages.renderCategoryChips(); Utils.toast("Categoria adicionada ✓");
  },

  saveConfig(){
    const meta   = Number(document.getElementById("cfg-meta")?.value)||0;
    const inicio = document.getElementById("cfg-inicio")?.value||"2026-08";
    Store.data.configuracoes.metaEconomiaMensal=meta;
    Store.data.configuracoes.dataInicioSistema=inicio;
    Store.saveLocal();
    Store.queueChange("Configuracoes","update",{metaEconomiaMensal:meta,dataInicioSistema:inicio});
    Utils.toast("Configurações salvas ✓");
  },

  exportCSV(){
    const mk=App.selectedMonth;
    const rows=[["Tipo","Nome","Categoria","Valor","Data","Status","Detalhe"]];
    Store.monthReceitas(mk).forEach(r=>rows.push(["Receita",r.nome,r.categoria,r.valor,r.data,"",""]));
    Store.monthDespesas(mk).forEach(d=>rows.push(["Despesa",d.nome,d.categoria,d.valor,d.data,"",d.formaPagamento||""]));
    Store.monthFixedBills(mk).forEach(f=>rows.push(["Conta Fixa",f.nome,f.categoria,f.valor,f.dataPagamento||"",f.pago?"Pago":"Não pago",`Dia ${f.diaVencimento}`]));
    Store.monthParcelamentos(mk).forEach(p=>rows.push(["Parcelamento",p.nome,"Parcelamento",p.valorParcela,p.dataFinal,Store.isParcelamentoPago(p.id,mk)?"Pago":"",`${Store.getInstallmentForMonth(p,mk)}/${p.qtdTotal}`]));
    Store.monthInvestimentos().forEach(i=>rows.push(["Investimento",i.nome,"Investimento",i.aportesMensal,"","","Aporte mensal"]));
    const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`financas-${mk}.csv`; a.click();
    URL.revokeObjectURL(url); Utils.toast("CSV exportado ✓");
  },
};
