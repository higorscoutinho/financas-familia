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

/* =========================================================
   EXTRATO DE PAGAMENTOS — ADIÇÃO INDEPENDENTE
   Não altera a lógica existente do aplicativo.
   Apenas adiciona o botão no Dashboard e a geração do PDF
   com os itens ainda não pagos do mês selecionado.
   ========================================================= */
(function () {
  const RESUMO_BTN_ID = "ff-gerar-resumo-btn";
  const PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function num(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const s = String(value ?? "").replace(/R\$\s?/g, "").trim();
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
    if (s.includes(",")) return Number(s.replace(",", ".")) || 0;
    return Number(s) || 0;
  }

  function money(value) {
    return num(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function dateBR(value) {
    if (!value) return "—";
    const s = String(value);
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    const br = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    if (br) return `${br[1]}/${br[2]}/${br[3]}`;
    return s;
  }

  function monthName(mk) {
    const [y, m] = String(mk || "").split("-").map(Number);
    if (!y || !m) return mk || "";
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function monthOf(value) {
    if (!value) return "";
    const s = String(value);
    const iso = s.match(/^(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;
    const br = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    if (br) return `${br[3]}-${br[2]}`;
    return "";
  }

  function isPaid(item) {
    if (!item) return false;
    if (item.pago === true || item.pago === "true" || String(item.pago).toUpperCase() === "SIM") return true;
    if (["pago", "quitada", "paid", "sim"].includes(String(item.status || "").toLowerCase())) return true;
    return !!(item.dataPagamento || item.dataPgto || item.dataPagamentoISO);
  }

  function field(item, names, fallback = "") {
    for (const name of names) {
      if (item && item[name] !== undefined && item[name] !== null && item[name] !== "") return item[name];
    }
    return fallback;
  }

  function getInstallmentDate(p, mk) {
    const explicit = field(p, ["vencimento", "dataVencimento", "diaVencimento"]);
    if (explicit) {
      if (/^\d{1,2}$/.test(String(explicit))) {
        const [y, m] = mk.split("-").map(Number);
        return `${y}-${String(m).padStart(2, "0")}-${String(Number(explicit)).padStart(2, "0")}`;
      }
      if (monthOf(explicit) === mk) return explicit;
    }
    const dia = field(p, ["dia", "diaVencimento", "vencimentoDia"], "");
    if (dia && /^\d{1,2}$/.test(String(dia))) {
      const [y, m] = mk.split("-").map(Number);
      return `${y}-${String(m).padStart(2, "0")}-${String(Number(dia)).padStart(2, "0")}`;
    }
    return "";
  }

  function collect(mk) {
    const d = Store.data || {};

    const fixas = (typeof Store.monthFixedBills === "function" ? Store.monthFixedBills(mk) : (d.contasFixas || []))
      .filter(c => !isPaid(c));

    const despesas = (typeof Store.monthDespesas === "function" ? Store.monthDespesas(mk) : (d.despesas || []))
      .filter(x => !isPaid(x));

    const parcelamentos = (typeof Store.monthParcelamentos === "function" ? Store.monthParcelamentos(mk) : (d.parcelamentos || []))
      .filter(p => {
        if (typeof Store.isParcelamentoPago === "function" && Store.isParcelamentoPago(p.id, mk)) return false;
        return true;
      });

    const dividas = (d.dividas || []).filter(x => {
      if (String(x.status || "").toLowerCase() === "quitada") return false;
      const venc = field(x, ["dataVencimento", "vencimento", "data"]);
      const vm = monthOf(venc);
      return !vm || vm === mk || String(x.status || "").toLowerCase() === "em_atraso";
    });

    return { fixas, despesas, parcelamentos, dividas };
  }

  function injectButton() {
    if (typeof App === "undefined" || App.currentPage !== "dashboard") return;
    const main = document.getElementById("main-content");
    if (!main || document.getElementById(RESUMO_BTN_ID)) return;

    main.style.position = main.style.position || "relative";
    const btn = document.createElement("button");
    btn.id = RESUMO_BTN_ID;
    btn.type = "button";
    btn.title = "Gerar resumo do que falta pagar";
    btn.setAttribute("aria-label", "Gerar resumo do que falta pagar");
    btn.innerHTML = "<span style=\"font-size:13px;line-height:1;\">▤</span><span>Resumo</span>";
    btn.style.cssText = [
      "position:absolute", "top:10px", "right:14px", "z-index:20", "display:flex",
      "align-items:center", "gap:5px", "height:30px", "padding:0 9px", "border-radius:8px",
      "border:1px solid var(--border-color,#d9dce5)", "background:var(--card-bg,#fff)",
      "color:var(--text-primary,#202124)", "font:600 12px/1 Arial,sans-serif", "cursor:pointer",
      "box-shadow:0 2px 7px rgba(0,0,0,.08)"
    ].join(";");
    btn.onclick = generatePDF;
    main.appendChild(btn);
  }

  function loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
      const existing = document.querySelector('script[data-ff-jspdf="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.jspdf.jsPDF));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = PDF_CDN;
      script.async = true;
      script.dataset.ffJspdf = "1";
      script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF não carregou"));
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function addPageIfNeeded(doc, y, needed = 12) {
    if (y + needed > 278) {
      doc.addPage();
      return 16;
    }
    return y;
  }

  function drawSection(doc, y, title, rows) {
    y = addPageIfNeeded(doc, y, 25);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(12, y - 6, 186, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 44, 52);
    doc.text(title, 16, y + 1);
    y += 9;

    if (!rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 116, 126);
      doc.text("Nenhum pagamento pendente nesta categoria.", 16, y + 1);
      return y + 9;
    }

    doc.setFillColor(61, 90, 254);
    doc.rect(12, y - 4, 186, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Descrição", 15, y + 1);
    doc.text("Categoria", 92, y + 1);
    doc.text("Vencimento", 137, y + 1);
    doc.text("Valor", 180, y + 1, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    rows.forEach((r, idx) => {
      y = addPageIfNeeded(doc, y, 10);
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 251);
        doc.rect(12, y - 4, 186, 9, "F");
      }
      doc.setTextColor(45, 48, 55);
      const desc = doc.splitTextToSize(String(r.descricao || "—"), 72)[0];
      const cat = doc.splitTextToSize(String(r.categoria || "—"), 40)[0];
      doc.text(desc, 15, y + 1);
      doc.text(cat, 92, y + 1);
      doc.text(dateBR(r.vencimento), 137, y + 1);
      doc.text(money(r.valor), 195, y + 1, { align: "right" });
      y += 9;
    });
    return y + 5;
  }

  function normalizeRows(data, mk) {
    const fixas = data.fixas.map(x => ({
      descricao: field(x, ["descricao", "nome", "titulo"], "Conta fixa"),
      categoria: field(x, ["categoria", "tipo"], "Fixa"),
      vencimento: field(x, ["vencimento", "dataVencimento", "data"], ""),
      valor: field(x, ["valor", "valorTotal", "valorParcela"], 0)
    }));

    const despesas = data.despesas.map(x => ({
      descricao: field(x, ["descricao", "nome", "titulo"], "Despesa"),
      categoria: field(x, ["categoria", "tipo"], "Despesa"),
      vencimento: field(x, ["vencimento", "dataVencimento", "data"], ""),
      valor: field(x, ["valor", "valorTotal"], 0)
    }));

    const parcelamentos = data.parcelamentos.map(x => {
      const parcela = typeof Store.getInstallmentForMonth === "function" ? Store.getInstallmentForMonth(x, mk) : field(x, ["parcelaAtual"], "");
      return {
        descricao: `${field(x, ["descricao", "nome", "titulo"], "Parcelamento")} — parcela ${parcela}/${field(x, ["qtdTotal", "totalParcelas"], "?")}`,
        categoria: field(x, ["categoria", "tipo"], "Parcelado"),
        vencimento: getInstallmentDate(x, mk),
        valor: field(x, ["valorParcela", "valor", "valorMensal"], 0)
      };
    });

    const dividas = data.dividas.map(x => ({
      descricao: field(x, ["descricao", "credor", "nome", "titulo"], "Dívida"),
      categoria: "Dívida",
      vencimento: field(x, ["dataVencimento", "vencimento", "data"], ""),
      valor: field(x, ["valorRestante", "valorAtual", "valor"], 0)
    }));

    return { fixas, despesas, parcelamentos, dividas };
  }

  async function generatePDF() {
    if (typeof Store === "undefined" || typeof App === "undefined") return;
    const mk = App.selectedMonth;
    const raw = collect(mk);
    const rows = normalizeRows(raw, mk);
    const total = [...rows.fixas, ...rows.despesas, ...rows.parcelamentos, ...rows.dividas]
      .reduce((sum, x) => sum + num(x.valor), 0);

    const btn = document.getElementById(RESUMO_BTN_ID);
    if (btn) { btn.disabled = true; btn.style.opacity = ".65"; btn.querySelectorAll("span")[1].textContent = "Gerando…"; }

    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setProperties({ title: `Resumo de pagamentos — ${monthName(mk)}`, subject: "Pagamentos pendentes do mês" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(35, 38, 45);
      doc.text("Resumo de pagamentos", 12, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(105, 110, 120);
      doc.text(monthName(mk), 12, 25);
      doc.text(`Total pendente: ${money(total)}`, 195, 25, { align: "right" });

      let y = 37;
      y = drawSection(doc, y, "CONTAS FIXAS", rows.fixas);
      y = drawSection(doc, y, "DESPESAS", rows.despesas);
      y = drawSection(doc, y, "PARCELAMENTOS", rows.parcelamentos);
      if (rows.dividas.length) y = drawSection(doc, y, "DÍVIDAS", rows.dividas);

      const pages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setDrawColor(225, 227, 232);
        doc.line(12, 286, 198, 286);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(130, 134, 142);
        doc.text("Gerado pelo Finanças Família", 12, 291);
        doc.text(`${p}/${pages}`, 198, 291, { align: "right" });
      }

      doc.save(`resumo-pagamentos-${mk}.pdf`);
      if (typeof Utils !== "undefined" && Utils.toast) Utils.toast("Resumo PDF gerado ✓");
    } catch (err) {
      console.error("Erro ao gerar resumo PDF:", err);
      if (typeof Utils !== "undefined" && Utils.toast) Utils.toast("Não foi possível gerar o PDF.");
      alert("Não foi possível gerar o PDF. Verifique sua conexão com a internet e tente novamente.");
    } finally {
      const b = document.getElementById(RESUMO_BTN_ID);
      if (b) { b.disabled = false; b.style.opacity = "1"; b.querySelectorAll("span")[1].textContent = "Resumo"; }
    }
  }

  // O Dashboard é renderizado por pages.js. Este pequeno observador apenas
  // recoloca o botão após cada renderização/troca de mês, sem tocar no layout existente.
  function install() {
    const originalRender = window.Pages && Pages.render;
    if (originalRender && !Pages.__ffResumoWrapped) {
      Pages.render = function () {
        const result = originalRender.apply(this, arguments);
        setTimeout(injectButton, 0);
        setTimeout(injectButton, 80);
        return result;
      };
      Pages.__ffResumoWrapped = true;
    }
    setTimeout(injectButton, 120);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
