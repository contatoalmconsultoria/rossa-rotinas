# Painel de Rotinas Administrativas — Rossa Equipamentos

Publicação estática do painel (somente interface), em **rossa.ind.br/rotinas** (HostGator, pasta `public_html/rotinas`).
Não contém dados nem senhas.

## Acesso
- Cada pessoa entra com o próprio e-mail e senha (Supabase Auth).
- Quem pode entrar e com qual perfil fica na tabela `rossa_rotinas.usuario` (Gestão ou Operação).
  Um login criado no Supabase que não esteja nessa tabela recebe "Acesso não autorizado".
- Todo dado passa pela função `public.rossa_api(acao, parametros)`, executável só por usuários logados.
  As tabelas do schema `rossa_rotinas` continuam fechadas (sem acesso direto).

## Publicação
Enviar para `public_html/rotinas`: `index.html`, `robots.txt`, `.htaccess` e a pasta `assets/`.
O `.htaccess` força HTTPS e aplica os cabeçalhos de segurança (CSP, bloqueio de iframe, noindex).
