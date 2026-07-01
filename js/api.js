/* =========================================================
   api.js — Camada de comunicação com o Google Apps Script
   A planilha Google Sheets é o banco de dados. Este arquivo
   envia/recebe JSON do Web App publicado (Code.gs).
   ========================================================= */

// >>> COLOQUE AQUI A URL DO SEU WEB APP (veja o tutorial de instalação) <<<
const API_URL = window.APP_CONFIG?.API_URL || "";

const API = {
  /**
   * Verifica se a URL do Apps Script foi configurada.
   */
  isConfigured() {
    return !!API_URL && API_URL.startsWith("http");
  },

  /**
   * GET genérico — usado para carregar todas as abas de uma vez.
   * Code.gs responde com { receitas, despesas, contasFixas, cartoes,
   * parcelamentos, categorias, metas, configuracoes, logs }
   */
  async getAll() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(`${API_URL}?action=getAll`, { method: "GET" });
      if (!res.ok) throw new Error("Falha ao buscar dados");
      return await res.json();
    } catch (err) {
      console.error("[API] getAll falhou:", err);
      return null;
    }
  },

  /**
   * POST genérico — cria, atualiza ou remove um registro em uma aba.
   * payload: { sheet: 'Despesas', op: 'create'|'update'|'delete', data: {...}, user }
   */
  async send(sheet, op, data, user) {
    if (!this.isConfigured()) return { ok: false, offline: true };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        // text/plain evita preflight CORS no Apps Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ sheet, op, data, user, ts: Date.now() }),
      });
      return await res.json();
    } catch (err) {
      console.error("[API] send falhou:", err);
      return { ok: false, error: String(err) };
    }
  },
};
