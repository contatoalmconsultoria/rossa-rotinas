// Comunicação com a API. Nenhuma alteração é considerada salva sem resposta confirmada do servidor.
(function () {
  const CHAVE = 'rossa.rotinas.sessao'

  class ErroAPI extends Error {
    constructor (mensagem, status, codigo) { super(mensagem); this.status = status; this.codigo = codigo }
  }

  function lerSessao () {
    try { return JSON.parse(localStorage.getItem(CHAVE) || sessionStorage.getItem(CHAVE) || 'null') } catch { return null }
  }
  function gravarSessao (s, lembrar) {
    try {
      localStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE)
      if (s) (lembrar ? localStorage : sessionStorage).setItem(CHAVE, JSON.stringify(s))
    } catch { /* navegador sem armazenamento: a sessão dura até fechar a aba */ API._memoria = s }
  }

  function avisarConexao (ok) { window.dispatchEvent(new CustomEvent('rossa:conexao', { detail: ok })) }

  const API = {
    ErroAPI,
    _memoria: null,
    sessao () { return lerSessao() || API._memoria },

    async chamar (acao, parametros = {}, opcoes = {}) {
      const sessao = API.sessao()
      const controle = new AbortController()
      const tempo = setTimeout(() => controle.abort(), opcoes.tempoLimite || 25000)
      let resp
      try {
        resp = await fetch(window.ROSSA_CONFIG.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(sessao?.token ? { Authorization: 'Bearer ' + sessao.token } : {}) },
          body: JSON.stringify({ acao, parametros }),
          signal: controle.signal,
          cache: 'no-store',
        })
      } catch (e) {
        avisarConexao(false)
        throw new ErroAPI(controle.signal.aborted
          ? 'O servidor não respondeu a tempo. A alteração NÃO foi confirmada — tente novamente.'
          : 'Sem conexão com o servidor. A alteração NÃO foi salva — verifique a internet e tente novamente.', 0, 'rede')
      } finally { clearTimeout(tempo) }
      avisarConexao(true)

      if (opcoes.arquivo && resp.ok) return resp.blob()
      let corpo = null
      try { corpo = await resp.json() } catch { /* corpo vazio */ }
      if (!resp.ok) {
        if (resp.status === 401 && acao !== 'login') {
          gravarSessao(null)
          window.dispatchEvent(new CustomEvent('rossa:sessao-expirada'))
        }
        throw new ErroAPI(corpo?.erro || `Erro ${resp.status} no servidor. Nada foi salvo.`, resp.status, corpo?.codigo)
      }
      return corpo?.dados
    },

    async entrar (codigo, dispositivo, lembrar) {
      const dados = await API.chamar('login', { codigo, dispositivo })
      gravarSessao({ token: dados.token, perfil: dados.perfil, expira_em: dados.expira_em }, lembrar)
      return dados
    },

    async sair () {
      try { await API.chamar('logout') } catch { /* encerra localmente mesmo sem conexão */ }
      gravarSessao(null)
    },

    async baixar (parametros, nome) {
      const blob = await API.chamar('exportar', { ...parametros, formato: 'csv' }, { arquivo: true })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: nome })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
  }

  window.API = API
})()
