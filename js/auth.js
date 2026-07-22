/* =========================================================
   auth.js — Autenticação com senha única fixa no config.js

   SEGURANÇA:
   - A senha fica como hash SHA-256 no config.js
   - Ninguém consegue criar senha nova — só quem edita
     o config.js no GitHub/hospedeiro pode alterar
   - Sessão destruída ao fechar/recarregar (sessionStorage)
   - Sem "lembrar-me", sem login automático
   - Senha única e compartilhada — sem seleção de usuário
   ========================================================= */

const Auth = {
  SS_SESSION: "ff_session_v1",
  FAMILY_TAG: "Família",

  get passwordHash() {
    return window.APP_CONFIG?.PASSWORD_HASH || "";
  },

  async sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  },

  // Ferramenta para gerar hash — use no console: Auth.gerarHash("sua-senha")
  async gerarHash(codigo) {
    const h = await this.sha256(String(codigo));
    console.log(`%c╔══════════════════════════╗`, "color:#3D5AFE;font-weight:bold");
    console.log(`%c  Hash de "${codigo}":`, "color:#3D5AFE;font-weight:bold");
    console.log(`%c  ${h}`, "color:#1FA971;font-weight:bold;font-size:11px");
    console.log(`%c╚══════════════════════════╝`, "color:#3D5AFE;font-weight:bold");
    console.log(`%cCole esse valor em config.js → PASSWORD_HASH`, "color:#6B6E76");
    return h;
  },

  async validate(code) {
    if (!this.passwordHash) return false;
    return (await this.sha256(String(code))) === this.passwordHash;
  },

  startSession() {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(this.SS_SESSION, JSON.stringify({ token, at: Date.now() }));
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem(this.SS_SESSION) || "null"); } catch { return null; }
  },

  logout() {
    sessionStorage.removeItem(this.SS_SESSION);
    location.reload();
  },

  // ── Ponto de entrada — chamado quando o DOM carrega ───
  mount() {
    // Garante que a sessão morre ao fechar ou recarregar
    window.addEventListener("beforeunload", () => {
      sessionStorage.removeItem(this.SS_SESSION);
    });

    // Se já tem sessão válida nesta aba (navegação interna)
    const session = this.getSession();
    if (session) {
      this._launch();
      return;
    }

    // Valida configuração
    if (!this.passwordHash) {
      this._renderError(
        `Configure a senha em config.js.<br><br>` +
        `Abra o console (F12) e rode:<br>` +
        `<code>Auth.gerarHash("sua-senha")</code>`
      );
      return;
    }

    this._renderLogin();
  },

  _launch() {
    document.getElementById("auth-screen").style.display = "none";
    App.boot(this.FAMILY_TAG);
  },

  // ── Tela de bloqueio ───────────────────────────────────
  _renderLogin() {
    const el = document.getElementById("auth-screen");

    el.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-logo">🔒</div>
          <h1 class="auth-title">Finanças Família</h1>
          <p class="auth-sub">Digite a senha para desbloquear</p>
        </div>

        <div class="auth-form">
          <div class="field">
            <label>Senha</label>
            <input type="password" id="au-code"
              placeholder="••••••••"
              autocomplete="current-password" autofocus>
          </div>
          <div class="auth-error" id="au-err"></div>
          <button type="button" class="btn btn-primary auth-submit-btn" id="au-btn">
            🔓 Desbloquear
          </button>
        </div>
      </div>`;

    // Fazer login
    const doLogin = async () => {
      const code  = document.getElementById("au-code").value;
      const errEl = document.getElementById("au-err");
      const btn   = document.getElementById("au-btn");
      if (!code) { this._err(errEl, "Digite a senha."); return; }
      btn.disabled = true; btn.textContent = "Verificando…";
      const ok = await this.validate(code);
      if (ok) {
        btn.textContent = "✓ Desbloqueando…";
        this.startSession();
        setTimeout(() => this._launch(), 300);
      } else {
        btn.disabled = false; btn.textContent = "🔓 Desbloquear";
        document.getElementById("au-code").value = "";
        document.getElementById("au-code").focus();
        this._err(errEl, "Senha incorreta. Tente novamente.");
      }
    };

    document.getElementById("au-btn").onclick = doLogin;
    document.getElementById("au-code").addEventListener("keydown", e => {
      if (e.key === "Enter") doLogin();
    });
  },

  // ── Tela de erro de configuração ──────────────────────
  _renderError(msg) {
    document.getElementById("auth-screen").innerHTML = `
      <div class="auth-card" style="max-width:480px;">
        <div class="auth-brand">
          <div class="auth-logo" style="background:linear-gradient(135deg,#E5484D,#FF6A6F);">⚙️</div>
          <h1 class="auth-title">Configuração necessária</h1>
        </div>
        <div style="background:var(--color-negative-soft);border:1px solid var(--color-negative);
          border-radius:var(--radius-sm);padding:16px;font-size:13.5px;line-height:1.7;
          color:var(--color-text);">${msg}</div>
        <p class="auth-security-note">
          Depois de gerar o hash, cole em <code>js/config.js</code> e reenvie o arquivo para o hospedeiro.
        </p>
      </div>`;
  },

  _err(el, msg) {
    el.textContent = msg;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  },
};

// ── DISPARA O AUTH QUANDO O DOM ESTIVER PRONTO ────────────
document.addEventListener("DOMContentLoaded", () => Auth.mount());
