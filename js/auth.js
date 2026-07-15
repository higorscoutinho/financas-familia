/* =========================================================
   auth.js — Autenticação SHA-256 + sessionStorage
   - Sessão sempre destruída ao recarregar/fechar
   - Primeiro acesso: tela de cadastro de códigos
   - Demais acessos: tela de login
   - App.boot(userName) é chamado após login válido
   ========================================================= */

const Auth = {
  LS_HASHES:  "ff_auth_v2",
  SS_SESSION: "ff_session_v1",

  get users() {
    return [
      { name: window.APP_CONFIG?.USER_1 || "Usuário 1" },
      { name: window.APP_CONFIG?.USER_2 || "Usuário 2" },
    ];
  },

  async sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  },

  async gerarHash(codigo) {
    const h = await this.sha256(codigo);
    console.log(`%cHash de "${codigo}":`, "font-weight:bold;color:#3D5AFE"); console.log(h);
    return h;
  },

  getHashes() {
    try { return JSON.parse(localStorage.getItem(this.LS_HASHES) || "{}"); } catch { return {}; }
  },

  async setHash(name, code) {
    const h = await this.sha256(code);
    const hashes = this.getHashes();
    hashes[name] = h;
    localStorage.setItem(this.LS_HASHES, JSON.stringify(hashes));
  },

  isConfigured() {
    const h = this.getHashes();
    return this.users.every(u => !!h[u.name]);
  },

  async validate(name, code) {
    const stored = this.getHashes()[name];
    if (!stored) return false;
    return (await this.sha256(code)) === stored;
  },

  startSession(name) {
    sessionStorage.setItem(this.SS_SESSION, JSON.stringify({
      user: name, token: Math.random().toString(36).slice(2)+Date.now().toString(36), at: Date.now()
    }));
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem(this.SS_SESSION) || "null"); } catch { return null; }
  },

  logout() { sessionStorage.removeItem(this.SS_SESSION); location.reload(); },

  // ── Ponto de entrada ──────────────────────────────────
  mount() {
    // Sessão destruída ao recarregar/fechar
    window.addEventListener("beforeunload", () => sessionStorage.removeItem(this.SS_SESSION));

    // Verifica se já tem sessão válida nesta aba (raro mas possível em SPAs)
    const session = this.getSession();
    if (session?.user) { this._launch(session.user); return; }

    this.isConfigured() ? this._renderLogin() : this._renderSetup();
  },

  _launch(name) {
    document.getElementById("auth-screen").style.display = "none";
    App.boot(name);
  },

  // ── Tela de login ─────────────────────────────────────
  _renderLogin() {
    const el = document.getElementById("auth-screen");
    let sel  = this.users[0].name;

    el.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-logo">F</div>
          <h1 class="auth-title">Finanças Família</h1>
          <p class="auth-sub">Identifique-se para continuar</p>
        </div>

        <div class="auth-user-pick" id="au-pick">
          ${this.users.map(u=>`
            <button type="button" class="auth-user-btn ${u.name===sel?"active":""}" data-u="${u.name}">
              <span class="auth-avatar">${u.name[0].toUpperCase()}</span>
              <span>${u.name}</span>
            </button>`).join("")}
        </div>

        <div class="auth-form">
          <div class="field">
            <label>Código de acesso</label>
            <input type="password" id="au-code" placeholder="••••••••" autocomplete="current-password" autofocus>
          </div>
          <div class="auth-error" id="au-err"></div>
          <button type="button" class="btn btn-primary auth-submit-btn" id="au-btn">Entrar</button>
        </div>

        <button class="auth-reset-link" id="au-reset">Redefinir códigos neste dispositivo</button>
      </div>`;

    el.querySelectorAll(".auth-user-btn").forEach(btn => {
      btn.onclick = () => {
        sel = btn.dataset.u;
        el.querySelectorAll(".auth-user-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("au-code").value = "";
        document.getElementById("au-code").focus();
        document.getElementById("au-err").textContent = "";
      };
    });

    document.getElementById("au-reset").onclick = () => {
      if (confirm("Isso apagará os códigos salvos neste dispositivo. Continuar?")) {
        localStorage.removeItem(this.LS_HASHES);
        this._renderSetup();
      }
    };

    const doLogin = async () => {
      const code = document.getElementById("au-code").value;
      const errEl = document.getElementById("au-err");
      const btn   = document.getElementById("au-btn");
      if (!code) { this._err(errEl,"Digite seu código."); return; }
      btn.disabled = true; btn.textContent = "Verificando…";
      const ok = await this.validate(sel, code);
      if (ok) {
        btn.textContent = "✓ Entrando…";
        this.startSession(sel);
        setTimeout(() => this._launch(sel), 300);
      } else {
        btn.disabled = false; btn.textContent = "Entrar";
        document.getElementById("au-code").value = "";
        document.getElementById("au-code").focus();
        this._err(errEl, "Código incorreto. Tente novamente.");
      }
    };

    document.getElementById("au-btn").onclick = doLogin;
    document.getElementById("au-code").addEventListener("keydown", e => { if(e.key==="Enter") doLogin(); });
  },

  // ── Primeiro acesso / redefinição ─────────────────────
  _renderSetup() {
    const el = document.getElementById("auth-screen");

    el.innerHTML = `
      <div class="auth-card auth-card-wide">
        <div class="auth-brand">
          <div class="auth-logo">F</div>
          <h1 class="auth-title">Criar códigos de acesso</h1>
          <p class="auth-sub">Defina um código para cada usuário.<br>Mínimo 4 caracteres.</p>
        </div>

        ${this.users.map(u=>`
          <div class="auth-setup-block">
            <div class="auth-setup-name">
              <span class="auth-avatar">${u.name[0].toUpperCase()}</span>
              <strong>${u.name}</strong>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Código</label>
                <input type="password" id="sc-${u.name}" placeholder="Crie um código" autocomplete="new-password">
              </div>
              <div class="field">
                <label>Confirmar</label>
                <input type="password" id="scc-${u.name}" placeholder="Repita o código" autocomplete="new-password">
              </div>
            </div>
          </div>`).join("")}

        <div class="auth-error" id="sc-err"></div>
        <button type="button" class="btn btn-primary auth-submit-btn" id="sc-btn">Salvar e entrar</button>
        <p class="auth-security-note">🔒 Códigos armazenados com SHA-256 neste dispositivo. Nada é enviado à internet.</p>
      </div>`;

    document.getElementById("sc-btn").onclick = async () => {
      const errEl = document.getElementById("sc-err");
      const btn   = document.getElementById("sc-btn");
      for (const u of this.users) {
        const code = document.getElementById(`sc-${u.name}`)?.value || "";
        const conf = document.getElementById(`scc-${u.name}`)?.value || "";
        if (!code)          { this._err(errEl,`Digite o código de ${u.name}.`); return; }
        if (code.length < 4){ this._err(errEl,`Código de ${u.name}: mínimo 4 caracteres.`); return; }
        if (code !== conf)  { this._err(errEl,`Os códigos de ${u.name} não coincidem.`); return; }
      }
      btn.disabled = true; btn.textContent = "Salvando…";
      for (const u of this.users) await this.setHash(u.name, document.getElementById(`sc-${u.name}`).value);
      btn.textContent = "✓ Códigos salvos!";
      setTimeout(() => this._renderLogin(), 600);
    };
  },

  _err(el, msg) {
    el.textContent = msg;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  },
};
document.addEventListener("DOMContentLoaded", () => {
    Auth.mount();
});
