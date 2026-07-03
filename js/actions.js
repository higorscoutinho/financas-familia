/* =========================================================
   actions.js — Ações da interface
   ALTERAÇÕES:
   - toggleParcelamentoPago(): marca/desmarca parcela paga
   - moveFixaToMonth(): move conta fixa para outro mês
   ========================================================= */

const Actions = {

  // Marcar conta fixa como paga / desfazer
  payFixedBill(id) {
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const novoPago = !item.pago;
    Store.update("contasFixas", "ContasFixas", id, {
      pago:          novoPago,
      dataPagamento: novoPago ? Utils.todayISO() : "",
      horaPagamento: novoPago ? new Date().toLocaleTimeString("pt-BR") : "",
    });
    Utils.toast(novoPago ? "Conta marcada como paga ✓" : "Pagamento desfeito");
    Pages.render(App.currentPage);
  },

  // Marcar parcela como paga no mês selecionado
  toggleParcelamentoPago(id) {
    const mk   = App.selectedMonth;
    const pago = Store.toggleParcelamentoPago(id, mk);
    Utils.toast(pago ? "Parcela marcada como paga ✓" : "Marcação desfeita");
    Pages.render(App.currentPage);
  },

  // Mover conta fixa para outro mês de referência
  moveFixaToMonth(id, novoMk) {
    if (!novoMk) return;
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const jaExiste = Store.data.contasFixas.some(
      (c) => c.nome === item.nome && c.mesReferencia === novoMk && c.id !== id
    );
    if (jaExiste) {
      Utils.toast(`"${item.nome}" já existe em ${Utils.monthLabel(novoMk)}`);
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

  // Excluir qualquer registro
  remove(col, sheet, id) {
    if (!confirm("Excluir este registro?")) return;
    Store.remove(col, sheet, id);
    Utils.toast("Removido");
    Pages.render(App.currentPage);
  },

  // Configurações
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
    Utils.toast("Meta salva ✓");
  },

  // Exportar CSV do mês selecionado
  exportCSV() {
    const mk   = App.selectedMonth;
    const rows = [["Tipo","Nome","Categoria","Valor","Data","Status","Detalhe"]];
    Store.monthReceitas(mk).forEach((r) =>
      rows.push(["Receita", r.nome, r.categoria, r.valor, r.data, "", ""]));
    Store.monthDespesas(mk).forEach((d) =>
      rows.push(["Despesa", d.nome, d.categoria, d.valor, d.data, "", d.formaPagamento || ""]));
    Store.monthFixedBills(mk).forEach((f) =>
      rows.push(["Conta Fixa", f.nome, f.categoria, f.valor, f.dataPagamento || "", f.pago ? "Pago" : "Não pago", `Dia ${f.diaVencimento}`]));
    Store.monthParcelamentos(mk).forEach((p) => {
      const num  = Store.getInstallmentForMonth(p, mk);
      const pago = Store.isParcelamentoPago(p.id, mk);
      rows.push(["Parcelamento", p.nome, "Parcelamento", p.valorParcela, p.dataFinal, pago ? "Pago" : "Não pago", `${num}/${p.qtdTotal}`]);
    });

    const csv  = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `financas-${mk}.csv`; a.click();
    URL.revokeObjectURL(url);
    Utils.toast(`CSV de ${Utils.monthLabel(mk)} exportado ✓`);
  },
};
