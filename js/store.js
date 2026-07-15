/* =========================================================
   store.js
   MUDANÇAS: dataInicioSistema em configuracoes,
   checkOverdueBills respeita esse mês de início,
   notas adicionadas como coleção.
   ========================================================= */

const DEFAULT_CATEGORIES = [
  "Moradia","Mercado","Farmácia","Restaurantes","Lazer","Combustível",
  "Carro","Moto","Pets","Saúde","Educação","Assinaturas","Streaming",
  "Viagem","Investimentos","Outros",
];

const LS_KEY        = "ff_data_v1";
const LS_QUEUE      = "ff_queue_v1";
const LS_USER       = "ff_user_v1";
const LS_THEME      = "ff_theme_v1";
const LS_PARC_PAGOS = "ff_parc_pagos_v1";

const Store = {
  data: {
    receitas:           [],
    despesas:           [],
    contasFixas:        [],
    cartoes:            [],
    parcelamentos:      [],
    categorias:         [...DEFAULT_CATEGORIES],
    metas:              [],
    configuracoes:      {
      metaEconomiaMensal:   0,
      diasToleranciaAtraso: 1,
      dataInicioSistema:    "2026-08", // ← dívidas só geradas a partir daqui
    },
    logs:               [],
    dividas:            [],
    pagamentosDividas:  [],
    negociacoesDividas: [],
    historicoDividas:   [],
    notas:              [],
  },

  parcelamentosPagos: {},
  queue:   [],
  syncing: false,

  // ── Persistência local ────────────────────────────────
  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      const q  = localStorage.getItem(LS_QUEUE);
      if (q)  this.queue = JSON.parse(q);
      const pp = localStorage.getItem(LS_PARC_PAGOS);
      if (pp) this.parcelamentosPagos = JSON.parse(pp);
    } catch(e) { console.warn("Cache corrompido", e); }
  },

  saveLocal() {
    localStorage.setItem(LS_KEY,        JSON.stringify(this.data));
    localStorage.setItem(LS_QUEUE,      JSON.stringify(this.queue));
    localStorage.setItem(LS_PARC_PAGOS, JSON.stringify(this.parcelamentosPagos));
  },

  // ── Inicialização ─────────────────────────────────────
  async init() {
    this.loadLocal();
    if (API.isConfigured()) {
      const remote = await API.getAll();
      if (remote) {
        this.data = {
          receitas:           remote.receitas           || [],
          despesas:           remote.despesas           || [],
          contasFixas:        remote.contasFixas        || [],
          cartoes:            remote.cartoes            || [],
          parcelamentos:      remote.parcelamentos      || [],
          categorias:         remote.categorias?.length ? remote.categorias : [...DEFAULT_CATEGORIES],
          metas:              remote.metas              || [],
          configuracoes:      remote.configuracoes      || { metaEconomiaMensal: 0, diasToleranciaAtraso: 1, dataInicioSistema: "2026-08" },
          logs:               remote.logs               || [],
          dividas:            remote.dividas            || [],
          pagamentosDividas:  remote.pagamentosDividas  || [],
          negociacoesDividas: remote.negociacoesDividas || [],
          historicoDividas:   remote.historicoDividas   || [],
          notas:              remote.notas              || [],
        };
        this.saveLocal();
        Utils.toast("Sincronizado com Google Sheets ✓");
      } else {
        Utils.toast("Offline — usando dados locais");
      }
      this.flushQueue();
    }
    this.ensureFixedBillsForMonth(Utils.currentMonthKey());
    this.checkOverdueBills();
  },

  // ── Contas fixas: garante existência para qualquer mês ─
  ensureFixedBillsForMonth(mk) {
    const templates = new Map();
    this.data.contasFixas.forEach((c) => {
      const prev = templates.get(c.nome);
      if (!prev || (c.mesReferencia || "") > (prev.mesReferencia || "")) templates.set(c.nome, c);
    });
    const existingNames = new Set(
      this.data.contasFixas.filter((c) => c.mesReferencia === mk).map((c) => c.nome)
    );
    let criou = false;
    templates.forEach((tpl) => {
      if (!existingNames.has(tpl.nome)) {
        const novo = {
          ...tpl,
          id:            Utils.uid("fix"),
          mesReferencia: mk,
          pago:          false,
          dataPagamento: "",
          horaPagamento: "",
        };
        this.data.contasFixas.push(novo);
        this.queueChange("ContasFixas", "create", novo);
        criou = true;
      }
    });
    if (criou) this.saveLocal();
  },

  // ── DÍVIDAS: conversão automática — só a partir de dataInicioSistema ──
  checkOverdueBills() {
    const today         = new Date(); today.setHours(0, 0, 0, 0);
    const tolerancia    = Number(this.data.configuracoes.diasToleranciaAtraso) || 1;
    // Mês de início configurado (padrão: agosto/2026)
    const inicioSistema = this.data.configuracoes.dataInicioSistema || "2026-08";
    let criou = false;

    this.data.contasFixas.forEach((conta) => {
      if (conta.pago) return;
      if (!conta.mesReferencia || !conta.diaVencimento) return;

      // ✅ CORREÇÃO: ignora contas anteriores ao mês de início do sistema
      if (conta.mesReferencia < inicioSistema) return;

      const [y, m]   = conta.mesReferencia.split("-").map(Number);
      const dueDate  = new Date(y, m - 1, Number(conta.diaVencimento));
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - dueDate) / 86400000);
      if (diffDays < tolerancia) return;

      const jaExiste = this.data.dividas.some((d) => d.contaFixaId === conta.id);
      if (jaExiste) return;

      const todayStr = Utils.todayISO();
      const dataVenc = `${y}-${String(m).padStart(2,"0")}-${String(conta.diaVencimento).padStart(2,"0")}`;
      const divida   = {
        id:             Utils.uid("div"),
        nome:           conta.nome,
        categoria:      conta.categoria || "Outros",
        credor:         "",
        valorOriginal:  Number(conta.valor) || 0,
        valorAtual:     Number(conta.valor) || 0,
        valorPago:      0,
        valorRestante:  Number(conta.valor) || 0,
        dataVencimento: dataVenc,
        estaEmAtraso:   true,
        temJuros:       false,
        taxaJuros:      0,
        prioridade:     this.getPrioridade(conta.categoria),
        status:         "em_atraso",
        origem:         "conta",
        contaFixaId:    conta.id,
        mesReferencia:  conta.mesReferencia,
        obs:            `Gerada automaticamente — "${conta.nome}" venceu há ${diffDays} dia(s)`,
        criadoEm:       todayStr,
        criadoPor:      "Sistema",
      };
      this.data.dividas.push(divida);
      this.addHistoricoDivida(divida.id, "criada",  `Criada automaticamente — vencida há ${diffDays} dia(s)`, 0);
      this.addHistoricoDivida(divida.id, "atraso",  "Entrou em atraso", 0);
      this.queueChange("Dividas", "create", divida);
      criou = true;
    });

    if (criou) this.saveLocal();
  },

  // ── Prioridade automática ─────────────────────────────
  getPrioridade(categoria) {
    const cat  = (categoria || "").toLowerCase();
    const alta = ["moradia","aluguel","financiamento","faculdade","educação","educacao","condomínio","condominio","prestação","prestacao"];
    const med  = ["cartão","cartao","empréstimo","emprestimo","assinatura","streaming"];
    if (alta.some((a) => cat.includes(a))) return "alta";
    if (med.some((m)  => cat.includes(m))) return "media";
    return "baixa";
  },

  // ── Histórico de dívidas ──────────────────────────────
  addHistoricoDivida(dividaId, tipo, descricao, valor) {
    const entry = {
      id:       Utils.uid("hist"),
      dividaId,
      tipo,
      data:     Utils.todayISO(),
      descricao: descricao || "",
      valor:    valor || 0,
    };
    this.data.historicoDividas.push(entry);
    this.queueChange("HistoricoDividas", "create", entry);
  },

  // ── Recalcula dívida após pagamento ───────────────────
  recalcularDivida(id) {
    const divida    = this.data.dividas.find((d) => d.id === id);
    if (!divida) return;
    const pagamentos = this.data.pagamentosDividas.filter((p) => p.dividaId === id);
    const totalPago  = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
    const restante   = Math.max(0, Number(divida.valorAtual) - totalPago);
    const status     = restante <= 0 ? "quitada" : divida.status === "quitada" ? "em_aberto" : divida.status;
    this.update("dividas", "Dividas", id, { valorPago: totalPago, valorRestante: restante, status });
    if (restante <= 0 && divida.status !== "quitada") {
      this.addHistoricoDivida(id, "quitada", "Quitada — pagamento total atingido", totalPago);
      if (divida.contaFixaId) {
        const conta = this.data.contasFixas.find((c) => c.id === divida.contaFixaId);
        if (conta && !conta.pago) {
          this.update("contasFixas", "ContasFixas", conta.id, {
            pago: true, dataPagamento: Utils.todayISO(), horaPagamento: new Date().toLocaleTimeString("pt-BR"),
          });
        }
      }
    }
  },

  // ── Estatísticas de dívidas ───────────────────────────
  dividaStats() {
    const ativas       = this.data.dividas.filter((d) => d.status !== "quitada");
    const atraso       = ativas.filter((d) => d.status === "em_atraso");
    const negoc        = ativas.filter((d) => d.status === "negociada" || d.status === "parcelada");
    const quitadas     = this.data.dividas.filter((d) => d.status === "quitada");
    const totalAberto  = ativas.reduce((s, d) => s + Number(d.valorRestante || 0), 0);
    const totalAtraso  = atraso.reduce((s, d) => s + Number(d.valorRestante || 0), 0);
    const totalNegoc   = negoc.reduce((s, d) => s + Number(d.valorRestante || 0), 0);
    const totalQuitado = quitadas.reduce((s, d) => s + Number(d.valorOriginal || 0), 0);
    const maior        = [...ativas].sort((a, b) => Number(b.valorRestante||0) - Number(a.valorRestante||0))[0] || null;
    return { ativas, atraso, negoc, quitadas, totalAberto, totalAtraso, totalNegoc, totalQuitado, maior };
  },

  diasAtraso(divida) {
    if (!divida.dataVencimento) return 0;
    const due   = new Date(divida.dataVencimento); due.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.max(0, Math.floor((today - due) / 86400000));
  },

  // ── Parcelamentos ─────────────────────────────────────
  getInstallmentForMonth(p, mk) {
    const total     = Number(p.qtdTotal) || 1;
    const dataFinal = (p.dataFinal || "").slice(0, 7);
    if (!dataFinal) return Number(p.parcelaAtual) || 1;
    const [ey, em]  = dataFinal.split("-").map(Number);
    const startDate = new Date(ey, em - 1 - (total - 1), 1);
    const [sy, sm]  = [startDate.getFullYear(), startDate.getMonth() + 1];
    const [my, mm]  = mk.split("-").map(Number);
    return Math.max(1, Math.min(total, (my - sy) * 12 + (mm - sm) + 1));
  },

  parcPagoKey(id, mk)        { return `${id}_${mk}`; },
  isParcelamentoPago(id, mk) { return !!this.parcelamentosPagos[this.parcPagoKey(id, mk)]?.pago; },
  toggleParcelamentoPago(id, mk) {
    const key  = this.parcPagoKey(id, mk);
    const pago = !this.parcelamentosPagos[key]?.pago;
    if (pago) this.parcelamentosPagos[key] = { pago: true, data: Utils.todayISO() };
    else      delete this.parcelamentosPagos[key];
    this.saveLocal();
    return pago;
  },

  // ── Fila de sincronização ─────────────────────────────
  queueChange(sheet, op, data) {
    const user = typeof App !== "undefined" ? App.currentUser : "Sistema";
    this.queue.push({ sheet, op, data, user, ts: Date.now() });
    this.saveLocal();
    this.flushQueue();
  },

  async flushQueue() {
    if (this.syncing || !API.isConfigured() || !this.queue.length) return;
    this.syncing = true;
    while (this.queue.length) {
      const item = this.queue[0];
      const res  = await API.send(item.sheet, item.op, item.data, item.user);
      if (!res || res.ok === false) break;
      this.queue.shift();
      this.saveLocal();
    }
    this.syncing = false;
  },

  // ── CRUD genérico ─────────────────────────────────────
  add(col, sheet, record) {
    record.id        = record.id || Utils.uid(col.slice(0, 3));
    record.criadoPor = typeof App !== "undefined" ? App.currentUser : "Sistema";
    this.data[col].push(record);
    this.saveLocal();
    this.queueChange(sheet, "create", record);
    return record;
  },

  update(col, sheet, id, patch) {
    const idx = this.data[col].findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const before          = { ...this.data[col][idx] };
    this.data[col][idx]   = { ...before, ...patch };
    this.saveLocal();
    this.queueChange(sheet, "update", this.data[col][idx]);
    this.logChange(sheet, id, before, this.data[col][idx]);
    return this.data[col][idx];
  },

  remove(col, sheet, id) {
    this.data[col] = this.data[col].filter((r) => r.id !== id);
    this.saveLocal();
    this.queueChange(sheet, "delete", { id });
  },

  logChange(sheet, id, before, after) {
    this.data.logs.unshift({
      id: Utils.uid("log"),
      usuario: typeof App !== "undefined" ? App.currentUser : "?",
      data: Utils.todayISO(), hora: new Date().toLocaleTimeString("pt-BR"),
      aba: sheet, registroId: id,
      valorAntigo: before.valor ?? before.pago ?? before.status ?? "",
      valorNovo:   after.valor  ?? after.pago  ?? after.status  ?? "",
    });
    this.data.logs = this.data.logs.slice(0, 300);
  },

  // ── Consultas por mês ─────────────────────────────────
  monthDespesas(mk)   { return this.data.despesas.filter((d)  => Utils.monthKey(d.data)   === mk); },
  monthReceitas(mk)   { return this.data.receitas.filter((r)  => Utils.monthKey(r.data)   === mk); },
  monthFixedBills(mk) { return this.data.contasFixas.filter((c) => c.mesReferencia        === mk); },
  monthParcelamentos(mk) {
    return this.data.parcelamentos.filter((p) => {
      const total     = Number(p.qtdTotal) || 1;
      const dataFinal = (p.dataFinal || "").slice(0, 7);
      if (!dataFinal) return true;
      const [ey, em]  = dataFinal.split("-").map(Number);
      const startDate = new Date(ey, em - 1 - (total - 1), 1);
      const startMk   = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,"0")}`;
      return mk >= startMk && mk <= dataFinal;
    });
  },
  sum(list) { return list.reduce((s, x) => s + (Number(x.valor) || 0), 0); },
};
