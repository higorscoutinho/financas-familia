const Actions={

  // ═══ CONTAS FIXAS ════════════════════════════════════════

  salvarContaFixa(dados,editId){
    if(editId){
      Store.editarContaFixa(editId,{nome:dados.nome,categoria:dados.categoria,valor:dados.valor,diaVencimento:dados.diaVencimento,obs:dados.obs||""});
      Utils.toast("Conta atualizada ✓");
    }else{
      Store.criarContaFixa({nome:dados.nome,categoria:dados.categoria,valor:dados.valor,diaVencimento:dados.diaVencimento,obs:dados.obs||""});
      Utils.toast("Conta fixa criada ✓");
    }
    App.goTo("fixas");
  },

  excluirContaFixa(id){
    const item=Store.data.contasFixas.find(c=>c.id===id);if(!item)return;
    if(!confirm(`Excluir "${item.nome}" deste mês em diante?\nMeses já pagos permanecem.`))return;
    Store.excluirContaFixa(id);
    Utils.toast("Excluída deste mês em diante ✓");
    Pages.render(App.currentPage);
  },

  moveFixaToMonth(id,novoMk){
    if(!novoMk||!id)return;
    const item=Store.data.contasFixas.find(c=>c.id===id);if(!item)return;
    const mk=novoMk.slice(0,7);
    const jaExiste=Store.data.contasFixas.some(c=>c.grupoId===item.grupoId&&Store._normMk(c.mesReferencia)===mk&&c.id!==id);
    if(jaExiste){Utils.toast(`Já existe em ${Utils.monthLabel(mk)}`);return;}
    Store.update("contasFixas","ContasFixas",id,{mesReferencia:mk,pago:false,dataPagamento:"",horaPagamento:""});
    Utils.toast(`Conta movida para ${Utils.monthLabel(mk)}`);
    Pages.render(App.currentPage);
  },

  // payFixedBill — sem lógica de investimento (removida)
  payFixedBill(id){
    const item=Store.data.contasFixas.find(c=>c.id===id);if(!item)return;
    const pago=!item.pago;
    Store.update("contasFixas","ContasFixas",id,{
      pago,
      dataPagamento:pago?Utils.todayISO():"",
      horaPagamento:pago?new Date().toLocaleTimeString("pt-BR"):"",
    });
    const dv=Store.data.dividas.find(d=>d.contaFixaId===id&&d.status!=="quitada");
    if(dv){
      if(pago){
        Store.update("dividas","Dividas",dv.id,{status:"quitada",valorPago:dv.valorOriginal,valorRestante:0});
        Store.addHistoricoDivida(dv.id,"quitada","Conta paga",dv.valorOriginal);
      }else{
        Store.update("dividas","Dividas",dv.id,{status:"em_atraso",valorPago:0,valorRestante:dv.valorOriginal});
      }
    }
    Utils.toast(pago?"Pago ✓":"Pagamento desfeito");
    Pages.render(App.currentPage);
  },

  // ═══ PARCELAMENTOS ════════════════════════════════════════

  toggleParcelamentoPago(id){
    const pago=Store.toggleParcelamentoPago(id,App.selectedMonth);
    Utils.toast(pago?"Parcela paga ✓":"Marcação desfeita");
    Pages.render(App.currentPage);
  },

  // ═══ DÍVIDAS ══════════════════════════════════════════════

  registrarPagamentoDivida(dividaId,valor,data,obs){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    const p={id:Utils.uid("pag"),dividaId,valor:Number(valor)||0,data:data||Utils.todayISO(),obs:obs||"",criadoPor:App.currentUser};
    Store.data.pagamentosDividas.push(p);Store.saveLocal();
    Store.queueChange("PagamentosDividas","create",p);
    Store.addHistoricoDivida(dividaId,"pagamento","Pagamento registrado",p.valor);
    Store.recalcularDivida(dividaId);
    Utils.toast(`Pagamento de ${Utils.brl(p.valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  negociarDivida(dividaId,dados){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    const n={id:Utils.uid("neg"),dividaId,
      valorOriginal:Number(dados.valorOriginal)||dv.valorAtual,
      valorNegociado:Number(dados.valorNegociado)||dv.valorAtual,
      economia:Number(dados.valorOriginal)-Number(dados.valorNegociado),
      numeroParcelas:Number(dados.numeroParcelas)||1,
      valorParcela:Number(dados.valorParcela)||0,
      dataNegociacao:dados.dataNegociacao||Utils.todayISO(),obs:dados.obs||""};
    Store.data.negociacoesDividas.push(n);
    Store.update("dividas","Dividas",dividaId,{valorAtual:n.valorNegociado,valorRestante:Math.max(0,n.valorNegociado-Number(dv.valorPago||0)),status:n.numeroParcelas>1?"parcelada":"negociada"});
    Store.saveLocal();Store.queueChange("NegociacoesDividas","create",n);
    Store.addHistoricoDivida(dividaId,"negociacao",`Negociada: ${Utils.brl(n.valorOriginal)}→${Utils.brl(n.valorNegociado)}`,n.valorNegociado);
    Utils.toast(`Economia de ${Utils.brl(n.economia)} ✓`);
    Pages.render(App.currentPage);
  },

  parcelarDivida(dividaId,dados){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    const qtd=Number(dados.qtdTotal)||1;
    const valor=Number(dados.valorParcela)||0;
    const mesInicio=dados.mesInicio||Utils.currentMonthKey();
    const[y,m]=mesInicio.split("-").map(Number);
    const endDate=new Date(y,m-1+qtd-1,1);
    const dataFinal=`${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,"0")}-28`;
    Store.add("parcelamentos","Parcelamentos",{
      nome:dv.nome,valorParcela:valor,qtdTotal:qtd,parcelaAtual:1,
      valorRestante:(qtd-1)*valor,dataFinal,
      diaVencimento:Number(dados.diaVencimento)||10,
    });
    Store.update("dividas","Dividas",dividaId,{status:"parcelada"});
    Store.addHistoricoDivida(dividaId,"negociacao",`Parcelada em ${qtd}x de ${Utils.brl(valor)}`,valor*qtd);
    Utils.toast(`Parcelamento criado: ${qtd}x de ${Utils.brl(valor)} ✓`);
    Pages.render(App.currentPage);
  },

  quitarDivida(id){
    const dv=Store.data.dividas.find(d=>d.id===id);if(!dv)return;
    if(!confirm(`Marcar "${dv.nome}" como quitada?`))return;
    Store.update("dividas","Dividas",id,{status:"quitada",valorPago:dv.valorAtual,valorRestante:0});
    Store.addHistoricoDivida(id,"quitada","Quitada manualmente",dv.valorAtual);
    if(dv.contaFixaId){const c=Store.data.contasFixas.find(x=>x.id===dv.contaFixaId);if(c&&!c.pago)Store.update("contasFixas","ContasFixas",c.id,{pago:true,dataPagamento:Utils.todayISO(),horaPagamento:new Date().toLocaleTimeString("pt-BR")});}
    Utils.toast("Dívida quitada ✓");Pages.render(App.currentPage);
  },

  excluirDivida(id){
    const dv=Store.data.dividas.find(d=>d.id===id);if(!dv)return;
    if(!confirm(`Excluir a dívida "${dv.nome}"?\nHistórico de pagamentos também será removido.`))return;
    Store.data.pagamentosDividas=Store.data.pagamentosDividas.filter(p=>p.dividaId!==id);
    Store.data.historicoDividas=Store.data.historicoDividas.filter(h=>h.dividaId!==id);
    Store.data.negociacoesDividas=Store.data.negociacoesDividas.filter(n=>n.dividaId!==id);
    Store.remove("dividas","Dividas",id);
    Utils.toast("Dívida excluída");Pages.render(App.currentPage);
  },

  // ═══ INVESTIMENTOS ════════════════════════════════════════
  // Aporte avulso (manual) — apenas registra no valorAtual

  registrarAporteInvestimento(id,valor){
    const inv=Store.data.investimentos.find(i=>i.id===id);if(!inv)return;
    Store.update("investimentos","Investimentos",id,{valorAtual:Math.max(0,(Number(inv.valorAtual)||0)+Number(valor||0))});
    Utils.toast(`Aporte de ${Utils.brl(valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  // ═══ SINCRONIZAÇÃO ════════════════════════════════════════

  async syncSheets(){
    if(!API.isConfigured()){Utils.toast("Google Sheets não configurado");return;}
    Utils.toast("Sincronizando...");
    await Store.flushQueue();
    const remote=await API.getAll();
    if(remote){
      const inv=remote.investimentos||remote.metas||[];
      Store.data={
        receitas:          Store._merge(remote.receitas,                           Store.data.receitas),
        despesas:          Store._merge(remote.despesas,                           Store.data.despesas),
        contasFixas:       Store._merge(Store._normalizeFixas(remote.contasFixas), Store.data.contasFixas),
        parcelamentos:     Store._merge(remote.parcelamentos,                      Store.data.parcelamentos),
        categorias:
