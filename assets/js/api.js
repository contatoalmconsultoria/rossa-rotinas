// Comunicação com o servidor (Supabase Auth + função rossa_api).
// Nenhuma alteração é considerada salva sem resposta confirmada do servidor.
// O navegador guarda apenas a sessão do próprio usuário; a chave pública (publishable)
// não dá acesso a nenhum dado: tudo passa pela função rossa_api, que confere o usuário logado.
(function () {
  const CHAVE = 'rossa.rotinas.auth'
  const cfg = () => window.ROSSA_CONFIG

  class ErroAPI extends Error {
    constructor (mensagem, status, codigo) { super(mensagem); this.status = status; this.codigo = codigo }
  }

  function lerSessao () {
    try { return JSON.parse(localStorage.getItem(CHAVE) || sessionStorage.getItem(CHAVE) || 'null') } catch { return API._memoria }
  }
  function gravarSessao (s, lembrar) {
    API._memoria = s
    try {
      const antes = localStorage.getItem(CHAVE) ? localStorage : sessionStorage
      localStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE)
      const destino = lembrar === undefined ? antes : (lembrar ? localStorage : sessionStorage)
      if (s) destino.setItem(CHAVE, JSON.stringify(s))
    } catch { /* navegador sem armazenamento: a sessão dura até fechar a aba */ }
  }
  function sessaoDeToken (d) {
    return { access_token: d.access_token, refresh_token: d.refresh_token,
      expira: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: d.user?.email }
  }

  function avisarConexao (ok) { window.dispatchEvent(new CustomEvent('rossa:conexao', { detail: ok })) }

  async function requisitar (caminho, { metodo = 'POST', corpo, token, tempoLimite = 25000 } = {}) {
    const controle = new AbortController()
    const tempo = setTimeout(() => controle.abort(), tempoLimite)
    let resp
    try {
      resp = await fetch(cfg().SUPABASE_URL + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', apikey: cfg().SUPABASE_CHAVE_PUBLICA,
          Authorization: 'Bearer ' + (token || cfg().SUPABASE_CHAVE_PUBLICA) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: controle.signal, cache: 'no-store', credentials: 'omit',
      })
    } catch {
      avisarConexao(false)
      throw new ErroAPI(controle.signal.aborted
        ? 'O servidor não respondeu a tempo. A alteração NÃO foi confirmada — tente novamente.'
        : 'Sem conexão com o servidor. A alteração NÃO foi salva — verifique a internet e tente novamente.', 0, 'rede')
    } finally { clearTimeout(tempo) }
    avisarConexao(true)
    let dados = null
    try { dados = await resp.json() } catch { /* corpo vazio */ }
    return { resp, dados }
  }

  let renovando = null
  async function tokenValido () {
    const s = lerSessao()
    if (!s?.access_token) return null
    if (s.expira - Date.now() > 60000) return s.access_token
    if (!renovando) {
      renovando = (async () => {
        const { resp, dados } = await requisitar('/auth/v1/token?grant_type=refresh_token', { corpo: { refresh_token: s.refresh_token } })
        if (!resp.ok) { gravarSessao(null); return null }
        gravarSessao(sessaoDeToken(dados))
        return dados.access_token
      })().finally(() => { renovando = null })
    }
    return renovando
  }

  function expirou () {
    gravarSessao(null)
    window.dispatchEvent(new CustomEvent('rossa:sessao-expirada'))
  }

  const ERROS_LOGIN = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Este e-mail ainda não foi confirmado. Use o link do convite recebido por e-mail.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    user_banned: 'Este acesso está bloqueado. Fale com a gestão.',
  }

  const API = {
    ErroAPI,
    _memoria: null,
    sessao () { return lerSessao() },
    usuario: null, // { nome, email, perfil } — preenchido por carregarUsuario()

    async chamar (acao, parametros = {}, opcoes = {}) {
      const token = await tokenValido()
      if (!token) { expirou(); throw new ErroAPI('Sua sessão expirou. Entre novamente.', 401) }
      const { resp, dados } = await requisitar('/rest/v1/rpc/rossa_api', { corpo: { p_acao: acao, p_param: parametros }, token, tempoLimite: opcoes.tempoLimite })
      if (!resp.ok) {
        const codigo = dados?.code
        if (resp.status === 401 || codigo === 'P0401' || codigo === 'PGRST301' || codigo === 'PGRST303') {
          expirou(); throw new ErroAPI('Sua sessão expirou. Entre novamente.', 401, codigo)
        }
        const msg = /^P0\d{3}$/.test(codigo || '') || (codigo || '').startsWith('22') ? dados.message : null
        throw new ErroAPI(msg || `Erro ${resp.status} no servidor. Nada foi salvo nesta tentativa.`, resp.status, codigo)
      }
      return dados
    },

    async carregarUsuario () {
      API.usuario = await API.chamar('sessao')
      return API.usuario
    },

    async entrar (email, senha, lembrar) {
      const { resp, dados } = await requisitar('/auth/v1/token?grant_type=password', { corpo: { email: email.trim().toLowerCase(), password: senha } })
      if (!resp.ok) throw new ErroAPI(ERROS_LOGIN[dados?.error_code] || (resp.status === 400 ? ERROS_LOGIN.invalid_credentials : 'Não foi possível entrar agora. Tente novamente.'), resp.status, dados?.error_code)
      gravarSessao(sessaoDeToken(dados), lembrar)
      try { return await API.carregarUsuario() } catch (e) { await API.sair(); throw e }
    },

    async esqueciSenha (email) {
      const destino = encodeURIComponent(location.origin + location.pathname)
      const { resp } = await requisitar('/auth/v1/recover?redirect_to=' + destino, { corpo: { email: email.trim().toLowerCase() } })
      if (!resp.ok && resp.status !== 429) throw new ErroAPI('Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.', resp.status)
    },

    // Link do e-mail (convite ou recuperação) volta com a sessão no endereço: #access_token=…&type=recovery
    lerLinkDoEmail () {
      const h = new URLSearchParams(location.hash.replace(/^#/, ''))
      if (h.get('error_description')) {
        history.replaceState(null, '', location.pathname)
        return { erro: 'O link do e-mail expirou ou já foi usado. Peça um novo em "Esqueci minha senha".' }
      }
      if (!h.get('access_token') || !['recovery', 'invite', 'signup', 'magiclink'].includes(h.get('type'))) return null
      gravarSessao(sessaoDeToken({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') }), false)
      history.replaceState(null, '', location.pathname)
      return { tipo: h.get('type') }
    },

    async definirSenha (senha) {
      const token = await tokenValido()
      if (!token) throw new ErroAPI('O link expirou. Peça um novo em "Esqueci minha senha".', 401)
      const { resp, dados } = await requisitar('/auth/v1/user', { metodo: 'PUT', corpo: { password: senha }, token })
      if (!resp.ok) {
        const m = dados?.error_code === 'weak_password' ? 'Senha fraca. Use pelo menos 10 caracteres, com letras e números.'
          : dados?.error_code === 'same_password' ? 'A nova senha precisa ser diferente da anterior.'
            : 'Não foi possível salvar a senha. Tente novamente.'
        throw new ErroAPI(m, resp.status, dados?.error_code)
      }
    },

    async sair () {
      const s = lerSessao()
      if (s?.access_token) { try { await requisitar('/auth/v1/logout', { token: s.access_token, tempoLimite: 8000 }) } catch { /* encerra localmente */ } }
      gravarSessao(null); API.usuario = null
    },

    // Exportação em CSV no padrão do Excel em português (separador ";" e BOM UTF-8)
    async baixar (parametros, nome) {
      const linhas = await API.chamar('exportar', parametros) || []
      const cols = COLUNAS[parametros.tipo] || (linhas.length ? Object.keys(linhas[0]) : ['sem_dados'])
      const esc = v => {
        if (v === null || v === undefined) return ''
        let s = typeof v === 'object' ? JSON.stringify(v) : String(v)
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // evita execução de fórmulas no Excel
        return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const texto = '﻿' + [cols.join(';'), ...linhas.map(l => cols.map(c => esc(l[c])).join(';'))].join('\r\n')
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: nome })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
  }

  const COLUNAS = {
    execucoes: ['data_prevista', 'periodo_inicio', 'periodo_fim', 'codigo', 'tarefa', 'categoria', 'frequencia', 'prioridade', 'area', 'responsavel',
      'situacao', 'motivo', 'justificativa', 'prazo', 'concluida_em', 'no_prazo', 'encerrada_automaticamente', 'origem_registro', 'observacoes'],
    historico: ['ocorrido_em', 'data_prevista', 'codigo', 'tarefa', 'acao', 'situacao_anterior', 'situacao_nova', 'motivo', 'detalhe', 'origem'],
    pendencias: ['data_origem', 'codigo', 'tarefa', 'motivo', 'detalhe', 'responsavel_resolucao', 'prazo_resolucao', 'status', 'aberta_em', 'resolvida_em', 'resolucao'],
    indicadores: ['codigo', 'tarefa', 'previstas', 'concluidas', 'concluidas_no_prazo', 'concluidas_com_atraso', 'pendentes', 'nao_realizadas', 'dispensadas', 'taxa_conclusao_pct', 'taxa_no_prazo_pct'],
  }

  window.API = API
})()
