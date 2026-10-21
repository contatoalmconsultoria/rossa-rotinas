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
    mostrarAcesso (msg) {
      $('#tela-app').hidden = true
      $('#tela-acesso').hidden = false
      const e = $('#acesso-erro'); e.hidden = !msg; e.textContent = msg || ''
      $('#acesso-codigo').value = ''
      $('#acesso-codigo').focus()
    },

    iniciarApp () {
      const s = API.sessao()
      $('#tela-acesso').hidden = true
      $('#tela-app').hidden = false
      $('#perfil').textContent = s.perfil === 'gestao' ? 'Perfil: Gestão' : 'Perfil: Operação'
      document.querySelectorAll('[data-gestao]').forEach(el => { el.hidden = s.perfil !== 'gestao' })
      App.navegar()
    },

    navegar () {
      const [rota, param] = (location.hash.replace(/^#\/?/, '') || 'hoje').split('/')
      const s = API.sessao()
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
      await API.entrar($('#acesso-codigo').value, $('#acesso-dispositivo').value.trim(), $('#acesso-lembrar').checked)
      $('#acesso-codigo').value = '' // o código não fica na página depois de entrar
      App.iniciarApp()
    } catch (err) {
      App.mostrarAcesso(err.message)
    } finally { btn.disabled = false; btn.textContent = 'Entrar' }
  })
  $('#btn-sair').addEventListener('click', async () => {
    if (!await UI.confirmar('Sair do painel?', 'Neste computador será preciso informar o código de acesso novamente.', 'Sair')) return
    await API.sair(); App.mostrarAcesso()
  })
  window.addEventListener('rossa:sessao-expirada', () => App.mostrarAcesso('Sua sessão expirou ou foi encerrada pela gestão. Informe o código de acesso.'))

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
  if (API.sessao()?.token) App.iniciarApp(); else App.mostrarAcesso()
})()
