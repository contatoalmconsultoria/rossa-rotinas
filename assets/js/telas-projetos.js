// Tela "Projetos": quadro semanal (Kanban) com um card por projeto.
// Visível só para quem tem acesso liberado (usuario.ve_projetos) — o servidor confere em toda ação.
(function () {
  const { html, montar, avisar, abrirModal, confirmar, valores, somarDias, dataDoTs } = UI

  const STATUS = {
    aberto: 'Em aberto', pendente: 'Pendente', atrasado: 'Atrasado', concluido: 'Concluído',
  }
  const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const SETA_E = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'
  const SETA_D = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'

  const segundaDe = iso => {
    const d = new Date(iso + 'T12:00:00Z')
    return somarDias(iso, -((d.getUTCDay() + 6) % 7))
  }
  const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7)
  const textoSemana = (ini, fim) => {
    const [a1, m1, d1] = ini.split('-').map(Number)
    const [a2, m2, d2] = fim.split('-').map(Number)
    if (m1 === m2) return `${d1} a ${d2} de ${MESES[m2 - 1]} de ${a2}`
    if (a1 === a2) return `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]} de ${a2}`
    return `${d1} de ${MESES[m1 - 1]} de ${a1} a ${d2} de ${MESES[m2 - 1]} de ${a2}`
  }
  const iniciais = nome => (nome || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '—'

  const Projetos = {
    inicio: null,
    filtro: 'todos',
    dados: null,
    arrastando: false,

    async abrir (raiz) {
      Projetos.raiz = raiz
      Projetos.inicio = Projetos.inicio || segundaDe(dataDoTs(new Date()))
      montar(raiz, html`
        <div class="projetos">
          <div class="pag-cab">
            <div><div class="rotulo">Acompanhamento de projetos</div><h1>Projetos da semana</h1></div>
            <div class="pag-acoes proj-semana">
              <button class="btn proj-icone" type="button" data-semana="-7" aria-label="Semana anterior">${UI.bruto(SETA_E)}</button>
              <div class="proj-semana-txt"><strong data-semana-txt>…</strong><span class="muted small" data-semana-sub></span></div>
              <button class="btn proj-icone" type="button" data-semana="7" aria-label="Próxima semana">${UI.bruto(SETA_D)}</button>
              <button class="btn" type="button" data-semana="hoje">Hoje</button>
              <button class="btn btn-primario" type="button" data-novo>+ Novo projeto</button>
            </div>
          </div>
          <div class="proj-filtros" role="group" aria-label="Filtrar por status" data-filtros></div>
          <div data-quadro><div class="carregando">Carregando projetos…</div></div>
          <p class="muted small proj-dica">Arraste os cards entre os dias ou use as setas do card. Clique no nome do projeto para editar.</p>
        </div>`)

      raiz.querySelectorAll('[data-semana]').forEach(b => b.addEventListener('click', () => {
        const v = b.dataset.semana
        Projetos.inicio = v === 'hoje' ? segundaDe(dataDoTs(new Date())) : somarDias(Projetos.inicio, Number(v))
        Projetos.carregar()
      }))
      raiz.querySelector('[data-novo]').addEventListener('click', () => Projetos.editar(null))
      Projetos.ligarQuadro(raiz.querySelector('[data-quadro]'))
      await Projetos.carregar()
    },

    async carregar () {
      const raiz = Projetos.raiz
      if (!raiz || !raiz.isConnected) return
      try {
        Projetos.dados = await API.chamar('projetos', { inicio: Projetos.inicio })
        Projetos.inicio = Projetos.dados.inicio
      } catch (err) {
        return montar(raiz.querySelector('[data-quadro]'), html`<div class="vazio">${err.message}</div>`)
      }
      Projetos.desenhar()
    },

    colunas () {
      const d = Projetos.dados
      const n = d.trabalha_sabado ? 6 : 5
      const cols = [{ data: null, titulo: 'A programar', sub: 'Sem dia definido' }]
      for (let i = 0; i < n; i++) {
        const iso = somarDias(d.inicio, i)
        cols.push({ data: iso, titulo: DIAS[i], sub: ddmm(iso), hoje: iso === d.hoje })
      }
      return cols
    },

    desenhar () {
      const raiz = Projetos.raiz
      if (!raiz || !raiz.isConnected) return
      const d = Projetos.dados
      const cols = Projetos.colunas()
      const datas = cols.map(c => c.data)
      const fim = somarDias(d.inicio, cols.length - 2)
      raiz.querySelector('[data-semana-txt]').textContent = textoSemana(d.inicio, fim)
      raiz.querySelector('[data-semana-sub]').textContent =
        segundaDe(d.hoje) === d.inicio ? 'Semana atual' : (d.inicio < d.hoje ? 'Semana passada' : 'Semana futura')

      const todos = d.projetos
      const passa = p => Projetos.filtro === 'todos' || p.status === Projetos.filtro
      const cont = k => k === 'todos' ? todos.length : todos.filter(p => p.status === k).length
      montar(raiz.querySelector('[data-filtros]'), html`
        <span class="small muted proj-filtros-rot">Filtrar por status:</span>
        ${[['todos', 'Todos'], ...Object.entries(STATUS)].map(([k, t]) => html`
          <button type="button" class="proj-chip" data-filtro="${k}" data-st="${k}" aria-pressed="${Projetos.filtro === k ? 'true' : 'false'}">
            <span class="proj-ponto" aria-hidden="true"></span>${t} <strong>${cont(k)}</strong></button>`)}`)
      raiz.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.filtro
        Projetos.filtro = Projetos.filtro === k && k !== 'todos' ? 'todos' : k
        Projetos.desenhar()
      }))

      const card = (p, i) => {
        const pos = datas.indexOf(p.data)
        const ant = pos > 0 ? cols[pos - 1] : null
        const prox = pos < cols.length - 1 ? cols[pos + 1] : null
        const passou = p.data && p.data < d.hoje && p.status !== 'concluido'
        return html`
          <article class="proj-card" data-st="${p.status}" data-card="${p.id}" draggable="true">
            <div class="proj-card-topo">
              <span class="proj-pill">${STATUS[p.status]}</span>
              ${p.codigo ? html`<span class="proj-cod">${p.codigo}</span>` : ''}
            </div>
            <h3><button type="button" class="proj-titulo" data-editar="${p.id}">${p.titulo}</button></h3>
            ${p.cliente ? html`<p class="proj-cliente">${p.cliente}</p>` : ''}
            ${p.observacao ? html`<p class="proj-obs">${p.observacao}</p>` : ''}
            ${passou ? html`<p class="proj-alerta">O dia já passou e o projeto não foi concluído.</p>` : ''}
            <div class="proj-card-pe">
              <span class="proj-avatar" aria-hidden="true">${iniciais(p.responsavel)}</span>
              <span class="proj-resp">${p.responsavel || 'Sem responsável'}</span>
              <button type="button" class="proj-seta" data-mover="${p.id}" data-para="${ant ? ant.data ?? '' : ''}" ${ant ? '' : 'disabled'}
                aria-label="${ant ? 'Mover para ' + ant.titulo + (ant.data ? ' ' + ant.sub : '') : 'Sem dia anterior'}">${UI.bruto(SETA_E)}</button>
              <button type="button" class="proj-seta" data-mover="${p.id}" data-para="${prox ? prox.data ?? '' : ''}" ${prox ? '' : 'disabled'}
                aria-label="${prox ? 'Mover para ' + prox.titulo + (prox.data ? ' ' + prox.sub : '') : 'Sem próximo dia'}">${UI.bruto(SETA_D)}</button>
            </div>
            <label class="proj-status">Status
              <select data-status="${p.id}">
                ${Object.entries(STATUS).map(([k, t]) => html`<option value="${k}" ${k === p.status ? 'selected' : ''}>${t}</option>`)}
              </select>
            </label>
          </article>`
      }

      montar(raiz.querySelector('[data-quadro]'), html`
        <div class="proj-rolagem">
          <div class="proj-quadro" style="--proj-cols:${cols.length}">
            ${cols.map(c => {
              const lista = todos.filter(p => p.data === c.data && passa(p))
              return html`
                <section class="proj-col ${c.hoje ? 'hoje' : ''} ${c.data ? '' : 'programar'}" data-coluna="${c.data ?? ''}"
                  aria-label="${c.titulo}${c.data ? ' ' + c.sub : ''}">
                  <div class="proj-col-cab">
                    <div><h2>${c.titulo}</h2><span class="muted small">${c.sub}</span></div>
                    <div class="proj-col-info">${c.hoje ? html`<span class="proj-hoje">Hoje</span>` : ''}<span class="proj-qtd">${lista.length}</span></div>
                  </div>
                  ${lista.map(card)}
                  ${lista.length ? '' : html`<div class="proj-vazio">Arraste um projeto para cá</div>`}
                </section>`
            })}
          </div>
        </div>`)
    },

    // Eventos do quadro (delegados: o quadro é redesenhado a cada mudança)
    ligarQuadro (q) {
      q.addEventListener('click', ev => {
        const ed = ev.target.closest('[data-editar]')
        if (ed) return Projetos.editar(Number(ed.dataset.editar))
        const mv = ev.target.closest('[data-mover]')
        if (mv && !mv.disabled) Projetos.mover(Number(mv.dataset.mover), { data: mv.dataset.para || null })
      })
      q.addEventListener('change', ev => {
        const s = ev.target.closest('[data-status]')
        if (s) Projetos.mover(Number(s.dataset.status), { status: s.value })
      })
      q.addEventListener('dragstart', ev => {
        const c = ev.target.closest('[data-card]')
        if (!c) return
        Projetos.arrastando = true
        ev.dataTransfer.effectAllowed = 'move'
        ev.dataTransfer.setData('text/plain', c.dataset.card)
        requestAnimationFrame(() => c.classList.add('arrastando'))
      })
      q.addEventListener('dragend', ev => {
        Projetos.arrastando = false
        ev.target.closest('[data-card]')?.classList.remove('arrastando')
        q.querySelectorAll('.proj-col.sobre').forEach(c => c.classList.remove('sobre'))
      })
      q.addEventListener('dragover', ev => {
        const col = ev.target.closest('[data-coluna]')
        if (!col) return
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
        if (!col.classList.contains('sobre')) {
          q.querySelectorAll('.proj-col.sobre').forEach(c => c.classList.remove('sobre'))
          col.classList.add('sobre')
        }
      })
      q.addEventListener('dragleave', ev => {
        const col = ev.target.closest('[data-coluna]')
        if (col && !col.contains(ev.relatedTarget)) col.classList.remove('sobre')
      })
      q.addEventListener('drop', ev => {
        const col = ev.target.closest('[data-coluna]')
        if (!col) return
        ev.preventDefault()
        col.classList.remove('sobre')
        Projetos.arrastando = false
        const id = Number(ev.dataTransfer.getData('text/plain'))
        const p = Projetos.dados?.projetos.find(x => x.id === id)
        const destino = col.dataset.coluna || null
        if (p && p.data !== destino) Projetos.mover(id, { data: destino })
      })
    },

    // Muda dia e/ou status. Mostra na hora e desfaz se o servidor não confirmar.
    async mover (id, mudanca) {
      const p = Projetos.dados.projetos.find(x => x.id === id)
      if (!p) return
      const antes = { data: p.data, status: p.status }
      Object.assign(p, mudanca)
      if ('data' in mudanca) p.ordem = Number.MAX_SAFE_INTEGER
      Projetos.desenhar()
      try {
        Object.assign(p, await API.chamar('mover_projeto', { id, ...mudanca }))
        Projetos.desenhar()
      } catch (err) {
        Object.assign(p, antes)
        Projetos.desenhar()
        avisar(err.message, 'erro')
      }
    },

    async editar (id) {
      const p = id ? Projetos.dados.projetos.find(x => x.id === id) : null
      const r = await abrirModal({
        titulo: p ? 'Editar projeto' : 'Novo projeto',
        subtitulo: p?.criado_por ? `Criado por ${p.criado_por}` : 'Sem data, o projeto fica em "A programar".',
        corpo: html`
          <div class="form-grade">
            <label class="campo inteira"><span>Nome do projeto</span><input type="text" name="titulo" required maxlength="200" value="${p?.titulo || ''}"></label>
            <label class="campo"><span>Código <em>(opcional)</em></span><input type="text" name="codigo" maxlength="20" value="${p?.codigo || ''}"></label>
            <label class="campo"><span>Cliente</span><input type="text" name="cliente" maxlength="120" value="${p?.cliente || ''}"></label>
            <label class="campo"><span>Responsável</span><input type="text" name="responsavel" maxlength="80" value="${p?.responsavel || ''}"></label>
            <label class="campo"><span>Dia <em>(vazio = A programar)</em></span><input type="date" name="data" value="${p?.data || ''}"></label>
            <label class="campo"><span>Status</span><select name="status">
              ${Object.entries(STATUS).map(([k, t]) => html`<option value="${k}" ${k === (p?.status || 'aberto') ? 'selected' : ''}>${t}</option>`)}</select></label>
            <label class="campo inteira"><span>Observações</span><textarea name="observacao" maxlength="4000">${p?.observacao || ''}</textarea></label>
          </div>`,
        botoes: [
          ...(p ? [{ rotulo: 'Excluir', tipo: 'perigo', acao: async () => 'excluir' }] : []),
          {
            rotulo: p ? 'Salvar' : 'Criar projeto',
            acao: async form => {
              const v = valores(form)
              const salvo = await API.chamar('salvar_projeto', { ...v, id: p?.id ?? null, data: v.data || null })
              avisar(p ? 'Projeto atualizado.' : 'Projeto criado.')
              return salvo
            },
          },
        ],
      })
      if (r === 'excluir') {
        if (!await confirmar('Excluir este projeto?', `"${p.titulo}" sai do quadro. O registro fica guardado no histórico de auditoria.`, 'Excluir')) return
        try { await API.chamar('excluir_projeto', { id: p.id }); avisar('Projeto excluído.') } catch (err) { avisar(err.message, 'erro') }
        return Projetos.carregar()
      }
      if (r && typeof r === 'object') {
        if (r.data && segundaDe(r.data) !== Projetos.inicio) avisar(`O projeto foi para a semana de ${ddmm(segundaDe(r.data))}.`, 'alerta')
        Projetos.carregar()
      }
    },
  }

  window.Telas = window.Telas || {}
  window.Telas.Projetos = Projetos
})()
