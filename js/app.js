/* =========================================================
   app.js — Núcleo da interface: navegação, páginas, modais
   ========================================================= */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "🏠" },
  { id: "fixas", label: "Contas Fixas", icon: "📌" },
  { id: "despesas", label: "Despesas", icon: "💸" },
  { id: "receitas", label: "Receitas", icon: "💰" },
  { id: "cartoes", label: "Cartões", icon: "💳" },
  { id: "parcelamentos", label: "Parcelamentos", icon: "📦" },
  { id: "metas", label: "Metas", icon: "🎯" },
  { id: "relatorios", label: "Relatórios", icon: "📊" },
  { id: "config", label: "Configurações", icon: "⚙️" },
];
const BOTTOM_NAV_IDS = ["dashboard", "despesas", "fixas", "relatorios"];

const App = {
  currentUser: null,
  currentPage: "dashboard",
  filters: { categoria: "todas", status: "todos", busca: "" },

  async start() {
    // tema
    const savedTheme = localStorage.getItem(LS_THEME) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);

    const savedUser = localStorage.getItem(LS_USER);
    this.renderLogin();

    if (savedUser) {
      this.currentUser = savedUser;
      await this.enterApp();
    }
  },

  renderLogin() {
    document.getElementById("btn-user1").onclick = () => this.login(document.getElementById("btn-user1").dataset.name || "Usuário 1");
    document.getElementById("btn-user2").onclick = () => this.login(document.getElementById("btn-user2").dataset.name || "Usuário 2");
  },

  async login(name) {
    this.currentUser = name;
    localStorage.setItem(LS_USER, name);
    await this.enterApp();
  },

  logout() {
    localStorage.removeItem(LS_USER);
    location.reload();
  },

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

  buildNav() {
    const navList = document.getElementById("nav-list");
    navList.innerHTML = NAV_ITEMS.map(
      (it) => `<li class="nav-item" data-page="${it.id}"><span class="ic">${it.icon}</span>${it.label}</li>`
    ).join("");
    navList.querySelectorAll(".nav-item").forEach((el) => {
      el.onclick = () => this.goTo(el.dataset.page);
    });

    const bottomNav = document.getElementById("bottom-nav");
    bottomNav.innerHTML =
      BOTTOM_NAV_IDS.map((id) => {
        const it = NAV_ITEMS.find((n) => n.id === id);
        return `<button class="bn-item" data-page="${id}"><span class="ic">${it.icon}</span>${it.label}</button>`;
      }).join("") + `<button class="bn-item bn-more" data-page="more"><span class="ic">⋯</span>Mais</button>`;

    bottomNav.querySelectorAll(".bn-item").forEach((el) => {
      el.onclick = () => (el.dataset.page === "more" ? this.openMoreMenu() : this.goTo(el.dataset.page));
    });

    const moreCard = document.getElementById("more-menu-card");
    moreCard.innerHTML = NAV_ITEMS.filter((n) => !BOTTOM_NAV_IDS.includes(n.id))
      .map((it) => `<button class="mm-item" data-page="${it.id}"><span class="ic-wrap">${it.icon}</span>${it.label}</button>`)
      .join("");
    moreCard.querySelectorAll(".mm-item").forEach((el) => {
      el.onclick = () => {
        this.closeMoreMenu();
        this.goTo(el.dataset.page);
      };
    });
  },

  openMoreMenu() { document.getElementById("more-menu-sheet").classList.add("active"); },
  closeMoreMenu() { document.getElementById("more-menu-sheet").classList.remove("active"); },

  goTo(page) {
    this.currentPage = page;
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    document.querySelectorAll(".bn-item").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    Pages.render(page);
  },

  bindGlobalEvents() {
    document.getElementById("theme-toggle-btn").onclick = () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    };
    document.getElementById("logout-btn").onclick = () => this.logout();
    document.getElementById("fab-add").onclick = () => Modals.openQuickAdd();
    document.getElementById("more-menu-sheet").onclick = (e) => {
      if (e.target.id === "more-menu-sheet") this.closeMoreMenu();
    };

    // Atalhos de teclado: D = nova despesa, R = nova receita, / = busca
    document.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase() === "d") Modals.openDespesa();
      if (e.key.toLowerCase() === "r") Modals.openReceita();
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); }
      if (e.key === "Escape") Modals.closeAll();
    });
  },
};

document.addEventListener("DOMContentLoaded", () => App.start());
