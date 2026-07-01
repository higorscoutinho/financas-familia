/* =========================================================
   modals.js — Modais de cadastro/edição
   ========================================================= */

const Modals = {
  backdrop: null,

  ensureBackdrop() {
    if (!this.backdrop) this.backdrop = document.getElementById("modal-backdrop");
    return this.backdrop;
  },

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
    return Store.data.categorias.map((c) => `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`).join("");
  },

  openQuickAdd() {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>Adicionar</h2><button class="modal-close" onclick="Modals.closeAll()">✕</button></div>
        <div class="modal-body">
          <button class="btn btn-primary" style="justify-content:flex-start;" onclick="Modals.openDespesa()">💸 Nova Despesa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openReceita()">💰 Nova Receita</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openFixa()">📌 Nova Conta Fixa</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openParcelamento()">📦 Novo Parcelamento</button>
          <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="Modals.openMeta()">🎯 Nova Meta</button>
        </div>
      </div>`;
    this.ensureBackdrop().classList.add("active");
  },

  // -------- DESPESA --------
  openDespesa(id) {
    const item = id ? Store.data.despesas.find((d) => d.id === id) : null;
    this.open(item ? "Editar Despesa" : "Nova Despesa", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Supermercado" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.categoryOptions(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor || ""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Forma de pagamento</label>
          <select name="formaPagamento">
            ${["Pix", "Dinheiro", "Débito", "Crédito", "Transferência"].map((f) => `<option ${item?.formaPagamento === f ? "selected" : ""}>${f}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data || Utils.todayISO()}"></div>
      </div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs || ""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("despesas", "Despesas", item.id, data);
      else Store.add("despesas", "Despesas", data);
      Utils.toast("Despesa salva ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },

  // -------- RECEITA --------
  openReceita(id) {
    const item = id ? Store.data.receitas.find((d) => d.id === id) : null;
    this.open(item ? "Editar Receita" : "Nova Receita", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Salário" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label>
          <select name="categoria">
            ${["Salário", "Freela", "PIX recebido", "13º", "Bonificação", "Outros"].map((f) => `<option ${item?.categoria === f ? "selected" : ""}>${f}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor || ""}"></div>
      </div>
      <div class="field"><label>Data</label><input name="data" type="date" required value="${item?.data || Utils.todayISO()}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs || ""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("receitas", "Receitas", item.id, data);
      else Store.add("receitas", "Receitas", data);
      Utils.toast("Receita salva ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },

  // -------- CONTA FIXA --------
  openFixa(id) {
    const item = id ? Store.data.contasFixas.find((d) => d.id === id) : null;
    this.open(item ? "Editar Conta Fixa" : "Nova Conta Fixa", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Aluguel" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Categoria</label><select name="categoria">${this.categoryOptions(item?.categoria)}</select></div>
        <div class="field"><label>Valor (R$)</label><input name="valor" type="number" step="0.01" required value="${item?.valor || ""}"></div>
      </div>
      <div class="field"><label>Dia do vencimento</label><input name="diaVencimento" type="number" min="1" max="31" required value="${item?.diaVencimento || ""}"></div>
      <div class="field"><label>Observações</label><textarea name="obs" rows="2">${item?.obs || ""}</textarea></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) {
        Store.update("contasFixas", "ContasFixas", item.id, data);
      } else {
        data.mesReferencia = Utils.currentMonthKey();
        data.pago = false;
        Store.add("contasFixas", "ContasFixas", data);
      }
      Utils.toast("Conta fixa salva ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },

  // -------- CARTÃO --------
  openCartao(id) {
    const item = id ? Store.data.cartoes.find((d) => d.id === id) : null;
    this.open(item ? "Editar Cartão" : "Novo Cartão", `
      <div class="field"><label>Nome do cartão</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Nubank" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Limite total (R$)</label><input name="limite" type="number" step="0.01" required value="${item?.limite || ""}"></div>
        <div class="field"><label>Limite usado (R$)</label><input name="limiteUsado" type="number" step="0.01" value="${item?.limiteUsado || 0}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Dia fechamento</label><input name="fechamento" type="number" min="1" max="31" value="${item?.fechamento || ""}"></div>
        <div class="field"><label>Dia vencimento</label><input name="vencimento" type="number" min="1" max="31" value="${item?.vencimento || ""}"></div>
      </div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("cartoes", "Cartoes", item.id, data);
      else Store.add("cartoes", "Cartoes", data);
      Utils.toast("Cartão salvo ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },

  // -------- PARCELAMENTO --------
  openParcelamento(id) {
    const item = id ? Store.data.parcelamentos.find((d) => d.id === id) : null;
    this.open(item ? "Editar Parcelamento" : "Novo Parcelamento", `
      <div class="field"><label>Nome</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Notebook" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Valor da parcela (R$)</label><input name="valorParcela" type="number" step="0.01" required value="${item?.valorParcela || ""}"></div>
        <div class="field"><label>Qtd. total de parcelas</label><input name="qtdTotal" type="number" min="1" required value="${item?.qtdTotal || ""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Parcela atual</label><input name="parcelaAtual" type="number" min="1" required value="${item?.parcelaAtual || 1}"></div>
        <div class="field"><label>Data final</label><input name="dataFinal" type="date" value="${item?.dataFinal || ""}"></div>
      </div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      data.valorRestante = (Number(data.qtdTotal) - Number(data.parcelaAtual) + 1) * Number(data.valorParcela);
      if (item) Store.update("parcelamentos", "Parcelamentos", item.id, data);
      else Store.add("parcelamentos", "Parcelamentos", data);
      Utils.toast("Parcelamento salvo ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },

  // -------- META --------
  openMeta(id) {
    const item = id ? Store.data.metas.find((d) => d.id === id) : null;
    this.open(item ? "Editar Meta" : "Nova Meta", `
      <div class="field"><label>Nome da meta</label><input name="nome" required value="${item?.nome || ""}" placeholder="Ex: Viagem para a praia" autofocus></div>
      <div class="field-row">
        <div class="field"><label>Valor alvo (R$)</label><input name="valorAlvo" type="number" step="0.01" required value="${item?.valorAlvo || ""}"></div>
        <div class="field"><label>Valor já guardado (R$)</label><input name="valorAtual" type="number" step="0.01" value="${item?.valorAtual || 0}"></div>
      </div>
      <div class="field"><label>Data limite</label><input name="dataLimite" type="date" value="${item?.dataLimite || ""}"></div>
    `, (fd) => {
      const data = Object.fromEntries(fd.entries());
      if (item) Store.update("metas", "Metas", item.id, data);
      else Store.add("metas", "Metas", data);
      Utils.toast("Meta salva ✓");
      Modals.closeAll();
      Pages.render(App.currentPage);
    });
  },
};
