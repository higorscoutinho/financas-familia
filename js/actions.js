/* =========================================================
   actions.js — Ações da interface
   ADICIONADO: registrarPagamentoDivida, negociarDivida,
   quitarDivida, novaDivida (manual)
   ALTERADO: payFixedBill fecha dívida vinculada ao pagar
   ========================================================= */

const Actions = {

  // ── Contas Fixas ──────────────────────────────────────
  payFixedBill(id) {
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const novoPago = !item.pago;
    Store.update("contasFixas", "ContasFixas", id, {
      pago:          novoPago,
      dataPagamento: novoPago ? Utils.todayISO() : "",
      horaPagamento: novoPago ? new Date().toLocaleTimeString("pt-BR") : "",
    });

    // Fecha/reabre dívida vinculada automaticamente
    const divVinc = Store.data.dividas.find((d) => d.contaFixaId === id);
    if (divVinc) {
      if (novoPago) {
        Store.update("dividas", "Dividas", divVinc.id, {
          status: "quitada", valorPago: divVinc.valorOriginal, valorRestante: 0,
        });
        Store.addHistoricoDivida(divVinc.id, "quitada", "Conta marcada como paga — dívida encerrada", divVinc.valorOriginal);
        Utils.toast("Conta paga e dívida encerrada ✓");
      } else {
        Store.update("dividas", "Dividas", divVinc.id, {
          status: "em_atraso", valorPago: 0, valorRestante: divVinc.valorOriginal,
        });
        Store.addHistoricoDivida(divVinc.id, "atraso", "Pagamento desfeito — dívida reativada", 0);
        Utils.toast("Pagamento desfeito — dívida reativada");
      }
    } else {
      Utils.toast(novoPago ? "Conta marcada como paga ✓" : "Pagamento desfeito");
    }
    Pages.render(App.currentPage);
  },

  moveFixaToMonth(id, novoMk) {
    if (!novoMk) return;
    const item = Store.data.contasFixas.find((c) => c.id === id);
    if (!item) return;
    const jaExiste = Store.data.contasFixas.some((c) => c.nome === item.nome && c.mesReferencia === novoMk && c.id !== id);
    if (jaExiste) { Utils.toast(`"${item.nome}" já existe em ${Utils.monthLabel(novoMk)}`); return; }
    Store.update("contasFixas", "ContasFixas", id, { mesReferencia: novoMk, pago: false, dataPagamento: "", horaPagamento: "" });
    Utils.toast(`Conta movida para ${Utils.monthLabel(novoMk)}`);
    Pages.render(App.currentPage);
  },

  // ── Parcelamentos ─────────────────────────────────────
  toggleParcelamentoPago(id) {
    const mk   = App.selectedMonth;
    const pago = Store.toggleParcelamentoPago(id, mk);
    Utils.toast(pago ? "Parcela marcada como paga ✓" : "Marcação desfeita");
    Pages.render(App.currentPage);
  },

  // ── Dívidas: registrar pagamento parcial ou total ─────
  registrarPagamentoDivida(dividaId, valor, data, obs) {
    const divida = Store.data.dividas.find((d) => d.id === dividaId);
    if (!divida) return;
    const pagamento = {
      id:       Utils.uid("pag"),
      dividaId,
      valor:    Number(valor) || 0,
      data:     data || Utils.todayISO(),
      obs:      obs || "",
      criadoPor: App.currentUser,
    };
    Store.data.pagamentosDividas.push(pagamento);
    Store.saveLocal();
    Store.queueChange("PagamentosDividas", "create", pagamento);
    Store.addHistoricoDivida(dividaId, "pagamento", `Pagamento registrado`, pagamento.valor);
    Store.recalcularDivida(dividaId);
    Utils.toast(`Pagamento de ${Utils.brl(pagamento.valor)} registrado ✓`);
    Pages.render(App.currentPage);
  },

  // ── Dívidas: negociação ───────────────────────────────
  negociarDivida(dividaId, dados) {
    const divida = Store.data.dividas.find((d) => d.id === dividaId);
    if (!divida) return;
    const negoc = {
      id:              Utils.uid("neg"),
      dividaId,
      valorOriginal:   Number(dados.valorOriginal)   || divida.valorAtual,
      valorNegociado:  Number(dados.valorNegociado)  || divida.valorAtual,
      economia:        Number(dados.valorOriginal)   - Number(dados.valorNegociado),
      numeroParcelas:  Number(dados.numeroParcelas)  || 1,
      valorParcela:    Number(dados.valorParcela)    || 0,
      dataNegociacao:  dados.dataNegociacao          || Utils.todayISO(),
      obs:             dados.obs                     || "",
    };
    Store.data.negociacoesDividas.push(negoc);
    Store.update("dividas", "Dividas", dividaId, {
      valorAtual:    negoc.valorNegociado,
      valorRestante: Math.max(0, negoc.valorNegociado - Number(divida.valorPago || 0)),
      status:        negoc.numeroParcelas > 1 ? "parcelada" : "negociada",
    });
    Store.saveLocal();
    Store.queueChange("NegociacoesDividas", "create", negoc);
    Store.addHistoricoDivida(dividaId, "negociacao",
      `Negociada: ${Utils.brl(negoc.valorOriginal)} → ${Utils.brl(negoc.valorNegociado)} (economia ${Utils.brl(negoc.economia)})`,
      negoc.valorNegociado
    );
    Utils.toast(`Dívida negociada — economia de ${Utils.brl(negoc.economia)} ✓`);
    Pages.render(App.currentPage);
  },

  // ── Dívidas: quitar manualmente ───────────────────────
  quitarDivida(id) {
    const divida = Store.data.dividas.find((d) => d.id === id);
    if (!divida) return;
    if (!confirm(`Marcar "${divida.nome}" como quitada?`)) return;
    Store.update("dividas", "Dividas", id, {
      status: "quitada", valorPago: divida.valorAtual, valorRestante: 0,
    });
    Store.addHistoricoDivida(id, "quitada", "Quitada manualmente", divida.valorAtual);
    if (divida.contaFixaId) {
      const conta = Store.data.contasFixas.find((c) => c.id === divida.contaFixaId);
      if (conta && !conta.pago) {
        Store.update("contasFixas","ContasFixas", conta.id, {
          pago: true, dataPagamento: Utils.todayISO(), horaPagamento: new Date().toLocaleTimeString("pt-BR"),
        });
      }
    }
    Utils.toast("Dívida quitada ✓");
    Pages.render(App.currentPage);
  },

  // ── CRUD genérico ─────────────────────────────────────
  remove(col, sheet, id) {
    if (!confirm("Excluir este registro?")) return;
    Store.remove(col, sheet, id);
    Utils.toast("Removido");
    Pages.render(App.currentPage);
  },

  // ── Configurações ─────────────────────────────────────
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

  saveConfig() {
    const meta = Number(document.getElementById("cfg-meta").value) || 0;
    const tol  = Number(document.getElementById("cfg-tolerancia").value) || 1;
    Store.data.configuracoes.metaEconomiaMensal = meta;
    Store.data.configuracoes.diasToleranciaAtraso = tol;
    Store.saveLocal();
    Store.queueChange("Configuracoes", "update", { metaEconomiaMensal: meta, diasToleranciaAtraso: tol });
    Store.checkOverdueBills();
    Utils.toast("Configurações salvas ✓");
  },

  exportCSV() {
    const mk   = App.selectedMonth;
    const rows = [["Tipo","Nome","Categoria","Valor","Data","Status","Detalhe"]];
    Store.monthReceitas(mk).forEach((r) =>    rows.push(["Receita",      r.nome, r.categoria, r.valor, r.data, "", ""]));
    Store.monthDespesas(mk).forEach((d) =>    rows.push(["Despesa",      d.nome, d.categoria, d.valor, d.data, "", d.formaPagamento||""]));
    Store.monthFixedBills(mk).forEach((f) =>  rows.push(["Conta Fixa",   f.nome, f.categoria, f.valor, f.dataPagamento||"", f.pago?"Pago":"Não pago", `Dia ${f.diaVencimento}`]));
    Store.monthParcelamentos(mk).forEach((p)=>rows.push(["Parcelamento", p.nome, "Parcelamento", p.valorParcela, p.dataFinal, Store.isParcelamentoPago(p.id,mk)?"Pago":"", `${Store.getInstallmentForMonth(p,mk)}/${p.qtdTotal}`]));
    Store.data.dividas.filter((d)=>d.status!=="quitada").forEach((d)=>rows.push(["Dívida", d.nome, d.categoria, d.valorRestante, d.dataVencimento, d.status, d.credor||""]));
    const csv  = rows.map((r) => r.map((c) => `"${String(c??'').replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`financas-${mk}.csv`; a.click();
    URL.revokeObjectURL(url);
    Utils.toast("CSV exportado ✓");
  },
};
