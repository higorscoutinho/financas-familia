// Nova ordem: Dashboard, Despesas, Contas Fixas, Parcelamentos,
//             Investimentos, Receitas, Dividas, Anotações, Configurações
const NAV_ITEMS=[
  {id:"dashboard",    label:"Dashboard",     icon:"🏠"},
  {id:"despesas",     label:"Despesas",      icon:"💸"},
  {id:"fixas",        label:"Contas Fixas",  icon:"📌"},
  {id:"parcelamentos",label:"Parcelamentos", icon:"📦"},
  {id:"investimentos",label:"Investimentos", icon:"📈"},
  {id:"receitas",     label:"Receitas",      icon:"💰"},
  {id:"dividas",      label:"Dívidas",       icon:"🔴"},
  {id:"anotacoes",    label:"Anotações",     icon:"📝"},
  {id:"config",       label:"Configurações", icon:"⚙️"},
];
const BOTTOM_NAV_IDS=["dashboard","despesas","fixas","dividas"];

const App={
  currentUser:null,currentPage:"dashboard",
  selectedMonth:Utils.currentMonthKey(),
  filters:{categoria:"todas",busca:""},

  async boot(userName){
    this.currentUser=userName;
    document.getElementById("app").classList.add("active");
    document.getElementById("current-user-name").textContent=userName;
    document.getElementById("user-avatar-letter").textContent=userName[0].toUpperCase();
    this.buildNav();

    // 1. Carrega dados locais e mostra dashboard IMEDIATAMENTE (sem tela em branco)
    Store.loadLocal();
    Store.ensureFixedBillsForMonth(Utils.currentMonthKey());
    this.goTo("dashboard");
    this.bindGlobalEvents();

    // 2. Sincroniza com Sheets em segundo plano e re-renderiza
    Store.init().then(()=>{
      Store.ensureFixedBillsForMonth(this.selectedMonth);
      Pages.render(this.currentPage);
    }).catch(e=>console.error("Sync error:",e));
  },

  setMonth(mk){
    if(!mk)return;
    this.selectedMonth=mk;
    document.querySelectorAll(".month-picker-input").forEach(el=>{el.value=mk;});
    Store.ensureFixedBillsForMonth(mk);
    Pages.render(this.currentPage);
  },
  prevMonth(){
    const[y,m]=this.selectedMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  },
  nextMonth(){
    const[y,m]=this.selectedMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    this.setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  },
  isCurrentMonth(){return this.selectedMonth===Utils.currentMonthKey();},

  buildNav(){
    document.getElementById("nav-list").innerHTML=NAV_ITEMS.map(it=>
      `<li class="nav-item" data-page="${it.id}"><span class="ic">${it.icon}</span>${it.label}</li>`
    ).join("");
    document.querySelectorAll(".nav-item").forEach(el=>{el.onclick=()=>this.goTo(el.dataset.page);});

    const bn=document.getElementById("bottom-nav");
    bn.innerHTML=BOTTOM_NAV_IDS.map(id=>{
      const it=NAV_ITEMS.find(n=>n.id===id);
      return`<button class="bn-item" data-page="${id}"><span class="ic">${it.icon}</span>${it.label}</button>`;
    }).join("")+`<button class="bn-item bn-more" data-page="more"><span class="ic">⋯</span>Mais</button>`;
    document.querySelectorAll(".bn-item").forEach(el=>{
      el.onclick=()=>el.dataset.page==="more"?this.openMoreMenu():this.goTo(el.dataset.page);
    });

    const mc=document.getElementById("more-menu-card");
    mc.innerHTML=NAV_ITEMS.filter(n=>!BOTTOM_NAV_IDS.includes(n.id))
      .map(it=>`<button class="mm-item" data-page="${it.id}"><span class="ic-wrap">${it.icon}</span>${it.label}</button>`).join("");
    mc.querySelectorAll(".mm-item").forEach(el=>{
      el.onclick=()=>{this.closeMoreMenu();this.goTo(el.dataset.page);};
    });
  },

  openMoreMenu(){document.getElementById("more-menu-sheet").classList.add("active");},
  closeMoreMenu(){document.getElementById("more-menu-sheet").classList.remove("active");},

  goTo(page){
    this.currentPage=page;
    document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
    document.querySelectorAll(".bn-item").forEach(el=>el.classList.toggle("active",el.dataset.page===page));
    Pages.render(page);
  },

  bindGlobalEvents(){
    document.getElementById("theme-toggle-btn").onclick=()=>{
      const next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
      document.documentElement.setAttribute("data-theme",next);
      localStorage.setItem(LS_THEME,next);
    };
    document.getElementById("logout-btn").onclick=()=>Auth.logout();
    document.getElementById("fab-add").onclick=()=>Modals.openQuickAdd();
    document.getElementById("more-menu-sheet").onclick=e=>{
      if(e.target.id==="more-menu-sheet")this.closeMoreMenu();
    };
    document.addEventListener("keydown",e=>{
      if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName))return;
      if(e.key.toLowerCase()==="d")Modals.openDespesa();
      if(e.key.toLowerCase()==="r")Modals.openReceita();
      if(e.key==="ArrowLeft")this.prevMonth();
      if(e.key==="ArrowRight")this.nextMonth();
      if(e.key==="Escape")Modals.closeAll();
    });
  },
};
