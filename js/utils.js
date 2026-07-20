const Utils={
  uid(prefix="id"){return`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;},

  brl(value){return(Number(value)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});},

  todayISO(){return new Date().toISOString().slice(0,10);},

  monthKey(dateStr){return(dateStr||Utils.todayISO()).slice(0,7);},

  currentMonthKey(){return Utils.todayISO().slice(0,7);},

  prevMonthKey(mk){
    const[y,m]=mk.split("-").map(Number);
    const d=new Date(y,m-2,1);
    return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  },

  nextMonthKey(mk){
    const[y,m]=mk.split("-").map(Number);
    const d=new Date(y,m,1);
    return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  },

  fmtDateShort(dateStr){
    if(!dateStr)return"—";
    const[y,m,d]=dateStr.split("-");return`${d}/${m}`;
  },

  fmtDateFull(dateStr){
    if(!dateStr)return"—";
    const[y,m,d]=dateStr.split("-");return`${d}/${m}/${y}`;
  },

  monthLabel(mk){
    if(!mk)return"—";
    const[y,m]=mk.split("-");
    const n=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return`${n[parseInt(m,10)-1]} ${y}`;
  },

  // Calcula dias até o vencimento DENTRO do mês de referência da conta
  // Corrige bug onde futuros meses apareciam como "atrasados"
  daysUntilInMonth(dueDay,mesRef){
    const mk=(mesRef||Utils.currentMonthKey()).slice(0,7);
    const[y,m]=mk.split("-").map(Number);
    const due=new Date(y,m-1,dueDay);
    const today=new Date();today.setHours(0,0,0,0);due.setHours(0,0,0,0);
    return Math.round((due-today)/86400000);
  },

  // Mantido para compatibilidade (usa mês atual)
  daysUntil(dueDay){return Utils.daysUntilInMonth(dueDay,Utils.currentMonthKey());},

  daysInMonth(mk){const[y,m]=mk.split("-").map(Number);return new Date(y,m,0).getDate();},

  dayOfMonthToday(){return new Date().getDate();},

  toast(msg){
    const stack=document.getElementById("toast-stack");if(!stack)return;
    const el=document.createElement("div");el.className="toast";el.textContent=msg;
    stack.appendChild(el);setTimeout(()=>el.remove(),3200);
  },

  debounce(fn,wait=250){
    let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};
  },

  escapeHtml(str){const div=document.createElement("div");div.textContent=str??"";return div.innerHTML;},

  categoryColor(name){
    const p=["#3D5AFE","#1FA971","#DD8B1B","#E5484D","#8E5BF2","#1BBFD1","#F25CA0","#6B7280"];
    let h=0;for(let i=0;i<name.length;i++)h=name.charCodeAt(i)+((h<<5)-h);
    return p[Math.abs(h)%p.length];
  },
};
