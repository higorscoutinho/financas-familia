/* =========================================================
   utils.js — Funções utilitárias compartilhadas
   ========================================================= */

const Utils = {
  uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  },

  brl(value) {
    const n = Number(value) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  },

  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  monthKey(dateStr) {
    // "2026-06-15" -> "2026-06"
    return (dateStr || Utils.todayISO()).slice(0, 7);
  },

  currentMonthKey() {
    return Utils.todayISO().slice(0, 7);
  },

  fmtDateShort(dateStr) {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  },

  fmtDateFull(dateStr) {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  },

  monthLabel(monthKey) {
    const [y, m] = monthKey.split("-");
    const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${names[parseInt(m, 10) - 1]} ${y}`;
  },

  daysUntil(dueDay) {
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), dueDay);
    const diff = Math.round((due - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    return diff;
  },

  daysInMonth(monthKey) {
    const [y, m] = monthKey.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  },

  dayOfMonthToday() {
    return new Date().getDate();
  },

  toast(msg, type = "default") {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  },

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  },

  // Paleta consistente para gráficos de categoria
  categoryColor(name) {
    const palette = ["#3D5AFE", "#1FA971", "#DD8B1B", "#E5484D", "#8E5BF2", "#1BBFD1", "#F25CA0", "#6B7280"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  },
};
