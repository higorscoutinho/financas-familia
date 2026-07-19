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

  payFixedBill(id){
    const item=Store.data.contasFixas.find(c=>c.id===id);if(!item)return;
    const pago=!item.pago;
    Store.update("contasFixas","ContasFixas",id,{pago,dataPagamento:pago?Utils.todayISO():"",horaPagamento:pago?new Date().toLocaleTimeString("pt-BR"):""});
    const dv=Store.data.dividas.find(d=>d.contaFixaId===id&&d.status!=="quitada");
    if(dv){
      if(pago){Store.update("dividas","Dividas",dv.id,{status:"quitada",valorPago:dv.valorOriginal,valorRestante:0});Store.addHistoricoDivida(dv.id,"quitada","Conta paga",dv.valorOriginal);}
      else Store.update("dividas","Dividas",dv.id,{status:"em_atraso",valorPago:0,valorRestante:dv.valorOriginal});
    }
    Utils.toast(pago?"Pago ✓":"Pagamento desfeito");
    Pages.render(App.currentPage);
  },

  // ═══ PARCELAMENTOS ═══════════════════════════════════════

  toggleParcelamentoPago(id){
    const pago=Store.toggleParcelamentoPago(id,App.selectedMonth);
    Utils.toast(pago?"Parcela paga ✓":"Marcação desfeita");
    Pages.render(App.currentPage);
  },

  // ═══ DÍVIDAS ═════════════════════════════════════════════

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

  // Parcelar dívida: cria um Parcelamento automático + atualiza dívida
  parcelarDivida(dividaId,dados){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    const qtd=Number(dados.qtdTotal)||1;
    const valor=Number(dados.valorParcela)||0;
    const mesInicio=dados.mesInicio||Utils.currentMonthKey();
    // Calcula data final
    const [y,m]=mesInicio.split("-").map(Number);
    const endDate=new Date(y,m-1+qtd-1,1);
    const dataFinal=`${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,"0")}-28`;
    // Cria parcelamento
    Store.add("parcelamentos","Parcelamentos",{
      nome:dv.nome,valorParcela:valor,qtdTotal:qtd,
      parcelaAtual:1,valorRestante:(qtd-1)*valor,dataFinal,
    });
    // Atualiza dívida
    Store.update("dividas","Dividas",dividaId,{status:"parcelada"});
    Store.addHistoricoDivida(dividaId,"negociacao",`Parcelada em ${qtd}x de ${Utils.brl(valor)} a partir de ${Utils.monthLabel(mesInicio)}`,valor*qtd);
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

  // Excluir dívida com confirmação
  excluirDivida(id){
    const dv=Store.data.dividas.find(d=>d.id===id);if(!dv)return;
    if(!confirm(`Excluir a dívida "${dv.nome}"?\nTodo o histórico de pagamentos será removido. Esta ação não pode ser desfeita.`))return;
    // Remove pagamentos e histórico vinculados
    Store.data.pagamentosDividas=Store.data.pagamentosDividas.filter(p=>p.dividaId!==id);
    Store.data.historicoDividas=Store.data.historicoDividas.filter(h=>h.dividaId!==id);
    Store.data.negociacoesDividas=Store.data.negociacoesDividas.filter(n=>n.dividaId!==id);
    Store.remove("dividas","Dividas",id);
    Utils.toast("Dívida excluída");
    Pages.render(App.currentPage);
  },

  // ═══ INVESTIMENTOS ═══════════════════════════════════════

  registrarAporteInvestimento(id,valor){
    const inv=Store.data.investimentos.find(i=>i.id===id);if(!inv)return;
    Store.update("investimentos","Investimentos",id,{valorAtual:Math.max(0,(Number(inv.valorAtual)||0)+Number(valor||0))});
    Utils.toast(`Aporte de ${Utils.brl(valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  // ═══ TEMA ════════════════════════════════════════════════

  toggleTheme(btn){
    const cur=document.documentElement.getAttribute("data-theme");
    const next=cur==="dark"?"light":"dark";
    document.documentElement.setAttribute("data-theme",next);
    localStorage.setItem(LS_THEME,next);
    if(btn)btn.textContent=next==="dark"?"☀️ Mudar para tema claro":"🌙 Mudar para tema escuro";
  },

  // ═══ NOTAS ═══════════════════════════════════════════════

  saveNota(dados){
    const existe=dados.id?Store.data.notas.find(n=>n.id===dados.id):null;
    if(existe){Store.update("notas","Notas",existe.id,{titulo:dados.titulo,conteudo:dados.conteudo,cor:dados.cor,atualizadoEm:Utils.todayISO()});Utils.toast("Nota atualizada ✓");}
    else{Store.add("notas","Notas",{titulo:dados.titulo,conteudo:dados.conteudo,cor:dados.cor||"#FFF9C4",criadoEm:Utils.todayISO(),atualizadoEm:Utils.todayISO()});Utils.toast("Nota criada ✓");}
    Pages.render(App.currentPage);
  },
  removeNota(id){
    if(!confirm("Excluir esta nota?"))return;
    Store.remove("notas","Notas",id);Utils.toast("Nota removida");Pages.render(App.currentPage);
  },

  // ═══ GENÉRICO ════════════════════════════════════════════

  remove(col,sheet,id){
    if(!confirm("Excluir este registro?"))return;
    Store.remove(col,sheet,id);Utils.toast("Removido");Pages.render(App.currentPage);
  },
  addCategory(){
    const input=document.getElementById("new-cat"),val=input.value.trim();
    if(!val)return;
    if(Store.data.categorias.includes(val)){Utils.toast("Já existe");return;}
    Store.data.categorias.push(val);Store.saveLocal();Store.queueChange("Categorias","create",{nome:val});
    input.value="";Pages.renderCategoryChips();Utils.toast("Adicionada ✓");
  },
  saveConfig(){
    const meta=Number(document.getElementById("cfg-meta")?.value)||0;
    const inicio=document.getElementById("cfg-inicio")?.value||"2026-08";
    Store.data.configuracoes.metaEconomiaMensal=meta;Store.data.configuracoes.dataInicioSistema=inicio;
    Store.saveLocal();Store.queueChange("Configuracoes","update",{metaEconomiaMensal:meta,dataInicioSistema:inicio});
    Utils.toast("Configurações salvas ✓");
  },
  exportCSV(){
    const mk=App.selectedMonth;
    const rows=[["Tipo","Nome","Categoria","Valor","Data","Status","Detalhe"]];
    Store.monthReceitas(mk).forEach(r=>rows.push(["Receita",r.nome,r.categoria,r.valor,r.data,"",""]));
    Store.monthDespesas(mk).forEach(d=>rows.push(["Despesa",d.nome,d.categoria,d.valor,d.data,"",d.formaPagamento||""]));
    Store.monthFixedBills(mk).forEach(f=>rows.push(["Conta Fixa",f.nome,f.categoria,f.valor,f.dataPagamento||"",f.pago?"Pago":"Não pago",`Dia ${f.diaVencimento}`]));
    Store.monthParcelamentos(mk).forEach(p=>rows.push(["Parcelamento",p.nome,"Parcelamento",p.valorParcela,p.dataFinal,Store.isParcelamentoPago(p.id,mk)?"Pago":"",`${Store.getInstallmentForMonth(p,mk)}/${p.qtdTotal}`]));
    const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`financas-${mk}.csv`;a.click();
    Utils.toast("CSV exportado ✓");
  },
openParcelarDivida(dividaId){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    this.open(`Parcelar dívida — ${dv.nome}`,`
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Valor restante da dívida</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-negative);">${Utils.brl(dv.valorRestante)}</div>
        <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Origem: ${Utils.escapeHtml(dv.credor||dv.nome)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Número de parcelas</label><input name="qtdTotal" type="number" min="1" required autofocus placeholder="Ex: 12"></div>
        <div class="field"><label>Valor por parcela (R$)</label>
          <input name="valorParcela" type="number" step="0.01" required placeholder="Ex: 200"
            value="${dv.valorRestante>0?(dv.valorRestante/12).toFixed(2):""}">
        </div>
      </div>
      <div class="field"><label>Mês da 1ª parcela</label><input name="mesInicio" type="month" value="${Utils.currentMonthKey()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2" placeholder="Ex: Acordo com banco, desconto obtido..."></textarea></div>
      <div style="background:var(--color-accent-soft);border-radius:var(--radius-sm);padding:10px;font-size:13px;color:var(--color-accent);">
        💡 Um parcelamento será criado automaticamente e aparecerá em "Parcelamentos" a cada mês.
      </div>
    `,fd=>{
      Actions.parcelarDivida(dividaId,Object.fromEntries(fd.entries()));Modals.closeAll();
    });
  },};
