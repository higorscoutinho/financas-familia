/* =========================================================
   app.js — Núcleo da aplicação
   - Sem login próprio: Auth.js chama App.boot(userName)
   - Sem Cartões, sem Relatórios
   - Metas → Investimentos
   - Contas fixas: 100% manuais (sem auto-repetição)
   ========================================================= */

const NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",      icon: "🏠" },
  { id: "dividas",       label: "Dívidas",        icon: "🔴" },
  { id: "fixas",         label: "Contas Fixas",   icon: "📌" },
  { id: "parcelamentos", label: "Parcelamentos",  icon: "📦" },
  { id: "despesas",      label: "Despesas",       icon: "💸" },
  { id: "receitas",      label: "Receitas",       icon: "💰" },
  { id: "investimentos", label: "Investimentos",  icon: "📈" },
  { id: "anotacoes",     label: "Anotações",      icon: "📝" },
  { id: "config",        label: "Configurações",  icon: "⚙️" },
];

const BOTTOM_NAV_IDS = ["dashboard", "dividas", "despesas", "anotacoes"];

const App = {
  currentUser:   null,
  currentPage:   "dashboard",
  selectedMonth: Utils.currentMonthKey(),
  filters:       { categoria: "todas", busca: "" },

  // ── Chamado por auth.js após login validado ───────────
  async boot(userName) {
    this.currentUser = userName;
    document.getElementById("app").classList.add("active");
    document.getElementById("current-user-name").textContent  = userName;
    document.getElementById("user-avatar-letter").textContent = userName[0].toUpperCase();
    this.buildNav();
    await Store.init();
    this.goTo("dashboard");
    this.bindGlobalEvents();
  },

  // ── Seletor de mês ────────────────────────────────────
  setMonth(mk) {
    if (!mk) return;
    this.selectedMonth = mk;
    document.querySelectorAll(".month-picker-input").forEach(el => { el.value = mk; });
    // SEM auto-repetição de contas fixas — usuário gerencia manualmente
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

  // ── Navegação ─────────────────────────────────────────
  buildNav() {
    document.getElementById("nav-list").innerHTML = NAV_ITEMS.map(it =>
      `<li class="nav-item" data-page="${it.id}"><span class="ic">${it.icon}</span>${it.label}</li>`
    ).join("");
    document.querySelectorAll(".nav-item").forEach(el => { el.onclick = () => this.goTo(el.dataset.page); });

    const bottomNav = document.getElementById("bottom-nav");
    bottomNav.innerHTML =
      BOTTOM_NAV_IDS.map(id => {
        const it = NAV_ITEMS.find(n => n.id===id);
        return `<button class="bn-item" data-page="${id}"><span class="ic">${it.icon}</span>${it.label}</button>`;
      }).join("") +
      `<button class="bn-item bn-more" data-page="more"><span class="ic">⋯</span>Mais</button>`;

    document.querySelectorAll(".bn-item").forEach(el => {
      el.onclick = () => el.dataset.page==="more" ? this.openMoreMenu() : this.goTo(el.dataset.page);
    });

    const moreCard = document.getElementById("more-menu-card");
    moreCard.innerHTML = NAV_ITEMS
      .filter(n => !BOTTOM_NAV_IDS.includes(n.id))
      .map(it => `<button class="mm-item" data-page="${it.id}"><span class="ic-wrap">${it.icon}</span>${it.label}</button>`)
      .join("");
    moreCard.querySelectorAll(".mm-item").forEach(el => {
      el.onclick = () => { this.closeMoreMenu(); this.goTo(el.dataset.page); };
    });
  },

  openMoreMenu()  { document.getElementById("more-menu-sheet").classList.add("active"); },
  closeMoreMenu() { document.getElementById("more-menu-sheet").classList.remove("active"); },

  goTo(page) {
    this.currentPage = page;
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page===page));
    document.querySelectorAll(".bn-item").forEach(el  => el.classList.toggle("active", el.dataset.page===page));
    Pages.render(page);
  },

  bindGlobalEvents() {
    document.getElementById("theme-toggle-btn").onclick = () => {
      const next = document.documentElement.getAttribute("data-theme")==="dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(LS_THEME, next);
    };
    document.getElementById("logout-btn").onclick      = () => Auth.logout();
    document.getElementById("fab-add").onclick         = () => Modals.openQuickAdd();
    document.getElementById("more-menu-sheet").onclick = e => {
      if (e.target.id==="more-menu-sheet") this.closeMoreMenu();
    };
    document.addEventListener("keydown", e => {
      if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase()==="d") Modals.openDespesa();
      if (e.key.toLowerCase()==="r") Modals.openReceita();
      if (e.key==="ArrowLeft")  this.prevMonth();
      if (e.key==="ArrowRight") this.nextMonth();
      if (e.key==="Escape")     Modals.closeAll();
    });
  },
};
