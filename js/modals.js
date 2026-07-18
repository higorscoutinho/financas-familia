const Modals={
  closeAll(){
    document.getElementById("modal-backdrop").classList.remove("active");
    document.getElementById("modal-root").innerHTML="";
  },
  open(title,bodyHtml,onSubmit){
    document.getElementById("modal-root").innerHTML=`
      <div class="modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="Modals.closeAll()">✕</button>
        </div>
        <form class="modal-body" id="modal-form">${bodyHtml}
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="Modals.closeAll()">Cancelar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>`;
    document.getElementById("modal-backdrop").classList.add("active");
    document.getElementById("modal-form").onsubmit=e=>{e.preventDefault();onSubmit(new FormData(e.target));};
  },
  catOpts(sel){
    return Store.data.categorias.map(c=>`<option value="${c}" ${c===sel?"selected":""}>${c}</option>`).join("");
  },
  openQuickAdd(){
    document.getElementById("modal-root").innerHTML=`
      <div class="modal">
        <div class="modal-header"><h2>Adicionar</h2><button class="modal-close" onclick="Modals.closeAll()">✕</button></div>
        <div class="modal-body">
          <button class="btn btn-primary" style="justify-content:flex-start;" onclick="Modals.openDespesa()">💸 Nova Despesa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openReceita()">💰 Nova Receita</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openFixa()">📌 Nova Conta Fixa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openParcelamento()">📦 Novo Parcelamento</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openInvestimento()">📈 Novo Investimento</button>
          <button class="btn btn-danger" style="justify-content:flex-start;" onclick="Modals.openDivida()">🔴 Nova Dívida</button>
        </div>
      </div>`;
    document.getElementById("modal-backdrop").classList.add("active");
  },

  openDespesa(id){
    const item=id?Store.data.despesas.find(d=>d.id===id):null;
    this.open(item?"Editar Despesa":"Nova Despesa",`
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.catOpts(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Forma de pagamento</label>
          <select name="formaPagamento">${["Pix","Dinheiro","Débito","Crédito","Transferência"].map(f=>`<option ${item?.formaPagamento===f?"selected":""}>${f}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data||Utils.todayISO()}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `,fd=>{
      const d=Object.fromEntries(fd.entries());
      if(item)Store.update("despesas","Despesas",item.id,d);else Store.add("despesas","Despesas",d);
      Utils.toast("Despesa salva ✓");Modals.closeAll();Pages.render(App.currentPage);
    });
  },

  openReceita(id){
    const item=id?Store.data.receitas.find(d=>d.id===id):null;
    this.open(item?"Editar Receita":"Nova Receita",`
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Tipo</label>
          <select name="categoria">${["Salário","Freela","PIX recebido","13º","Bonificação","Outros"].map(f=>`<option ${item?.categoria===f?"selected":""}>${f}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data||Utils.todayISO()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `,fd=>{
      const d=Object.fromEntries(fd.entries());
      if(item)Store.update("receitas","Receitas",item.id,d);else Store.add("receitas","Receitas",d);
      Utils.toast("Receita salva ✓");Modals.closeAll();Pages.render(App.currentPage);
    });
  },

  openFixa(id){
    const item=id?Store.data.contasFixas.find(c=>c.id===id):null;
    this.open(item?"Editar Conta Fixa":"Nova Conta Fixa",`
      <div class="notice-bar" style="margin-bottom:12px;">
        ${item
          ? `✏️ Alterações aplicadas a partir de <strong>${Utils.monthLabel(item.mesReferencia)}</strong> — meses não pagos serão atualizados.`
          : `📌 Criada em <strong>${Utils.monthLabel(App.selectedMonth)}</strong> e repetida automaticamente nos meses seguintes.`}
      </div>
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus placeholder="Ex: Aluguel, Internet..."></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.catOpts(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" min="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field">
        <label>Dia do vencimento</label>
        <input name="diaVencimento" type="number" min="1" max="31" required value="${item?.diaVencimento||""}">
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `,fd=>{
      const dados=Object.fromEntries(fd.entries());
      Actions.salvarContaFixa(dados, id||null);
      Modals.closeAll();
    });
  },

  openParcelamento(id){
    const item=id?Store.data.parcelamentos.find(d=>d.id===id):null;
    this.open(item?"Editar Parcelamento":"Novo Parcelamento",`
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Valor da parcela (R$)</label><input name="valorParcela" type="number" step="0.01" required value="${item?.valorParcela||""}"></div>
        <div class="field"><label>Total de parcelas</label><input name="qtdTotal" type="number" min="1" required value="${item?.qtdTotal||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Parcela atual</label><input name="parcelaAtual" type="number" min="1" required value="${item?.parcelaAtual||1}"></div>
        <div class="field"><label>Data final</label><input name="dataFinal" type="date" value="${item?.dataFinal||""}"></div>
      </div>
    `,fd=>{
      const d=Object.fromEntries(fd.entries());
      d.valorRestante=(Number(d.qtdTotal)-Number(d.parcelaAtual)+1)*Number(d.valorParcela);
      if(item)Store.update("parcelamentos","Parcelamentos",item.id,d);else Store.add("parcelamentos","Parcelamentos",d);
      Utils.toast("Parcelamento salvo ✓");Modals.closeAll();Pages.render(App.currentPage);
    });
  },

  openInvestimento(id){
    const item=id?Store.data.investimentos.find(d=>d.id===id):null;
    this.open(item?"Editar Investimento":"Novo Investimento",`
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" placeholder="Ex: Reserva de emergência" autofocus></div>
      <div class="field"><label>Descrição</label><input name="descricao" value="${item?.descricao||""}" placeholder="Objetivo"></div>
      <div class="field-row">
        <div class="field"><label>Meta (R$)</label><input name="valorAlvo" type="number" step="0.01" required value="${item?.valorAlvo||""}"></div>
        <div class="field"><label>Guardado até agora (R$)</label><input name="valorAtual" type="number" step="0.01" value="${item?.valorAtual||0}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Aporte mensal (R$)</label><input name="aportesMensal" type="number" step="0.01" value="${item?.aportesMensal||0}">
          <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">Entra nas "Contas do mês" no dashboard</div>
        </div>
        <div class="field"><label>Data limite</label><input name="dataLimite" type="date" value="${item?.dataLimite||""}"></div>
      </div>
    `,fd=>{
      const d=Object.fromEntries(fd.entries());d.ativo=true;
      if(item)Store.update("investimentos","Investimentos",item.id,d);else Store.add("investimentos","Investimentos",d);
      Utils.toast("Investimento salvo ✓");Modals.closeAll();Pages.render(App.currentPage);
    });
  },

  openAporteInvestimento(id){
    const inv=Store.data.investimentos.find(i=>i.id===id);if(!inv)return;
    this.open(`Registrar aporte — ${inv.nome}`,`
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Guardado até agora</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-positive);">${Utils.brl(inv.valorAtual||0)}</div>
        <div style="font-size:12px;color:var(--color-text-muted);">Meta: ${Utils.brl(inv.valorAlvo)}</div>
      </div>
      <div class="field"><label>Valor do aporte (R$)</label><input name="valor" type="number" step="0.01" required autofocus></div>
    `,fd=>{
      Actions.registrarAporteInvestimento(id,Object.fromEntries(fd.entries()).valor);Modals.closeAll();
    });
  },

  openDivida(id){
    const item=id?Store.data.dividas.find(d=>d.id===id):null;
    const sts=[{v:"em_aberto",l:"Em aberto"},{v:"em_atraso",l:"Em atraso"},{v:"negociada",l:"Negociada"},{v:"parcelada",l:"Parcelada"},{v:"quitada",l:"Quitada"}];
    const prs=[{v:"alta",l:"Alta"},{v:"media",l:"Média"},{v:"baixa",l:"Baixa"}];
    this.open(item?"Editar Dívida":"Nova Dívida",`
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.catOpts(item?.categoria)}</select></div>
        <div class="field"><label>Credor</label><input name="credor" value="${item?.credor||""}" placeholder="Banco, pessoa..."></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor original (R$)</label><input name="valorOriginal" type="number" step="0.01" required value="${item?.valorOriginal||""}"></div>
        <div class="field"><label>Valor atual (R$)</label><input name="valorAtual" type="number" step="0.01" value="${item?.valorAtual||item?.valorOriginal||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Data de vencimento</label><input name="dataVencimento" type="date" value="${item?.dataVencimento||""}"></div>
        <div class="field"><label>Prioridade</label>
          <select name="prioridade">${prs.map(p=>`<option value="${p.v}" ${(item?.prioridade||"media")===p.v?"selected":""}>${p.l}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>Status</label>
        <select name="status">${sts.map(s=>`<option value="${s.v}" ${(item?.status||"em_aberto")===s.v?"selected":""}>${s.l}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `,fd=>{
      const d=Object.fromEntries(fd.entries());
      d.valorPago=item?.valorPago||0;
      d.valorRestante=Math.max(0,Number(d.valorAtual)-Number(d.valorPago));
      d.estaEmAtraso=d.status==="em_atraso";d.origem="manual";d.contaFixaId="";
      if(item){Store.update("dividas","Dividas",item.id,d);Store.addHistoricoDivida(item.id,"edicao","Editada",d.valorAtual);}
      else{d.criadoEm=Utils.todayISO();Store.add("dividas","Dividas",d);Store.addHistoricoDivida(d.id,"criada","Criada manualmente",d.valorOriginal);}
      Utils.toast("Dívida salva ✓");Modals.closeAll();Pages.render(App.currentPage);
    });
  },

  openPagamentoDivida(dividaId){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    const hist=Store.data.pagamentosDividas.filter(p=>p.dividaId===dividaId).slice(-4).reverse()
      .map(p=>`<div class="list-row"><div class="row-main"><div class="row-title">${Utils.fmtDateFull(p.data)}</div><div class="row-sub">${p.obs||""}</div></div><div class="row-amount pos">+${Utils.brl(p.valor)}</div></div>`).join("");
    this.open(`Registrar Pagamento — ${dv.nome}`,`
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Saldo restante</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-negative);">${Utils.brl(dv.valorRestante)}</div>
        <div style="font-size:12px;color:var(--color-text-muted);">Já pago: ${Utils.brl(dv.valorPago||0)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required autofocus></div>
        <div class="field"><label>Data</label><input name="data" type="date" value="${Utils.todayISO()}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2"></textarea></div>
      ${hist?`<div style="margin-top:8px;font-size:11px;font-weight:700;color:var(--color-text-muted);">ÚLTIMOS PAGAMENTOS</div>${hist}`:""}
    `,fd=>{
      const d=Object.fromEntries(fd.entries());
      Actions.registrarPagamentoDivida(dividaId,d.valor,d.data,d.obs);Modals.closeAll();
    });
  },

  openNegociacaoDivida(dividaId){
    const dv=Store.data.dividas.find(d=>d.id===dividaId);if(!dv)return;
    this.open(`Negociar — ${dv.nome}`,`
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Valor atual</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-negative);">${Utils.brl(dv.valorAtual)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor original (R$)</label><input name="valorOriginal" type="number" step="0.01" value="${dv.valorAtual}" required></div>
        <div class="field"><label>Valor negociado (R$)</label><input name="valorNegociado" type="number" step="0.01" required autofocus></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Nº de parcelas</label><input name="numeroParcelas" type="number" min="1" value="1"></div>
        <div class="field"><label>Valor por parcela (R$)</label><input name="valorParcela" type="number" step="0.01"></div>
      </div>
      <div class="field"><label>Data da negociação</label><input name="dataNegociacao" type="date" value="${Utils.todayISO()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2"></textarea></div>
    `,fd=>{
      Actions.negociarDivida(dividaId,Object.fromEntries(fd.entries()));Modals.closeAll();
    });
  },

  openNota(id){
    const item=id?Store.data.notas.find(n=>n.id===id):null;
    const cores=["#FFF9C4","#C8E6C9","#BBDEFB","#F8BBD0","#FFE0B2","#E1BEE7","#B2EBF2","#DCEDC8"];
    const corAtual=item?.cor||"#FFF9C4";
    const picker=cores.map(c=>`<button type="button" class="cor-btn ${c===corAtual?"selected":""}" data-cor="${c}" style="background:${c}"
      onclick="this.closest('form').querySelector('[name=cor]').value='${c}';this.closest('.cor-picker').querySelectorAll('.cor-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')"></button>`).join("");
    this.open(item?"Editar nota":"Nova nota",`
      <div class="field"><label>Título</label><input name="titulo" value="${item?.titulo||""}" placeholder="Título da nota" autofocus></div>
      <div class="field"><label>Conteúdo</label><textarea name="conteudo" rows="5" placeholder="Escreva aqui...">${item?.conteudo||""}</textarea></div>
      <div class="field"><label>Cor</label><div class="cor-picker">${picker}</div><input type="hidden" name="cor" value="${corAtual}"></div>
      ${id?`<input type="hidden" name="id" value="${id}">`:""}
    `,fd=>{
      Actions.saveNota(Object.fromEntries(fd.entries()));Modals.closeAll();
    });
  },
};
