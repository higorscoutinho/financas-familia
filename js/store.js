/* =========================================================
   store.js — Estado da aplicação + sincronização Sheets
   ALTERAÇÕES:
   - ensureFixedBillsForMonth(mk): funciona para qualquer mês
     (não só o atual) — contas fixas aparecem em todo mês
   - getInstallmentForMonth(p, mk): calcula qual número de
     parcela corresponde ao mês selecionado
   - isParcelamentoPago / toggleParcelamentoPago: marca
     parcela como paga num mês específico (localStorage)
   ========================================================= */

const DEFAULT_CATEGORIES = [
  "Moradia","Mercado","Farmácia","Restaurantes","Lazer","Combustível",
  "Carro","Moto","Pets","Saúde","Educação","Assinaturas","Streaming",
  "Viagem","Investimentos","Outros",
];

const LS_KEY   = "ff_data_v1";
const LS_QUEUE = "ff_queue_v1";
const LS_USER  = "ff_user_v1";
const LS_THEME = "ff_theme_v1";
// Pagamentos de parcelas ficam só no localStorage (não precisam de aba nova na planilha)
const LS_PARC_PAGOS = "ff_parc_pagos_v1";

const Store = {
  data: {
    receitas:      [],
    despesas:      [],
    contasFixas:   [],
    cartoes:       [],
    parcelamentos: [],
    categorias:    [...DEFAULT_CATEGORIES],
    metas:         [],
    configuracoes: { metaEconomiaMensal: 0 },
    logs:          [],
  },

  // Pagamentos de parcelamentos: chave = "parcId_2026-06" → { pago, data }
  parcelamentosPagos: {},

  queue:   [],
  syncing: false,

  // ── Persistência local ────────────────────────────────
  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      const q = localStorage.getItem(LS_QUEUE);
      if (q) this.queue = JSON.parse(q);
      const pp = localStorage.getItem(LS_PARC_PAGOS);
      if (pp) this.parcelamentosPagos = JSON.parse(pp);
    } catch (e) { console.warn("Cache corrompido", e); }
  },

  saveLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    localStorage.setItem(LS_QUEUE, JSON.stringify(this.queue));
    localStorage.setItem(LS_PARC_PAGOS, JSON.stringify(this.parcelamentosPagos));
  },

  // ── Inicialização ─────────────────────────────────────
  async init() {
    this.loadLocal();
    if (API.isConfigured()) {
      const remote = await API.getAll();
      if (remote) {
        this.data = {
          receitas:      remote.receitas      || [],
          despesas:      remote.despesas      || [],
          contasFixas:   remote.contasFixas   || [],
          cartoes:       remote.cartoes       || [],
          parcelamentos: remote.parcelamentos || [],
          categorias:    remote.categorias?.length ? remote.categorias : [...DEFAULT_CATEGORIES],
          metas:         remote.metas         || [],
          configuracoes: remote.configuracoes || { metaEconomiaMensal: 0 },
          logs:          remote.logs          || [],
        };
        this.saveLocal();
        Utils.toast("Sincronizado com Google Sheets ✓");
      } else {
        Utils.toast("Offline — usando dados locais");
      }
      this.flushQueue();
    }
    this.ensureFixedBillsForMonth(Utils.currentMonthKey());
  },

  // ── Contas fixas: garante existência para QUALQUER mês ─
  ensureFixedBillsForMonth(mk) {
    // "Templates" = o registro mais recente de cada nome único
    const templates = new Map();
    this.data.contasFixas.forEach((c) => {
      const prev = templates.get(c.nome);
      if (!prev || (c.mesReferencia || "") > (prev.mesReferencia || "")) {
        templates.set(c.nome, c);
      }
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

  // ── Parcelamentos: número da parcela para um mês ───────
  /**
   * Calcula qual número de parcela corresponde ao mês `mk`.
   * Exemplo: parcelamento de 12x com dataFinal = 2026-12
   *   → dataInicio = 2026-01
   *   → para mk = 2026-06 → parcela 6
   *   → para mk = 2025-12 → parcela 0 (inativo)
   */
  getInstallmentForMonth(p, mk) {
    const total    = Number(p.qtdTotal) || 1;
    const dataFinal = (p.dataFinal || "").slice(0, 7); // "2026-12"
    if (!dataFinal) return Number(p.parcelaAtual) || 1;

    const [ey, em] = dataFinal.split("-").map(Number);
    // Mês de início = dataFinal − (total-1) meses
    const startDate = new Date(ey, em - 1 - (total - 1), 1);
    const sy = startDate.getFullYear();
    const sm = startDate.getMonth() + 1;

    const [my, mm] = mk.split("-").map(Number);
    const diff = (my - sy) * 12 + (mm - sm); // meses desde o início
    return Math.max(1, Math.min(total, diff + 1));
  },

  // ── Pagamento de parcelas ──────────────────────────────
  parcPagoKey(id, mk) { return `${id}_${mk}`; },

  isParcelamentoPago(id, mk) {
    return !!this.parcelamentosPagos[this.parcPagoKey(id, mk)]?.pago;
  },

  toggleParcelamentoPago(id, mk) {
    const key  = this.parcPagoKey(id, mk);
    const pago = !this.parcelamentosPagos[key]?.pago;
    if (pago) {
      this.parcelamentosPagos[key] = { pago: true, data: Utils.todayISO() };
    } else {
      delete this.parcelamentosPagos[key];
    }
    this.saveLocal();
    return pago;
  },

  // ── Fila de sincronização ─────────────────────────────
  queueChange(sheet, op, data) {
    const user = typeof App !== "undefined" ? App.currentUser : "?";
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
    record.criadoPor = typeof App !== "undefined" ? App.currentUser : "?";
    this.data[col].push(record);
    this.saveLocal();
    this.queueChange(sheet, "create", record);
    return record;
  },

  update(col, sheet, id, patch) {
    const idx = this.data[col].findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const before = { ...this.data[col][idx] };
    this.data[col][idx] = { ...before, ...patch };
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
      id:         Utils.uid("log"),
      usuario:    typeof App !== "undefined" ? App.currentUser : "?",
      data:       Utils.todayISO(),
      hora:       new Date().toLocaleTimeString("pt-BR"),
      aba:        sheet,
      registroId: id,
      valorAntigo: before.valor ?? before.pago ?? "",
      valorNovo:   after.valor  ?? after.pago  ?? "",
    });
    this.data.logs = this.data.logs.slice(0, 300);
  },

  // ── Consultas por mês ─────────────────────────────────
  monthDespesas(mk)   { return this.data.despesas.filter((d) => Utils.monthKey(d.data) === mk); },
  monthReceitas(mk)   { return this.data.receitas.filter((r) => Utils.monthKey(r.data) === mk); },
  monthFixedBills(mk) { return this.data.contasFixas.filter((c) => c.mesReferencia === mk); },

  /**
   * Parcelamentos ativos no mês mk.
   * Calcula startMk e endMk com base em dataFinal e qtdTotal.
   */
  monthParcelamentos(mk) {
    return this.data.parcelamentos.filter((p) => {
      const total     = Number(p.qtdTotal) || 1;
      const dataFinal = (p.dataFinal || "").slice(0, 7);
      if (!dataFinal) return true;

      const [ey, em] = dataFinal.split("-").map(Number);
      const startDate = new Date(ey, em - 1 - (total - 1), 1);
      const startMk   = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;

      return mk >= startMk && mk <= dataFinal;
    });
  },

  sum(list) { return list.reduce((s, x) => s + (Number(x.valor) || 0), 0); },
};
