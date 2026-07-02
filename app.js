/* =========================================================
   app.js — Núcleo: navegação, seletor de mês global
   MUDANÇAS:
   - App.selectedMonth → mês selecionado globalmente
   - setMonth() → troca o mês e re-renderiza tudo
   ========================================================= */

const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",       icon: "🏠" },
  { id: "fixas",         label: "Contas Fixas",     icon: "📌" },
  { id: "despesas",      label: "Despesas",         icon: "💸" },
  { id: "receitas",      label: "Receitas",         icon: "💰" },
  { id: "cartoes",       label: "Cartões",          icon: "💳" },
  { id: "parcelamentos", label: "Parcelamentos",    icon: "📦" },
  { id: "metas",         label: "Metas",            icon: "🎯" },
  { id: "relatorios",    label: "Relatórios",       icon: "📊" },
  { id: "config",        label: "Configurações",    icon: "⚙️" },
];
const BOTTOM_NAV_IDS = ["dashboard", "despesas", "fixas", "relatorios"];

const App = {
  currentUser:   null,
  currentPage:   "dashboard",
  selectedMonth: Utils.currentMonthKey(), // "2026-06" — muda via setMonth()
  filters: { categoria: "todas", status: "todos", busca: "" },

  // -------- Auth --------
  async start() {
    const savedTheme = localStorage.getItem(LS_THEME) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.renderLogin();
    const savedUser = localStorage.getItem(LS_USER);
    if (savedUser) { this.currentUser = savedUser; await this.enterApp(); }
  },

  renderLogin() {
    document.getElementById("btn-user1").onclick = () => this.login(window.APP_CONFIG?.USER_1 || "Usuário 1");
    document.getElementById("btn-user2").onclick = () => this.login(window.APP_CONFIG?.USER_2 || "Usuário 2");
    document.getElementById("btn-user1").dataset.name = window.APP_CONFIG?.USER_1 || "Usuário 1";
    document.getElementById("btn-user2").dataset.name = window.APP_CONFIG?.USER_2 || "Usuário 2";
    document.getElementById("btn-user1").querySelector(".user-avatar").textContent = (window.APP_CONFIG?.USER_1 || "U1")[0];
    document.getElementById("btn-user2").querySelector(".user-avatar").textContent = (window.APP_CONFIG?.USER_2 || "U2")[0];
    document.querySelector("#btn-user1 .user-label").textContent = window.APP_CONFIG?.USER_1 || "Usuário 1";
    document.querySelector("#btn-user2 .user-label").textContent = window.APP_CONFIG?.USER_2 || "Usuário 2";
  },

  async login(name) {
    this.currentUser = name;
    localStorage.setItem(LS_USER, name);
    await this.enterApp();
  },

  logout() { localStorage.removeItem(LS_USER); location.reload(); },

  async enterApp() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").classList.add("active");
    document.getElementById("current-user-name").textContent = this.currentUser;
    document.getElementById("user-avatar-letter").textContent = this.currentUser?.[0]?.toUpperCase() || "?";
    this.buildNav();
    await Store.init();
    this.goTo("dashboard");
    this.bindGlobalEvents();
  },

  // -------- Seletor de mês global --------
  setMonth(mk) {
    this.selectedMonth = mk;
    // Atualiza o input tipo month em qualquer lugar que esteja visível
    document.querySelectorAll(".month-picker-input").forEach((el) => { el.value = mk; });
    Pages.render(this.currentPage);
  },

  prevMonth() {
    const [y, m] = this.selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  },

  nextMonth() {
    const [y, m] = this.selectedMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  },

  isCurrentMonth() { return this.selectedMonth === Utils.currentMonthKey(); },

  // -------- Nav --------
  buildNav() {
    const navList = document.getElementById("nav-list");
    navList.innerHTML = NAV_ITEMS.map(
      (it) => `<li class="nav-item" data-page="${it.id}"><span class="ic">${it.icon}</span>${it.label}</li>`
    ).join("");
    navList.querySelectorAll(".nav-item").forEach((el) => { el.onclick = () => this.goTo(el.dataset.page); });

    const bottomNav = document.getElementById("bottom-nav");
    bottomNav.innerHTML = BOTTOM_NAV_IDS.map((id) => {
      const it = NAV_ITEMS.find((n) => n.id === id);
      return `<button class="bn-item" data-page="${id}"><span class="ic">${it.icon}</span>${it.label}</button>`;
    }).join("") + `<button class="bn-item bn-more" data-page="more"><span class="ic">⋯</span>Mais</button>`;

    bottomNav.querySelectorAll(".bn-item").forEach((el) => {
      el.onclick = () => (el.dataset.page === "more" ? this.openMoreMenu() : this.goTo(el.dataset.page));
    });

    const moreCard = document.getElementById("more-menu-card");
    moreCard.innerHTML = NAV_ITEMS.filter((n) => !BOTTOM_NAV_IDS.includes(n.id))
      .map((it) => `<button class="mm-item" data-page="${it.id}"><span class="ic-wrap">${it.icon}</span>${it.label}</button>`).join("");
    moreCard.querySelectorAll(".mm-item").forEach((el) => {
      el.onclick = () => { this.closeMoreMenu(); this.goTo(el.dataset.page); };
    });
  },

  openMoreMenu()  { document.getElementById("more-menu-sheet").classList.add("active"); },
  closeMoreMenu() { document.getElementById("more-menu-sheet").classList.remove("active"); },

  goTo(page) {
    this.currentPage = page;
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    document.querySelectorAll(".bn-item").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    Pages.render(page);
  },

  bindGlobalEvents() {
    document.getElementById("theme-toggle-btn").onclick = () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    };
    document.getElementById("logout-btn").onclick = () => this.logout();
    document.getElementById("fab-add").onclick = () => Modals.openQuickAdd();
    document.getElementById("more-menu-sheet").onclick = (e) => {
      if (e.target.id === "more-menu-sheet") this.closeMoreMenu();
    };
    document.addEventListener("keydown", (e) => {
      if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase() === "d") Modals.openDespesa();
      if (e.key.toLowerCase() === "r") Modals.openReceita();
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (e.key === "Escape") Modals.closeAll();
      if (e.key === "ArrowLeft")  this.prevMonth();
      if (e.key === "ArrowRight") this.nextMonth();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => App.start());
