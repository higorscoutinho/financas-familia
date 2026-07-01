/* =========================================================
   actions.js — Ações reutilizáveis disparadas pela interface
   ========================================================= */

const Actions = {
  payFixedBill(id) {
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const novoPago = !item.pago;
    Store.update("contasFixas", "ContasFixas", id, {
      pago: novoPago,
      dataPagamento: novoPago ? Utils.todayISO() : "",
      horaPagamento: novoPago ? new Date().toLocaleTimeString("pt-BR") : "",
    });
    Utils.toast(novoPago ? "Conta marcada como paga ✓" : "Pagamento desfeito");
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
    const val = input.value.trim();
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
    const mk = Utils.currentMonthKey();
    const rows = [["Tipo", "Nome", "Categoria", "Valor", "Data", "Status"]];
    Store.monthDespesas(mk).forEach((d) => rows.push(["Despesa", d.nome, d.categoria, d.valor, d.data, ""]));
    Store.monthReceitas(mk).forEach((r) => rows.push(["Receita", r.nome, r.categoria, r.valor, r.data, ""]));
    Store.monthFixedBills(mk).forEach((f) => rows.push(["Conta Fixa", f.nome, f.categoria, f.valor, f.dataPagamento, f.pago ? "Pago" : "Não pago"]));

    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financas-${mk}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.toast("CSV exportado ✓ (abre direto no Excel)");
  },
};
