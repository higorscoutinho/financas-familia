/* =========================================================
   actions.js — Ações da interface
   MUDANÇAS:
   - moveFixaToPrevMonth() → move conta fixa para mês anterior
   - moveFixaToMonth()     → move para qualquer mês escolhido
   ========================================================= */

const Actions = {

  payFixedBill(id) {
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const novoPago = !item.pago;
    Store.update("contasFixas", "ContasFixas", id, {
      pago:           novoPago,
      dataPagamento:  novoPago ? Utils.todayISO() : "",
      horaPagamento:  novoPago ? new Date().toLocaleTimeString("pt-BR") : "",
    });
    Utils.toast(novoPago ? "Conta marcada como paga ✓" : "Pagamento desfeito");
    Pages.render(App.currentPage);
  },

  /**
   * Move uma conta fixa para outro mês de referência.
   * Útil para "jogar" uma conta atrasada para o mês anterior,
   * ou corrigir em qual mês ela deve aparecer.
   */
  moveFixaToMonth(id, novoMk) {
    if (!novoMk) return;
    // Verifica se já existe uma conta com o mesmo nome naquele mês
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const jaExiste = Store.data.contasFixas.some(
      (c) => c.nome === item.nome && c.mesReferencia === novoMk && c.id !== id
    );
    if (jaExiste) {
      Utils.toast(`Já existe "${item.nome}" em ${Utils.monthLabel(novoMk)}`);
      return;
    }
    Store.update("contasFixas", "ContasFixas", id, {
      mesReferencia: novoMk,
      pago:          false,
      dataPagamento: "",
      horaPagamento: "",
    });
    Utils.toast(`Conta movida para ${Utils.monthLabel(novoMk)}`);
    Pages.render(App.currentPage);
  },

  remove(collectionKey, sheetName, id) {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    Store.remove(collectionKey, sheetName, id);
    Utils.toast("Removido");
    Pages.render(App.currentPage);
  },

  addCategory() {
    const input = document.getElementById("new-cat");
    const val   = input.value.trim();
    if (!val) return;
    if (Store.data.categorias.includes(val)) { Utils.toast("Categoria já existe"); return; }
    Store.data.categorias.push(val);
    Store.saveLocal();
    Store.queueChange("Categorias", "create", { nome: val });
    input.value = "";
    Pages.renderCategoryChips();
    Utils.toast("Categoria adicionada ✓");
  },

  saveMetaEconomia() {
    const val = Number(document.getElementById("cfg-meta").value) || 0;
    Store.data.configuracoes.metaEconomiaMensal = val;
    Store.saveLocal();
    Store.queueChange("Configuracoes", "update", { metaEconomiaMensal: val });
    Utils.toast("Meta de economia salva ✓");
  },

  exportCSV() {
    const mk = App.selectedMonth;
    const rows = [["Tipo","Nome","Categoria","Valor","Data","Status","Forma de Pagamento"]];
    Store.monthDespesas(mk).forEach((d)  => rows.push(["Despesa",      d.nome, d.categoria, d.valor, d.data,        "",                   d.formaPagamento || ""]));
    Store.monthReceitas(mk).forEach((r)  => rows.push(["Receita",      r.nome, r.categoria, r.valor, r.data,        "",                   ""]));
    Store.monthFixedBills(mk).forEach((f)=> rows.push(["Conta Fixa",   f.nome, f.categoria, f.valor, f.dataPagamento, f.pago?"Pago":"Não pago", ""]));
    Store.monthParcelamentos(mk).forEach((p)=> rows.push(["Parcelamento", p.nome, "Parcela",  p.valorParcela, p.dataFinal, `${p.parcelaAtual}/${p.qtdTotal}`, ""]));

    const csv = rows.map((r) => r.map((c) => `"${String(c??'').replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `financas-${mk}.csv`; a.click();
    URL.revokeObjectURL(url);
    Utils.toast(`CSV de ${Utils.monthLabel(mk)} exportado ✓`);
  },
};
