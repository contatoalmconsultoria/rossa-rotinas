# Painel de Rotinas Administrativas — Rossa Equipamentos

Publicação estática do painel (somente interface), em **https://rotinas.rossa.ind.br**
(subdomínio na HostGator, cPanel br986, pasta `public_html/rotinas`).
O site principal rossa.ind.br fica na KingHost; o DNS do domínio é gerenciado na HostGator.
Não contém dados nem senhas.

## Acesso
- Cada pessoa entra com o próprio e-mail e senha (Supabase Auth).
- Quem pode entrar e com qual perfil fica na tabela `rossa_rotinas.usuario` (Gestão ou Operação).
  Um login criado no Supabase que não esteja nessa tabela recebe "Acesso não autorizado".
- Todo dado passa pela função `public.rossa_api(acao, parametros)`, executável só por usuários logados.
  As tabelas do schema `rossa_rotinas` continuam fechadas (sem acesso direto).

## Publicação automática (desde 18/11/2026)
Um agendamento (cron) no cPanel, a cada 5 minutos, busca o ramo `login-email` deste repositório
(cópia em `~/repositories/rossa-rotinas`) e, se houver versão nova, copia `index.html`, `robots.txt`,
`.htaccess` e `assets/` para `public_html/rotinas`. Basta enviar (push) para o ramo `login-email`.
A versão no ar fica registrada em `https://rotinas.rossa.ind.br/.deploy` e o histórico em `~/rotinas-deploy.log`.
Nenhuma senha é usada: o repositório é público e o servidor só lê.

## Publicação manual (se o agendamento parar)
Enviar para `public_html/rotinas`: `index.html`, `robots.txt`, `.htaccess` e a pasta `assets/`.
O `.htaccess` força HTTPS e aplica os cabeçalhos de segurança (CSP, bloqueio de iframe, noindex).
