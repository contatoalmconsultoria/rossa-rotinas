// Inicialização: acesso, navegação, situação da conexão e atualização automática.
(function () {
  const { avisar } = UI
  const $ = s => document.querySelector(s)
  const ROTAS = {
    hoje: r => Telas.Hoje.abrir(r),
    pendencias: r => Telas.Pendencias.abrir(r),
    historico: (r, p) => Telas.Historico.abrir(r, p),
    indicadores: r => Telas.Indicadores.abrir(r),
    admin: r => Telas.Admin.abrir(r),
  }
  let rotaAtual = null

  const App = {
    mostrarAcesso (msg, ok) {
      $('#tela-app').hidden = true
      $('#tela-acesso').hidden = false
      $('#form-senha').hidden = true
      $('#form-acesso').hidden = false
      const e = $('#acesso-erro'); e.hidden = !msg; e.textContent = msg || ''
      const o = $('#acesso-ok'); o.hidden = !ok; o.textContent = ok || ''
      $('#acesso-senha').value = ''
      ;($('#acesso-email').value ? $('#acesso-senha') : $('#acesso-email')).focus()
    },

    mostrarDefinirSenha (tipo) {
      $('#tela-app').hidden = true
      $('#tela-acesso').hidden = false
      $('#form-acesso').hidden = true
      $('#form-senha').hidden = false
      $('#senha-titulo').textContent = tipo === 'recovery' ? 'Crie uma nova senha' : 'Bem-vinda! Defina sua senha'
      $('#senha-erro').hidden = true
      $('#senha-nova').focus()
    },

    async iniciarApp () {
      let u = API.usuario
      if (!u) {
        try { u = await API.carregarUsuario() } catch (err) {
          if (err.status === 403) { await API.sair(); return App.mostrarAcesso(err.message) }
          if (err.status === 401) return App.mostrarAcesso('Sua sessão expirou. Entre novamente.')
          return App.mostrarAcesso(err.message)
        }
      }
      $('#tela-acesso').hidden = true
      $('#tela-app').hidden = false
      $('#perfil').textContent = `${u.nome} · ${u.perfil === 'gestao' ? 'Gestão' : 'Operação'}`
      document.querySelectorAll('[data-gestao]').forEach(el => { el.hidden = u.perfil !== 'gestao' })
      App.navegar()
    },

    navegar () {
      const [rota, param] = (location.hash.replace(/^#\/?/, '') || 'hoje').split('/')
      const s = API.usuario
      const destino = ROTAS[rota] && (rota !== 'admin' || s?.perfil === 'gestao') ? rota : 'hoje'
      rotaAtual = destino
      document.querySelectorAll('.topo-nav a').forEach(a => {
        a.classList.toggle('ativo', a.dataset.rota === destino)
        if (a.dataset.rota === destino) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current')
      })
      // Cada navegação recebe uma área nova: se uma tela anterior ainda estiver carregando,
      // ela termina desenhando numa área já descartada, sem sobrescrever a tela atual.
      const conteudo = $('#conteudo')
      const raiz = document.createElement('div')
      conteudo.replaceChildren(raiz)
      Telas.Tarefas.abertas.clear()
      ROTAS[destino](raiz, param)
      conteudo.focus({ preventScroll: true })
      App.atualizarContador()
    },

    async atualizarContador () {
      try {
        const l = await API.chamar('pendencias', { status: 'aberta' })
        const b = $('#nav-pend'); b.hidden = !l.length; b.textContent = l.length
      } catch { /* silencioso: a falha de conexão já é sinalizada */ }
    },
  }
  window.App = App

  // ---------- acesso ----------
  $('#form-acesso').addEventListener('submit', async ev => {
    ev.preventDefault()
    const btn = ev.target.querySelector('button[type=submit]')
    btn.disabled = true; btn.textContent = 'Entrando…'
    try {
      await API.entrar($('#acesso-email').value, $('#acesso-senha').value, $('#acesso-lembrar').checked)
      $('#acesso-senha').value = '' // a senha não fica na página depois de entrar
      App.iniciarApp()
    } catch (err) {
      App.mostrarAcesso(err.message)
    } finally { btn.disabled = false; btn.textContent = 'Entrar' }
  })
  $('#btn-esqueci').addEventListener('click', async () => {
    const email = $('#acesso-email').value.trim()
    if (!email || !$('#acesso-email').checkValidity()) return App.mostrarAcesso('Digite o seu e-mail no campo acima e clique de novo em "Esqueci minha senha".')
    const b = $('#btn-esqueci'); b.disabled = true
    try {
      await API.esqueciSenha(email)
      App.mostrarAcesso(null, 'Se este e-mail tiver acesso ao painel, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.')
    } catch (err) { App.mostrarAcesso(err.message) } finally { b.disabled = false }
  })
  $('#form-senha').addEventListener('submit', async ev => {
    ev.preventDefault()
    const erro = $('#senha-erro')
    const nova = $('#senha-nova').value, rep = $('#senha-repetir').value
    const falha = m => { erro.hidden = false; erro.textContent = m }
    if (nova !== rep) return falha('As senhas digitadas não conferem.')
    if (!/[a-zA-Z]/.test(nova) || !/\d/.test(nova)) return falha('Use letras e números na senha.')
    const btn = ev.target.querySelector('button[type=submit]'); btn.disabled = true
    try {
      await API.definirSenha(nova)
      $('#senha-nova').value = ''; $('#senha-repetir').value = ''
      UI.avisar('Senha salva.')
      App.iniciarApp()
    } catch (err) { falha(err.message) } finally { btn.disabled = false }
  })
  $('#btn-sair').addEventListener('click', async () => {
    if (!await UI.confirmar('Sair do painel?', 'Neste computador será preciso entrar com e-mail e senha novamente.', 'Sair')) return
    await API.sair(); App.mostrarAcesso()
  })
  window.addEventListener('rossa:sessao-expirada', () => { API.usuario = null; App.mostrarAcesso('Sua sessão expirou. Entre novamente com e-mail e senha.') })

  // ---------- conexão ----------
  const conexao = $('#conexao')
  const marcarConexao = ok => {
    conexao.className = 'conexao ' + (ok ? 'ok' : 'falha')
    conexao.textContent = ok ? 'Conectado' : 'Sem conexão — alterações não estão sendo salvas'
  }
  window.addEventListener('rossa:conexao', e => marcarConexao(e.detail))
  window.addEventListener('offline', () => { marcarConexao(false); avisar('Você está sem internet. Nada será salvo até a conexão voltar.', 'erro') })
  window.addEventListener('online', () => { avisar('Conexão restabelecida. Atualizando…'); if (rotaAtual === 'hoje') Telas.Hoje.carregar() })

  // ---------- atualização automática (ver mudanças feitas em outro computador) ----------
  setInterval(() => {
    if (document.hidden || rotaAtual !== 'hoje' || !API.sessao()) return
    if ($('#modal').open || document.querySelector('.tarefa.ocupada')) return
    const ativo = document.activeElement
    if (ativo && (ativo.tagName === 'TEXTAREA' || (ativo.tagName === 'INPUT' && ativo.type !== 'checkbox'))) return
    Telas.Hoje.carregar()
  }, (window.ROSSA_CONFIG.ATUALIZAR_A_CADA_SEGUNDOS || 60) * 1000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && rotaAtual === 'hoje' && API.sessao() && !$('#modal').open) Telas.Hoje.carregar()
  })

  window.addEventListener('hashchange', () => { if (API.sessao()) App.navegar() })

  // ---------- proteção contra o painel ser embutido em outro site (clickjacking) ----------
  if (window.top !== window.self) { document.body.innerHTML = ''; return }

  // ---------- início ----------
  const link = API.lerLinkDoEmail()
  if (link?.erro) App.mostrarAcesso(link.erro)
  else if (link) App.mostrarDefinirSenha(link.tipo)
  else if (API.sessao()?.access_token) App.iniciarApp()
  else App.mostrarAcesso()
})()
