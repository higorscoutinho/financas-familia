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
  API_URL: "https://script.google.com/macros/s/AKfycbwld4IYwcLM_G8GEt9j_f5dR-AtRRqQ1HblkVrgLMgc2oOlfTqzLENyQo1ID3gDKt9B/exec", // Cole aqui a URL do seu Web App do Google Apps Script

  // ── Usuários do sistema ───────────────────────────────
  // Preencha o campo "hash" com o SHA-256 da senha de cada usuário.
  // Deixe hash: "" enquanto ainda não gerou — o sistema mostrará instruções.
  USERS: [
    {
      name: "Higor",
      hash: "cd9b9e80a5b78a3d4c6778e6f7851a28bd15f744a6de0495888baafdb74afb58", // ← Cole aqui o hash gerado para Higor
    },
    {
      name: "Bia",
      hash: "d6a4031733610bb080d0bfa794fcc9dbdcff74834aeaab7c6b927e21e9754037", // ← Cole aqui o hash gerado para Bia
    },
  ],

  // Atalho mantido para compatibilidade com partes do código
  get USER_1() { return this.USERS[0]?.name || "Usuário 1"; },
  get USER_2() { return this.USERS[1]?.name || "Usuário 2"; },
};
