/* =========================================================
   config.js — Configurações do sistema Finanças Família

   SENHA:
   Para definir/alterar a senha de acesso:
   1. Abra o sistema no navegador
   2. Pressione F12 → aba Console
   3. Digite: Auth.gerarHash("sua-senha-aqui")
   4. Copie o hash gerado e cole no campo PASSWORD_HASH abaixo
   5. Salve este arquivo e reenvie para o GitHub/hospedeiro
   6. NUNCA escreva a senha em si aqui — apenas o hash

   SEGURANÇA:
   - O hash fica no código do servidor (GitHub)
   - Ninguém no dispositivo pode alterar ou criar a senha
   - A sessão expira ao fechar/recarregar a página
   - Senha única, compartilhada — sem seleção de usuário
   ========================================================= */

window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwld4IYwcLM_G8GEt9j_f5dR-AtRRqQ1HblkVrgLMgc2oOlfTqzLENyQo1ID3gDKt9B/exec", // Cole aqui a URL do seu Web App do Google Apps Script

  // ── Senha única de acesso ao app ──────────────────────
  // SHA-256 da senha (mantida a senha do Higor, usada por ambos).
  PASSWORD_HASH: "b7ca93a0ea3d4b2d2330b5363aa251bf2c8bd184f3b4d8032b645064772ad214",
};
