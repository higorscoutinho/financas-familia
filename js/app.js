/* =========================================================
   app.js — Navegação + seletor de mês global
   ADICIONADO: Dívidas no menu (posição 2)
   ========================================================= */

const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",      icon: "🏠" },
  { id: "dividas",       label: "Dívidas",        icon: "🔴" },
  { id: "fixas",         label: "Contas Fixas",   icon: "📌" },
  { id: "parcelamentos", label: "Parcelamentos",  icon: "📦" },
  { id: "despesas",      label: "Despesas",       icon: "💸" },
  { id: "receitas",      label: "Receitas",       icon: "💰" },
  { id: "metas",         label: "Metas",          icon: "🎯" },
  { id: "relatorios",    label: "Relatórios",     icon: "📊" },
  { id: "cartoes",       label: "Cartões",        icon: "💳" },
  { id: "config",        label: "Configurações",  icon: "⚙️" },
];

const BOTTOM_NAV_IDS = ["dashboard", "dividas", "despesas", "fixas"];

const App = {
  currentUser:   null,
  currentPage:   "dashboard",
  selectedMonth: Utils.currentMonthKey(),
  filters:       { categoria: "todas", busca: "" },

  async start() {
    const saved = localStorage.getItem(LS_THEME) || "light";
    document.documentElement.setAttribute("data-theme", saved);
    this.renderLogin();
    const savedUser = localStorage.getItem(LS_USER);
    if (savedUser) { this.currentUser = savedUser; await this.enterApp(); }
  },

  renderLogin() {
    const u1 = window.APP_CONFIG?.USER_1 || "Usuário 1";
    const u2 = window.APP_CONFIG?.USER_2 || "Usuário 2";
    const b1 = document.getElementById("btn-user1");
    const b2 = document.getElementById("btn-user2");
    b1.dataset.name = u1; b2.dataset.name = u2;
    b1.querySelector(".user-avatar").textContent = u1[0].toUpperCase();
    b2.querySelector(".user-avatar").textContent = u2[0].toUpperCase();
    b1.querySelector(".user-label").textContent  = u1;
    b2.querySelector(".user-label").textContent  = u2;
    b1.onclick = () => this.login(u1);
    b2.onclick = () => this.login(u2);
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
    document.getElementById("current-user-name").textContent  = this.currentUser;
    document.getElementById("user-avatar-letter").textContent = this.currentUser[0].toUpperCase();
    this.buildNav();
    await Store.init();
    this.goTo("dashboard");
    this.bindGlobalEvents();
  },

  setMonth(mk) {
    if (!mk) return;
    this.selectedMonth = mk;
    document.querySelectorAll(".month-picker-input").forEach((el) => { el.value = mk; });
    Store.ensureFixedBillsForMonth(mk);
    Pages.render(this.currentPage);
  },

  prevMonth() {
    const [y,m] = this.selectedMonth.split("-").map(Number);
    const d = new Date(y, m-2, 1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  },

  nextMonth() {
    const [y,m] = this.selectedMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  },

  isCurrentMonth() { return this.selectedMonth === Utils.currentMonthKey(); },

  buildNav() {
    const navList = document.getElementById("nav-list");
    navList.innerHTML = NAV_ITEMS.map(
      (it) => `<li class="nav-item" data-page="${it.id}"><span class="ic">${it.icon}</span>${it.label}</li>`
    ).join("");
    navList.querySelectorAll(".nav-item").forEach((el) => { el.onclick = () => this.goTo(el.dataset.page); });

    const bottomNav = document.getElementById("bottom-nav");
    bottomNav.innerHTML =
      BOTTOM_NAV_IDS.map((id) => {
        const it = NAV_ITEMS.find((n) => n.id===id);
        return `<button class="bn-item" data-page="${id}"><span class="ic">${it.icon}</span>${it.label}</button>`;
      }).join("") +
      `<button class="bn-item bn-more" data-page="more"><span class="ic">⋯</span>Mais</button>`;
    bottomNav.querySelectorAll(".bn-item").forEach((el) => {
      el.onclick = () => el.dataset.page==="more" ? this.openMoreMenu() : this.goTo(el.dataset.page);
    });

    const moreCard = document.getElementById("more-menu-card");
    moreCard.innerHTML = NAV_ITEMS
      .filter((n) => !BOTTOM_NAV_IDS.includes(n.id))
      .map((it) => `<button class="mm-item" data-page="${it.id}"><span class="ic-wrap">${it.icon}</span>${it.label}</button>`)
      .join("");
    moreCard.querySelectorAll(".mm-item").forEach((el) => {
      el.onclick = () => { this.closeMoreMenu(); this.goTo(el.dataset.page); };
    });
  },

  openMoreMenu()  { document.getElementById("more-menu-sheet").classList.add("active"); },
  closeMoreMenu() { document.getElementById("more-menu-sheet").classList.remove("active"); },

  goTo(page) {
    this.currentPage = page;
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.page===page));
    document.querySelectorAll(".bn-item").forEach((el) => el.classList.toggle("active", el.dataset.page===page));
    Pages.render(page);
  },

  bindGlobalEvents() {
    document.getElementById("theme-toggle-btn").onclick = () => {
      const next = document.documentElement.getAttribute("data-theme")==="dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    };
    document.getElementById("logout-btn").onclick  = () => this.logout();
    document.getElementById("fab-add").onclick     = () => Modals.openQuickAdd();
    document.getElementById("more-menu-sheet").onclick = (e) => {
      if (e.target.id==="more-menu-sheet") this.closeMoreMenu();
    };
    document.addEventListener("keydown", (e) => {
      if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase()==="d") Modals.openDespesa();
      if (e.key.toLowerCase()==="r") Modals.openReceita();
      if (e.key==="ArrowLeft")  this.prevMonth();
      if (e.key==="ArrowRight") this.nextMonth();
      if (e.key==="Escape")     Modals.closeAll();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => App.start());
