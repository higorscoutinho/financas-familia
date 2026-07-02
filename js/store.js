/* =========================================================
   store.js — Estado + sincronização com Google Sheets
   MUDANÇAS:
   - monthParcelamentos(mk) → retorna parcelas ativas no mês
   - monthTotals(mk)        → soma tudo (despesas + fixas pagas + parcelas)
   - Consultas agora recebem `mk` dinamicamente (usa App.selectedMonth)
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

const Store = {
  data: {
    receitas:       [],
    despesas:       [],
    contasFixas:    [],
    cartoes:        [],
    parcelamentos:  [],
    categorias:     [...DEFAULT_CATEGORIES],
    metas:          [],
    configuracoes:  { metaEconomiaMensal: 0 },
    logs:           [],
  },
  queue:   [],
  syncing: false,

  loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
      const q = localStorage.getItem(LS_QUEUE);
      if (q) this.queue = JSON.parse(q);
    } catch(e) { console.warn("Cache local corrompido", e); }
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
        Utils.toast("Offline — usando dados salvos localmente");
      }
      this.flushQueue();
    }
    this.ensureCurrentMonthFixedBills();
  },

  /** Recria contas fixas do mês atual se ainda não existirem */
  ensureCurrentMonthFixedBills() {
    const mk = Utils.currentMonthKey();
    // Pega os "templates" (registros mais recentes de cada nome)
    const templates = new Map();
    this.data.contasFixas.forEach((c) => {
      const prev = templates.get(c.nome);
      if (!prev || (c.mesReferencia || "") > (prev.mesReferencia || "")) templates.set(c.nome, c);
    });
    const existingThisMonth = new Set(
      this.data.contasFixas.filter((c) => c.mesReferencia === mk).map((c) => c.nome)
    );
    templates.forEach((tpl) => {
      if (!existingThisMonth.has(tpl.nome)) {
        const novo = {
          ...tpl,
          id:              Utils.uid("fix"),
          mesReferencia:   mk,
          pago:            false,
          dataPagamento:   "",
          horaPagamento:   "",
        };
        this.data.contasFixas.push(novo);
        this.queueChange("ContasFixas", "create", novo);
      }
    });
    this.saveLocal();
  },

  queueChange(sheet, op, data) {
    this.queue.push({ sheet, op, data, user: typeof App !== "undefined" ? App.currentUser : "?", ts: Date.now() });
    this.saveLocal();
    this.flushQueue();
  },

  async flushQueue() {
    if (this.syncing || !API.isConfigured() || !this.queue.length) return;
    this.syncing = true;
    while (this.queue.length) {
      const item = this.queue[0];
      const res = await API.send(item.sheet, item.op, item.data, item.user);
      if (!res || res.ok === false) break;
      this.queue.shift();
      this.saveLocal();
    }
    this.syncing = false;
  },

  // ------- CRUD genérico -------
  add(collectionKey, sheetName, record) {
    record.id = record.id || Utils.uid(collectionKey.slice(0,3));
    record.criadoPor = typeof App !== "undefined" ? App.currentUser : "?";
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
      usuario: typeof App !== "undefined" ? App.currentUser : "?",
      data: Utils.todayISO(),
      hora: new Date().toLocaleTimeString("pt-BR"),
      aba: sheet, registroId: id,
      valorAntigo: before.valor ?? before.pago ?? "",
      valorNovo:   after.valor  ?? after.pago  ?? "",
    });
    this.data.logs = this.data.logs.slice(0, 300);
  },

  // ------- Consultas por mês (recebem mk como parâmetro) -------
  monthDespesas(mk)    { return this.data.despesas.filter((d) => Utils.monthKey(d.data) === mk); },
  monthReceitas(mk)    { return this.data.receitas.filter((r) => Utils.monthKey(r.data) === mk); },
  monthFixedBills(mk)  { return this.data.contasFixas.filter((c) => c.mesReferencia === mk); },

  /**
   * Parcelas ativas em um determinado mês.
   * Um parcelamento está ativo no mês mk se:
   *   - a parcela atual (parcelaAtual) corresponde a esse mês, OU
   *   - o mês está entre o mês de início implícito e a data final.
   * Como normalmente não guardamos "data de início", calculamos:
   *   dataInicio = dataFinal − (qtdTotal − 1) meses
   * e verificamos se mk está dentro do intervalo.
   */
  monthParcelamentos(mk) {
    return this.data.parcelamentos.filter((p) => {
      if (!p.dataFinal) return true; // sem data final, considera sempre ativo
      const [fy, fm] = p.dataFinal.slice(0, 7).split("-").map(Number);
      const total = Number(p.qtdTotal) || 1;
      // mês de início = dataFinal − (total-1) meses
      const startDate = new Date(fy, fm - 1 - (total - 1), 1);
      const startMk   = `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,"0")}`;
      const endMk     = p.dataFinal.slice(0, 7);
      return mk >= startMk && mk <= endMk;
    });
  },

  sum(list) { return list.reduce((s, x) => s + (Number(x.valor) || 0), 0); },

  /**
   * Soma total de saídas no mês: despesas variáveis + fixas + parcelas.
   */
  monthTotalSaidas(mk) {
    return this.sum(this.monthDespesas(mk))
         + this.sum(this.monthFixedBills(mk))
         + this.sum(this.monthParcelamentos(mk).map((p) => ({ valor: p.valorParcela })));
  },
};
