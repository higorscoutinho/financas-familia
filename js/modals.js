/* =========================================================
   modals.js — Modais de cadastro/edição
   ADICIONADO: openDivida, openPagamentoDivida,
               openNegociacaoDivida
   ========================================================= */

const Modals = {
  ensureBackdrop() { return document.getElementById("modal-backdrop"); },

  closeAll() {
    this.ensureBackdrop().classList.remove("active");
    document.getElementById("modal-root").innerHTML = "";
  },

  open(title, bodyHtml, onSubmit) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
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
    this.ensureBackdrop().classList.add("active");
    document.getElementById("modal-form").onsubmit = (e) => {
      e.preventDefault();
      onSubmit(new FormData(e.target));
    };
  },

  categoryOptions(selected) {
    return Store.data.categorias.map((c) =>
      `<option value="${c}" ${c===selected?"selected":""}>${c}</option>`
    ).join("");
  },

  openQuickAdd() {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>Adicionar</h2><button class="modal-close" onclick="Modals.closeAll()">✕</button></div>
        <div class="modal-body">
          <button class="btn btn-primary"   style="justify-content:flex-start;" onclick="Modals.openDespesa()">💸 Nova Despesa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openReceita()">💰 Nova Receita</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openFixa()">📌 Nova Conta Fixa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openParcelamento()">📦 Novo Parcelamento</button>
          <button class="btn btn-danger"    style="justify-content:flex-start;" onclick="Modals.openDivida()">🔴 Nova Dívida</button>
        </div>
      </div>`;
    this.ensureBackdrop().classList.add("active");
  },

  // ── Despesa ───────────────────────────────────────────
  openDespesa(id) {
    const item = id ? Store.data.despesas.find((d) => d.id===id) : null;
    this.open(item?"Editar Despesa":"Nova Despesa", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.categoryOptions(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Forma de pagamento</label>
          <select name="formaPagamento">
            ${["Pix","Dinheiro","Débito","Crédito","Transferência"].map((f)=>`<option ${item?.formaPagamento===f?"selected":""}>${f}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data||Utils.todayISO()}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("despesas","Despesas",item.id,data);
      else Store.add("despesas","Despesas",data);
      Utils.toast("Despesa salva ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Receita ───────────────────────────────────────────
  openReceita(id) {
    const item = id ? Store.data.receitas.find((d) => d.id===id) : null;
    this.open(item?"Editar Receita":"Nova Receita", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label>
          <select name="categoria">
            ${["Salário","Freela","PIX recebido","13º","Bonificação","Outros"].map((f)=>`<option ${item?.categoria===f?"selected":""}>${f}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data||Utils.todayISO()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("receitas","Receitas",item.id,data);
      else Store.add("receitas","Receitas",data);
      Utils.toast("Receita salva ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Conta Fixa ────────────────────────────────────────
  openFixa(id) {
    const item = id ? Store.data.contasFixas.find((d) => d.id===id) : null;
    this.open(item?"Editar Conta Fixa":"Nova Conta Fixa", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.categoryOptions(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor||""}"></div>
      </div>
      <div class="field"><label>Dia do vencimento</label><input name="diaVencimento" type="number" min="1" max="31" required value="${item?.diaVencimento||""}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("contasFixas","ContasFixas",item.id,data);
      else { data.mesReferencia=Utils.currentMonthKey(); data.pago=false; Store.add("contasFixas","ContasFixas",data); }
      Utils.toast("Conta fixa salva ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Cartão ────────────────────────────────────────────
  openCartao(id) {
    const item = id ? Store.data.cartoes.find((d) => d.id===id) : null;
    this.open(item?"Editar Cartão":"Novo Cartão", `
      <div class="field"><label>Nome do cartão</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Limite total (R$)</label><input name="limite" type="number" step="0.01" required value="${item?.limite||""}"></div>
        <div class="field"><label>Limite usado (R$)</label><input name="limiteUsado" type="number" step="0.01" value="${item?.limiteUsado||0}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Dia fechamento</label><input name="fechamento" type="number" min="1" max="31" value="${item?.fechamento||""}"></div>
        <div class="field"><label>Dia vencimento</label><input name="vencimento" type="number" min="1" max="31" value="${item?.vencimento||""}"></div>
      </div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("cartoes","Cartoes",item.id,data);
      else Store.add("cartoes","Cartoes",data);
      Utils.toast("Cartão salvo ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Parcelamento ──────────────────────────────────────
  openParcelamento(id) {
    const item = id ? Store.data.parcelamentos.find((d) => d.id===id) : null;
    this.open(item?"Editar Parcelamento":"Novo Parcelamento", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Valor da parcela (R$)</label><input name="valorParcela" type="number" step="0.01" required value="${item?.valorParcela||""}"></div>
        <div class="field"><label>Total de parcelas</label><input name="qtdTotal" type="number" min="1" required value="${item?.qtdTotal||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Parcela atual</label><input name="parcelaAtual" type="number" min="1" required value="${item?.parcelaAtual||1}"></div>
        <div class="field"><label>Data final</label><input name="dataFinal" type="date" value="${item?.dataFinal||""}"></div>
      </div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      data.valorRestante = (Number(data.qtdTotal)-Number(data.parcelaAtual)+1)*Number(data.valorParcela);
      if (item) Store.update("parcelamentos","Parcelamentos",item.id,data);
      else Store.add("parcelamentos","Parcelamentos",data);
      Utils.toast("Parcelamento salvo ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Meta ──────────────────────────────────────────────
  openMeta(id) {
    const item = id ? Store.data.metas.find((d) => d.id===id) : null;
    this.open(item?"Editar Meta":"Nova Meta", `
      <div class="field"><label>Nome da meta</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Valor alvo (R$)</label><input name="valorAlvo" type="number" step="0.01" required value="${item?.valorAlvo||""}"></div>
        <div class="field"><label>Valor já guardado (R$)</label><input name="valorAtual" type="number" step="0.01" value="${item?.valorAtual||0}"></div>
      </div>
      <div class="field"><label>Data limite</label><input name="dataLimite" type="date" value="${item?.dataLimite||""}"></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("metas","Metas",item.id,data);
      else Store.add("metas","Metas",data);
      Utils.toast("Meta salva ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Dívida (manual) ───────────────────────────────────
  openDivida(id) {
    const item = id ? Store.data.dividas.find((d) => d.id===id) : null;
    const statusOpts = [
      {v:"em_aberto",l:"Em aberto"},{v:"em_atraso",l:"Em atraso"},
      {v:"negociada",l:"Negociada"},{v:"parcelada",l:"Parcelada"},{v:"quitada",l:"Quitada"},
    ];
    const prioOpts = [{v:"alta",l:"Alta"},{v:"media",l:"Média"},{v:"baixa",l:"Baixa"}];
    this.open(item?"Editar Dívida":"Nova Dívida", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome||""}" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.categoryOptions(item?.categoria)}</select></div>
        <div class="field"><label>Credor</label><input name="credor" value="${item?.credor||""}" placeholder="Ex: Banco, Pessoa..."></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor original (R$)</label><input name="valorOriginal" type="number" step="0.01" required value="${item?.valorOriginal||""}"></div>
        <div class="field"><label>Valor atual (R$)</label><input name="valorAtual" type="number" step="0.01" value="${item?.valorAtual||item?.valorOriginal||""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Data de vencimento</label><input name="dataVencimento" type="date" value="${item?.dataVencimento||""}"></div>
        <div class="field"><label>Prioridade</label>
          <select name="prioridade">${prioOpts.map((p)=>`<option value="${p.v}" ${(item?.prioridade||"media")===p.v?"selected":""}>${p.l}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Status</label>
          <select name="status">${statusOpts.map((s)=>`<option value="${s.v}" ${(item?.status||"em_aberto")===s.v?"selected":""}>${s.l}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Taxa de juros (% a.m.)</label><input name="taxaJuros" type="number" step="0.01" value="${item?.taxaJuros||0}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs||""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      data.valorPago     = item?.valorPago     || 0;
      data.valorRestante = Math.max(0, Number(data.valorAtual) - Number(data.valorPago));
      data.estaEmAtraso  = data.status === "em_atraso";
      data.temJuros      = Number(data.taxaJuros) > 0;
      data.origem        = "manual";
      data.contaFixaId   = "";
      if (item) {
        Store.update("dividas","Dividas",item.id,data);
        Store.addHistoricoDivida(item.id,"edicao","Dívida editada",data.valorAtual);
      } else {
        data.criadoEm = Utils.todayISO();
        Store.add("dividas","Dividas",data);
        Store.addHistoricoDivida(data.id,"criada","Criada manualmente",data.valorOriginal);
      }
      Utils.toast("Dívida salva ✓"); Modals.closeAll(); Pages.render(App.currentPage);
    });
  },

  // ── Pagamento parcial de dívida ───────────────────────
  openPagamentoDivida(dividaId) {
    const divida = Store.data.dividas.find((d) => d.id===dividaId);
    if (!divida) return;
    const pagamentos = Store.data.pagamentosDividas.filter((p) => p.dividaId===dividaId);
    const histPag    = pagamentos.length
      ? `<div style="margin-top:12px;"><div style="font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:6px;">HISTÓRICO DE PAGAMENTOS</div>` +
        pagamentos.slice(-5).reverse().map((p) =>
          `<div class="list-row"><div class="row-main"><div class="row-title">${Utils.fmtDateFull(p.data)}</div><div class="row-sub">${p.obs||""}</div></div><div class="row-amount pos">+${Utils.brl(p.valor)}</div></div>`
        ).join("") + `</div>` : "";

    this.open(`Registrar Pagamento — ${divida.nome}`, `
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Saldo restante</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-negative);">${Utils.brl(divida.valorRestante)}</div>
        <div style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Pago até agora: ${Utils.brl(divida.valorPago||0)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor pago (R$)</label><input name="valor" type="number" step="0.01" required max="${divida.valorRestante}" autofocus></div>
        <div class="field"><label>Data</label><input name="data" type="date" value="${Utils.todayISO()}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2"></textarea></div>
      ${histPag}
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      Actions.registrarPagamentoDivida(dividaId, data.valor, data.data, data.obs);
      Modals.closeAll();
    });
  },

  // ── Negociação de dívida ──────────────────────────────
  openNegociacaoDivida(dividaId) {
    const divida = Store.data.dividas.find((d) => d.id===dividaId);
    if (!divida) return;
    this.open(`Negociar — ${divida.nome}`, `
      <div style="background:var(--color-surface-alt);border-radius:var(--radius-sm);padding:12px;margin-bottom:4px;">
        <div style="font-size:12px;color:var(--color-text-muted);">Valor atual da dívida</div>
        <div style="font-size:22px;font-weight:700;color:var(--color-negative);">${Utils.brl(divida.valorAtual)}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Valor original (R$)</label><input name="valorOriginal" type="number" step="0.01" value="${divida.valorAtual}" required></div>
        <div class="field"><label>Valor negociado (R$)</label><input name="valorNegociado" type="number" step="0.01" required autofocus></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Número de parcelas</label><input name="numeroParcelas" type="number" min="1" value="1"></div>
        <div class="field"><label>Valor por parcela (R$)</label><input name="valorParcela" type="number" step="0.01"></div>
      </div>
      <div class="field"><label>Data da negociação</label><input name="dataNegociacao" type="date" value="${Utils.todayISO()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2"></textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      Actions.negociarDivida(dividaId, data);
      Modals.closeAll();
    });
  },
// ── Nota adesiva ──────────────────────────────────────
  openNota(id) {
    const item  = id ? Store.data.notas.find((n) => n.id === id) : null;
    const cores = ["#FFF9C4","#C8E6C9","#BBDEFB","#F8BBD0","#FFE0B2","#E1BEE7","#B2EBF2","#DCEDC8"];
    const corAtual = item?.cor || "#FFF9C4";
    const corPicker = cores.map((c) =>
      `<button type="button" class="cor-btn ${c===corAtual?"selected":""}" data-cor="${c}"
         style="background:${c}" onclick="this.closest('form').querySelector('[name=cor]').value='${c}';this.closest('.cor-picker').querySelectorAll('.cor-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')"></button>`
    ).join("");

    this.open(item ? "Editar nota" : "Nova nota", `
      <div class="field">
        <label>Título</label>
        <input name="titulo" value="${item?.titulo||""}" placeholder="Título rápido..." autofocus>
      </div>
      <div class="field">
        <label>Conteúdo</label>
        <textarea name="conteudo" rows="5" placeholder="Escreva sua nota aqui...">${item?.conteudo||""}</textarea>
      </div>
      <div class="field">
        <label>Cor da nota</label>
        <div class="cor-picker">${corPicker}</div>
        <input type="hidden" name="cor" value="${corAtual}">
      </div>
      ${id ? `<input type="hidden" name="id" value="${id}">` : ""}
    `, (fd) => {
      const dados = Object.fromEntries(fd.entries());
      Actions.saveNota(dados);
      Modals.closeAll();
    });
  },
};
