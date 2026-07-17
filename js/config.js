/* =========================================================
   config.js — Configurações do sistema Finanças Família

   SENHAS:
   Para definir/alterar a senha de um usuário:
   1. Abra o sistema no navegador
   2. Pressione F12 → aba Console
   3. Digite: Auth.gerarHash("sua-senha-aqui")
   4. Copie o hash gerado e cole no campo "hash" abaixo
   5. Salve este arquivo e reenvie para o GitHub/hospedeiro
   6. NUNCA escreva a senha em si aqui — apenas o hash

   SEGURANÇA:
   - Os hashes ficam no código do servidor (GitHub)
   - Ninguém no dispositivo pode alterar ou criar senhas
   - A sessão expira ao fechar/recarregar a página
   ========================================================= */

window.APP_CONFIG = {
  API_URL: "", // Cole aqui a URL do seu Web App do Google Apps Script

  // ── Usuários do sistema ───────────────────────────────
  // Preencha o campo "hash" com o SHA-256 da senha de cada usuário.
  // Deixe hash: "" enquanto ainda não gerou — o sistema mostrará instruções.
  USERS: [
    {
      name: "Higor",
      hash: "", // ← Cole aqui o hash gerado para Higor
    },
    {
      name: "Bia",
      hash: "", // ← Cole aqui o hash gerado para Bia
    },
  ],

  // Atalho mantido para compatibilidade com partes do código
  get USER_1() { return this.USERS[0]?.name || "Usuário 1"; },
  get USER_2() { return this.USERS[1]?.name || "Usuário 2"; },
};
