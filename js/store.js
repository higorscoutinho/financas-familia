/* =========================================================
   store.js — Estado da aplicação + sincronização com Sheets
   Estratégia: "local-first". Toda ação grava instantaneamente
   no estado local (e na tela) e dispara, em paralelo, a
   gravação na planilha Google Sheets. Se estiver offline ou
   sem API configurada, fica salvo no localStorage e uma fila
   de pendências é reenviada quando possível.
   ========================================================= */

const DEFAULT_CATEGORIES = [
  "Moradia", "Mercado", "Farmácia", "Restaurantes", "Lazer", "Combustível",
  "Carro", "Moto", "Pets", "Saúde", "Educação", "Assinaturas", "Streaming",
  "Viagem", "Investimentos", "Outros",
];

const LS_KEY = "ff_data_v1";
const LS_QUEUE = "ff_queue_v1";
const LS_USER = "ff_user_v1";
const LS_THEME = "ff_theme_v1";

const Store = {
  data: {
    receitas: [],
    despesas: [],
    contasFixas: [],
    cartoes: [],
    parcelamentos: [],
    categorias: [...DEFAULT_CATEGORIES],
    metas: [],
    configuracoes: { metaEconomiaMensal: 0 },
    logs: [],
  },

  queue: [],
  syncing: false,

  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      const q = localStorage.getItem(LS_QUEUE);
      if (q) this.queue = JSON.parse(q);
    } catch (e) { console.warn("Cache local corrompido", e); }
  },

  saveLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    localStorage.setItem(LS_QUEUE, JSON.stringify(this.queue));
  },

  async init() {
    this.loadLocal();
    if (API.isConfigured()) {
      const remote = await API.getAll();
      if (remote) {
        this.data = {
          receitas: remote.receitas || [],
          despesas: remote.despesas || [],
          contasFixas: remote.contasFixas || [],
          cartoes: remote.cartoes || [],
          parcelamentos: remote.parcelamentos || [],
          categorias: remote.categorias?.length ? remote.categorias : [...DEFAULT_CATEGORIES],
          metas: remote.metas || [],
          configuracoes: remote.configuracoes || { metaEconomiaMensal: 0 },
          logs: remote.logs || [],
        };
        this.saveLocal();
        Utils.toast("Sincronizado com Google Sheets ✓");
      } else {
        Utils.toast("Offline — usando dados salvos no aparelho");
      }
      this.flushQueue();
    }
    this.ensureCurrentMonthFixedBills();
  },

  /** Garante que as contas fixas do mês atual existam (recriação automática mensal) */
  ensureCurrentMonthFixedBills() {
    const mk = Utils.currentMonthKey();
    const templates = new Map();
    this.data.contasFixas.forEach((c) => {
      if (!templates.has(c.nome)) templates.set(c.nome, c);
    });
    const existingThisMonth = new Set(
      this.data.contasFixas.filter((c) => c.mesReferencia === mk).map((c) => c.nome)
    );
    templates.forEach((tpl) => {
      if (!existingThisMonth.has(tpl.nome)) {
        const novo = {
          ...tpl,
          id: Utils.uid("fix"),
          mesReferencia: mk,
          pago: false,
          dataPagamento: "",
          horaPagamento: "",
        };
        this.data.contasFixas.push(novo);
        this.queueChange("ContasFixas", "create", novo);
      }
    });
    this.saveLocal();
  },

  queueChange(sheet, op, data) {
    this.queue.push({ sheet, op, data, user: App.currentUser, ts: Date.now() });
    this.saveLocal();
    this.flushQueue();
  },

  async flushQueue() {
    if (this.syncing || !API.isConfigured() || this.queue.length === 0) return;
    this.syncing = true;
    while (this.queue.length) {
      const item = this.queue[0];
      const res = await API.send(item.sheet, item.op, item.data, item.user);
      if (!res || res.ok === false) break; // tenta novamente mais tarde
      this.queue.shift();
      this.saveLocal();
    }
    this.syncing = false;
  },

  // ------- CRUD genérico por coleção -------
  add(collectionKey, sheetName, record) {
    record.id = record.id || Utils.uid(collectionKey.slice(0, 3));
    record.criadoPor = App.currentUser;
    this.data[collectionKey].push(record);
    this.saveLocal();
    this.queueChange(sheetName, "create", record);
    return record;
  },

  update(collectionKey, sheetName, id, patch) {
    const idx = this.data[collectionKey].findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const before = { ...this.data[collectionKey][idx] };
    this.data[collectionKey][idx] = { ...before, ...patch };
    this.saveLocal();
    this.queueChange(sheetName, "update", this.data[collectionKey][idx]);
    this.logChange(sheetName, id, before, this.data[collectionKey][idx]);
    return this.data[collectionKey][idx];
  },

  remove(collectionKey, sheetName, id) {
    this.data[collectionKey] = this.data[collectionKey].filter((r) => r.id !== id);
    this.saveLocal();
    this.queueChange(sheetName, "delete", { id });
  },

  logChange(sheet, id, before, after) {
    this.data.logs.unshift({
      id: Utils.uid("log"),
      usuario: App.currentUser,
      data: Utils.todayISO(),
      hora: new Date().toLocaleTimeString("pt-BR"),
      aba: sheet,
      registroId: id,
      valorAntigo: before.valor ?? before.pago ?? "",
      valorNovo: after.valor ?? after.pago ?? "",
    });
    this.data.logs = this.data.logs.slice(0, 300);
  },

  // ------- Consultas derivadas (mês atual etc.) -------
  monthDespesas(mk = Utils.currentMonthKey()) {
    return this.data.despesas.filter((d) => Utils.monthKey(d.data) === mk);
  },
  monthReceitas(mk = Utils.currentMonthKey()) {
    return this.data.receitas.filter((r) => Utils.monthKey(r.data) === mk);
  },
  monthFixedBills(mk = Utils.currentMonthKey()) {
    return this.data.contasFixas.filter((c) => c.mesReferencia === mk);
  },

  sum(list) {
    return list.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  },
};
