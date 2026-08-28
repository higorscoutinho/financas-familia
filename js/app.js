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
    if (typeof this.injectResumoButton === "function") setTimeout(() => this.injectResumoButton(), 0);
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
    if (typeof this.injectResumoButton === "function") setTimeout(() => this.injectResumoButton(), 0);
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
   RESUMO DO MÊS — ADIÇÃO ÚNICA
   Não altera a lógica existente. Apenas adiciona o botão
   de resumo no Dashboard e gera o PDF sob demanda.
   ========================================================= */
(function () {
  const BTN_ID = "ff-gerar-resumo-btn";
  const PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

  const val = (obj, names, fallback = "") => {
    for (const n of names) if (obj && obj[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
    return fallback;
  };

  const num = v => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v ?? "").replace(/R\$\s?/g, "").trim();
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
    if (s.includes(",")) return Number(s.replace(",", ".")) || 0;
    return Number(s) || 0;
  };

  const money = v => num(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dateBR = v => {
    if (!v) return "—";
    const s = String(v);
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    return m ? `${m[1]}/${m[2]}/${m[3]}` : s;
  };

  const monthName = mk => {
    const [y, m] = String(mk || "").split("-").map(Number);
    return y && m ? new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : mk;
  };

  const monthOf = v => {
    if (!v) return "";
    const s = String(v);
    let m = s.match(/^(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    return m ? `${m[3]}-${m[2]}` : "";
  };

  const paid = x => {
    if (!x) return false;
    if (x.pago === true || String(x.pago).toUpperCase() === "SIM") return true;
    if (["pago", "quitada", "paid", "sim"].includes(String(x.status || "").toLowerCase())) return true;
    return !!(x.dataPagamento || x.dataPgto || x.dataPagamentoISO);
  };

  function collect(mk) {
    const d = Store.data || {};
    const fixas = (Store.monthFixedBills ? Store.monthFixedBills(mk) : (d.contasFixas || [])).filter(x => !paid(x));
    const despesas = (Store.monthDespesas ? Store.monthDespesas(mk) : (d.despesas || [])).filter(x => !paid(x));
    const parcelamentos = (Store.monthParcelamentos ? Store.monthParcelamentos(mk) : (d.parcelamentos || [])).filter(x => {
      return !(Store.isParcelamentoPago && Store.isParcelamentoPago(x.id, mk));
    });
    const dividas = (d.dividas || []).filter(x => {
      if (String(x.status || "").toLowerCase() === "quitada") return false;
      const venc = val(x, ["dataVencimento", "vencimento", "data"]);
      const vm = monthOf(venc);
      return !vm || vm === mk || String(x.status || "").toLowerCase() === "em_atraso";
    });
    return { fixas, despesas, parcelamentos, dividas };
  }

  function normalize(raw, mk) {
    return {
      fixas: raw.fixas.map(x => ({
        descricao: val(x, ["descricao", "nome", "titulo"], "Conta fixa"),
        categoria: val(x, ["categoria", "tipo"], "Fixa"),
        vencimento: val(x, ["vencimento", "dataVencimento", "data"]),
        valor: val(x, ["valor", "valorTotal", "valorParcela"], 0)
      })),
      despesas: raw.despesas.map(x => ({
        descricao: val(x, ["descricao", "nome", "titulo"], "Despesa"),
        categoria: val(x, ["categoria", "tipo"], "Despesa"),
        vencimento: val(x, ["vencimento", "dataVencimento", "data"]),
        valor: val(x, ["valor", "valorTotal"], 0)
      })),
      parcelamentos: raw.parcelamentos.map(x => {
        const p = Store.getInstallmentForMonth ? Store.getInstallmentForMonth(x, mk) : val(x, ["parcelaAtual"], "");
        return {
          descricao: `${val(x, ["descricao", "nome", "titulo"], "Parcelamento")} — parcela ${p}/${val(x, ["qtdTotal", "totalParcelas"], "?")}`,
          categoria: val(x, ["categoria", "tipo"], "Parcelado"),
          vencimento: val(x, ["vencimento", "dataVencimento", "data"], ""),
          valor: val(x, ["valorParcela", "valor", "valorMensal"], 0)
        };
      }),
      dividas: raw.dividas.map(x => ({
        descricao: val(x, ["descricao", "credor", "nome", "titulo"], "Dívida"),
        categoria: "Dívida",
        vencimento: val(x, ["dataVencimento", "vencimento", "data"], ""),
        valor: val(x, ["valorRestante", "valorAtual", "valor"], 0)
      }))
    };
  }

  function inject() {
    if (typeof App === "undefined" || App.currentPage !== "dashboard") return;
    const main = document.getElementById("main-content");
    if (!main || document.getElementById(BTN_ID)) return;
    main.style.position = main.style.position || "relative";
    const b = document.createElement("button");
    b.id = BTN_ID;
    b.type = "button";
    b.title = "Gerar resumo do que falta pagar";
    b.innerHTML = "▤ Resumo";
    b.style.cssText = "position:absolute;top:10px;right:14px;z-index:30;height:30px;padding:0 9px;border:1px solid var(--border-color,#d9dce5);border-radius:8px;background:var(--card-bg,#fff);color:var(--text-primary,#202124);font:600 12px Arial,sans-serif;cursor:pointer;box-shadow:0 2px 7px rgba(0,0,0,.08);";
    b.onclick = generate;
    main.appendChild(b);
  }

  function loadPdfLib() {
    return new Promise((resolve, reject) => {
      if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
      const s = document.createElement("script");
      s.src = PDF_CDN;
      s.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF não carregou"));
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function addSection(doc, y, title, rows) {
    if (y > 260) { doc.addPage(); y = 18; }
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(12, y - 6, 186, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(45, 48, 55);
    doc.text(title, 16, y);
    y += 9;
    if (!rows.length) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(115,120,128);
      doc.text("Nenhum pagamento pendente nesta categoria.", 16, y);
      return y + 10;
    }
    doc.setFillColor(61,90,254); doc.rect(12,y-4,186,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(255,255,255);
    doc.text("Descrição",15,y+1); doc.text("Categoria",93,y+1); doc.text("Vencimento",139,y+1); doc.text("Valor",195,y+1,{align:"right"});
    y += 7;
    rows.forEach((r,i) => {
      if (y > 277) { doc.addPage(); y = 18; }
      if (i % 2 === 0) { doc.setFillColor(250,250,251); doc.rect(12,y-4,186,9,"F"); }
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(48,50,56);
      doc.text(doc.splitTextToSize(String(r.descricao || "—"),72)[0],15,y+1);
      doc.text(doc.splitTextToSize(String(r.categoria || "—"),40)[0],93,y+1);
      doc.text(dateBR(r.vencimento),139,y+1);
      doc.text(money(r.valor),195,y+1,{align:"right"});
      y += 9;
    });
    return y + 5;
  }

  async function generate() {
    const btn = document.getElementById(BTN_ID);
    try {
      const jsPDF = await loadPdfLib();
      const mk = App.selectedMonth;
      const rows = normalize(collect(mk), mk);
      const all = [...rows.fixas,...rows.despesas,...rows.parcelamentos,...rows.dividas];
      const total = all.reduce((s,x)=>s+num(x.valor),0);
      if (btn) { btn.disabled = true; btn.textContent = "Gerando…"; }
      const doc = new jsPDF({unit:"mm",format:"a4"});
      doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor(35,38,45);
      doc.text("Resumo de pagamentos",12,18);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(105,110,120);
      doc.text(monthName(mk),12,24); doc.text(`Total pendente: ${money(total)}`,198,24,{align:"right"});
      let y=36;
      y=addSection(doc,y,"CONTAS FIXAS",rows.fixas);
      y=addSection(doc,y,"DESPESAS",rows.despesas);
      y=addSection(doc,y,"PARCELAMENTOS",rows.parcelamentos);
      if(rows.dividas.length) y=addSection(doc,y,"DÍVIDAS",rows.dividas);
      doc.save(`resumo-pagamentos-${mk}.pdf`);
      if (typeof Utils !== "undefined" && Utils.toast) Utils.toast("Resumo PDF gerado ✓");
    } catch(e) {
      console.error(e);
      alert("Não foi possível gerar o PDF. Verifique sua conexão com a internet e tente novamente.");
    } finally {
      if(btn){btn.disabled=false;btn.textContent="▤ Resumo";}
    }
  }

  App.injectResumoButton = inject;
  setTimeout(inject, 200);
})();
