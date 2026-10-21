// Telas operacionais: Hoje, Pendências e Histórico.
(function () {
  const { html, montar, STATUS, FREQ, PRIO, COR_STATUS, fmtData, fmtDataLonga, fmtHora, fmtDataHora, dataDoTs, pct, textoPrazo, avisar, abrirModal, confirmar, valores, icone } = UI
  const CATEGORIAS = { diaria: 'Tarefas diárias', semanal: 'Tarefas semanais', mensal: 'Tarefas mensais', periodica: 'Tarefas periódicas', sob_demanda: 'Tarefas sob demanda' }
  const ACOES_HIST = {
    criacao: 'Registro criado', status: 'Situação alterada', observacao: 'Observação', pendencia_aberta: 'Pendência aberta',
    pendencia_atualizada: 'Pendência atualizada', pendencia_resolvida: 'Pendência resolvida',
    encerramento_automatico: 'Encerrada automaticamente', dispensa_automatica: 'Dispensada (tarefa desativada)',
  }

  const pref = {
    ler (k, padrao) { try { return JSON.parse(localStorage.getItem('rossa.rotinas.' + k)) ?? padrao } catch { return padrao } },
    gravar (k, v) { try { localStorage.setItem('rossa.rotinas.' + k, JSON.stringify(v)) } catch { /* sem armazenamento */ } },
  }
  let motivosPadrao = ['Aguardando documento do fornecedor', 'Aguardando liberação do GestãoClick', 'Aguardando retorno do responsável',
    'Falta de informação', 'Problema no sistema', 'Atividade não realizada por falta de tempo', 'Outro motivo']
  let responsaveis = []
  async function carregarListas () {
    try {
      const c = await API.chamar('cadastros')
      if (Array.isArray(c.motivos) && c.motivos.length) motivosPadrao = c.motivos
      responsaveis = c.responsaveis.filter(r => r.ativo).map(r => r.nome)
    } catch { /* usa os padrões */ }
  }

  // ===========================================================================
  // Componente: linha de tarefa (execução)
  // ===========================================================================
  const Tarefas = {
    detalhes: new Map(), // id → detalhe carregado (observações e histórico)
    abertas: new Set(),
    salvoEm: new Map(),
    ultimoClique: new Map(),

    linha (e, { editavel = true, mostrarData = false } = {}) {
      const aberta = Tarefas.abertas.has(e.id)
      const det = Tarefas.detalhes.get(e.id)
      const feito = e.status === 'concluida'
      const salvo = Tarefas.salvoEm.get(e.id)
      return html`
      <article class="tarefa st-${e.status}" data-st="${e.status}" data-id="${e.id}" style="--st-cor: ${COR_STATUS[e.status]}">
        <div class="tarefa-linha">
          ${editavel
            ? html`<button type="button" class="marcar ${feito ? 'feito' : ''}" data-acao="marcar" aria-pressed="${feito}" aria-label="${feito ? 'Reabrir' : 'Marcar como concluída'}: ${e.nome}" title="${feito ? 'Concluída — clique para reabrir' : 'Marcar como concluída'}">${feito ? icone('check') : ''}</button>`
            : html`<span class="pill" data-st="${e.status}">${STATUS[e.status]}</span>`}
          <div class="tarefa-info">
            <div class="tarefa-nome">${e.nome}<span class="tarefa-cod">${e.codigo}</span></div>
            <div class="tarefa-meta">
              <span>${FREQ[e.frequencia] || e.frequencia}</span>
              ${mostrarData ? html`<span>Previsto: ${fmtData(e.data_prevista)}</span>` : ''}
              <span class="${e.atrasada ? 'atrasada' : ''}">${e.atrasada ? 'Atrasada · ' : ''}${textoPrazo(e)}</span>
              <span class="prio prio-${e.prioridade}">${PRIO[e.prioridade]}</span>
              ${e.responsavel ? html`<span>${e.responsavel}</span>` : ''}
              ${e.status === 'concluida' ? html`<span>Concluída ${dataDoTs(e.concluida_em) !== e.data_prevista ? fmtDataHora(e.concluida_em) : 'às ' + fmtHora(e.concluida_em)}${e.concluida_no_prazo === false ? ' (com atraso)' : ''}</span>` : ''}
              ${e.motivo && ['pendente', 'nao_realizada', 'nao_aplicavel'].includes(e.status) ? html`<span class="motivo">${e.motivo}</span>` : ''}
              ${e.status === 'nao_aplicavel' && e.justificativa ? html`<span class="motivo">${e.justificativa}</span>` : ''}
              ${e.origem === 'manual' ? html`<span class="pill pill-ouro">Sob demanda</span>` : ''}
            </div>
          </div>
          <div class="tarefa-acoes">
            <span class="salvo" data-salvo>${salvo ? 'Salvo ' + salvo : ''}</span>
            ${editavel ? html`<select class="status-sel" data-st="${e.status}" data-acao="status" aria-label="Situação de ${e.nome}">
                ${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${k === e.status ? 'selected' : ''}>${v}</option>`)}
              </select>` : ''}
            ${e.pop?.url ? html`<a class="icone-btn" href="${e.pop.url}" target="_blank" rel="noopener noreferrer" title="Ver procedimento ${e.pop.codigo}" aria-label="Ver procedimento ${e.pop.codigo}">${icone('livro')}</a>` : ''}
            <button type="button" class="icone-btn" data-acao="abrir" aria-expanded="${aberta}" title="Observações e detalhes" aria-label="Observações e detalhes">
              ${icone('nota')}${e.observacoes_qtd ? html`<span class="n">${e.observacoes_qtd}</span>` : ''}
            </button>
          </div>
        </div>
        ${aberta ? Tarefas.painelDetalhe(e, det, editavel) : ''}
      </article>`
    },

    painelDetalhe (e, det, editavel) {
      return html`
      <div class="tarefa-det">
        ${e.descricao ? html`<p class="desc">${e.descricao}</p>` : ''}
        ${e.pop ? html`<p class="small">Procedimento: <strong>${e.pop.codigo}</strong> — ${e.pop.nome}${e.pop.versao ? ' (versão ' + e.pop.versao + ')' : ''}
            ${e.pop.url ? html` · <a href="${e.pop.url}" target="_blank" rel="noopener noreferrer">Ver procedimento</a>` : html` · <span class="muted">link ainda não cadastrado</span>`}</p>` : ''}
        ${e.pendencia_aberta ? html`<p class="small"><strong>Pendência:</strong> ${e.pendencia_aberta.motivo}${e.pendencia_aberta.detalhe ? ' — ' + e.pendencia_aberta.detalhe : ''}
            ${e.pendencia_aberta.responsavel_resolucao ? html` · Resolve: ${e.pendencia_aberta.responsavel_resolucao}` : ''}${e.pendencia_aberta.prazo_resolucao ? html` · Até ${fmtData(e.pendencia_aberta.prazo_resolucao)}` : ''}</p>` : ''}
        <div>
          <strong class="small">Observações desta execução</strong>
          ${!det ? html`<p class="muted small">Carregando…</p>` : det.observacoes.length
            ? html`<ul class="obs-lista">${det.observacoes.map(o => html`<li><time>${fmtDataHora(o.criado_em)}</time>${o.texto}</li>`)}</ul>`
            : html`<p class="muted small">Nenhuma observação.</p>`}
        </div>
        ${editavel ? html`
        <form class="obs-form" data-acao="obs">
          <textarea name="texto" rows="2" maxlength="4000" required placeholder="Escreva uma observação sobre esta execução…" aria-label="Nova observação"></textarea>
          <button class="btn btn-primario" type="submit">Adicionar</button>
        </form>` : ''}
        ${det ? html`<details><summary class="small">Histórico de alterações (${det.historico.length})</summary>${Tarefas.linhaTempo(det.historico)}</details>` : ''}
      </div>`
    },

    linhaTempo (historico) {
      return html`<ul class="linha-tempo">${historico.map(h => html`
        <li class="${h.posterior_ao_periodo ? 'posterior' : ''}"><time>${fmtDataHora(h.ocorrido_em)}</time>
          ${ACOES_HIST[h.acao] || h.acao}${h.status_anterior || h.status_novo ? html`: ${h.status_anterior ? STATUS[h.status_anterior] + ' → ' : ''}${STATUS[h.status_novo] || ''}` : ''}
          ${h.motivo ? html` · ${h.motivo}` : ''}${h.detalhe?.justificativa ? html` · ${h.detalhe.justificativa}` : ''}${h.detalhe?.texto ? html` · “${h.detalhe.texto}”` : ''}${h.detalhe?.resolucao ? html` · ${h.detalhe.resolucao}` : ''}
          ${h.posterior_ao_periodo ? html` <em>(após o período)</em>` : ''}
          <span class="muted"> · ${h.origem.startsWith('sistema') ? 'sistema' : h.origem.replace(/ ip:.*/, '')}</span></li>`)}</ul>`
    },

    // Liga os eventos de uma lista de tarefas. obter(id) → execução; trocar(execAtualizada) atualiza o estado da tela.
    ligar (container, { obter, trocar, recarregar }) {
      const redesenhar = id => {
        const el = container.querySelector(`.tarefa[data-id="${id}"]`)
        const e = obter(id)
        if (el && e) { el.outerHTML = String(Tarefas.linha(e, { editavel: !el.closest('[data-somente-leitura]'), mostrarData: !!el.closest('[data-mostrar-data]') })) }
      }
      const salvar = async (e, status, extra = {}) => {
        const el = container.querySelector(`.tarefa[data-id="${e.id}"]`)
        el?.classList.add('ocupada')
        const marca = el?.querySelector('[data-salvo]'); if (marca) { marca.className = 'salvando'; marca.textContent = 'Salvando…' }
        try {
          const nova = await API.chamar('alterar_status', { id: e.id, status, versao: e.versao, ...extra })
          Tarefas.salvoEm.set(e.id, fmtHora(new Date()))
          Tarefas.detalhes.delete(e.id)
          trocar(nova)
          if (Tarefas.abertas.has(e.id)) Tarefas.carregarDetalhe(e.id).then(() => redesenhar(e.id))
          return true
        } catch (err) {
          if (err.status === 409) { avisar(err.message, 'alerta'); recarregar(); return false }
          avisar(err.message, 'erro')
          redesenhar(e.id) // volta ao estado confirmado
          throw err
        }
      }

      container.addEventListener('click', async ev => {
        const alvo = ev.target.closest('[data-acao]'); if (!alvo || alvo.tagName === 'SELECT' || alvo.tagName === 'FORM') return
        const id = Number(alvo.closest('.tarefa')?.dataset.id); const e = obter(id); if (!e) return
        if (alvo.dataset.acao === 'marcar') {
          // ignora clique duplo: o segundo clique cairia no botão já redesenhado e pediria para reabrir
          const agora = Date.now()
          if (alvo.closest('.tarefa').classList.contains('ocupada') || agora - (Tarefas.ultimoClique.get(id) || 0) < 1200) return
          Tarefas.ultimoClique.set(id, agora)
          if (e.status === 'concluida') {
            if (!await confirmar('Reabrir tarefa?', `"${e.nome}" voltará para "A fazer". A conclusão anterior continua registrada no histórico.`, 'Reabrir')) return
            salvar(obter(id), 'a_fazer').catch(() => {})
          } else if (e.status === 'pendente') {
            Tarefas.pedirMotivo(e, 'concluida', salvar)
          } else salvar(e, 'concluida').catch(() => {})
        }
        if (alvo.dataset.acao === 'abrir') {
          if (Tarefas.abertas.has(id)) Tarefas.abertas.delete(id); else Tarefas.abertas.add(id)
          redesenhar(id)
          if (Tarefas.abertas.has(id) && !Tarefas.detalhes.has(id)) { await Tarefas.carregarDetalhe(id); redesenhar(id) }
        }
      })

      container.addEventListener('change', ev => {
        const sel = ev.target.closest('select[data-acao="status"]'); if (!sel) return
        const id = Number(sel.closest('.tarefa').dataset.id); const e = obter(id)
        const novo = sel.value
        sel.value = e.status // só muda depois da confirmação do servidor
        if (novo === e.status && novo !== 'pendente') return
        if (['pendente', 'nao_realizada', 'nao_aplicavel'].includes(novo) || e.status === 'pendente') Tarefas.pedirMotivo(e, novo, salvar)
        else salvar(e, novo).catch(() => {})
      })

      container.addEventListener('submit', async ev => {
        const form = ev.target.closest('form[data-acao="obs"]'); if (!form) return
        ev.preventDefault()
        const id = Number(form.closest('.tarefa').dataset.id)
        const texto = form.texto.value.trim(); if (!texto) return
        const btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Salvando…'
        try {
          const nova = await API.chamar('adicionar_observacao', { id, texto })
          Tarefas.salvoEm.set(id, fmtHora(new Date()))
          await Tarefas.carregarDetalhe(id)
          trocar(nova)
          avisar('Observação salva.')
        } catch (err) {
          avisar(err.message, 'erro'); btn.disabled = false; btn.textContent = 'Adicionar' // o texto digitado permanece
        }
      })
    },

    async carregarDetalhe (id) {
      try { Tarefas.detalhes.set(id, await API.chamar('execucao_detalhe', { id })) } catch (err) { avisar(err.message, 'erro') }
    },

    // Modal de motivo / justificativa / resolução
    pedirMotivo (e, novo, salvar) {
      const precisaMotivo = ['pendente', 'nao_realizada'].includes(novo)
      const resolvendo = e.status === 'pendente' && novo !== 'pendente'
      const titulos = { pendente: 'Registrar pendência', nao_realizada: 'Registrar como não realizada', nao_aplicavel: 'Dispensar nesta data (não aplicável)' }
      return abrirModal({
        titulo: resolvendo ? 'Encerrar pendência' : titulos[novo] || 'Alterar situação',
        subtitulo: e.nome,
        corpo: html`
          ${resolvendo ? html`<p class="small">A pendência <strong>${e.pendencia_aberta?.motivo || e.motivo}</strong> será marcada como resolvida e continuará no histórico. Nova situação: <strong>${STATUS[novo]}</strong>.</p>
            <label class="campo"><span>Como foi resolvida?</span><textarea name="resolucao" required maxlength="2000"></textarea></label>` : ''}
          ${precisaMotivo || novo === 'nao_aplicavel' ? html`
            <label class="campo"><span>Motivo ${novo === 'nao_aplicavel' ? html`<em>(opcional)</em>` : ''}</span>
              <select name="motivo" ${precisaMotivo ? 'required' : ''}><option value="">Selecione…</option>${motivosPadrao.map(m => html`<option>${m}</option>`)}</select></label>
            <label class="campo"><span>${novo === 'nao_aplicavel' ? 'Justificativa' : 'Detalhe'} ${novo === 'nao_aplicavel' ? '' : html`<em>(complemento livre)</em>`}</span>
              <textarea name="justificativa" maxlength="2000" ${novo === 'nao_aplicavel' ? 'required' : ''} placeholder="${novo === 'nao_aplicavel' ? 'Por que esta tarefa não se aplica nesta data?' : 'Ex.: NF importada às 9h, PDF ainda não liberado'}"></textarea></label>` : ''}
          ${novo === 'pendente' ? html`
            <div class="form-grade">
              <label class="campo"><span>Responsável pela resolução</span>
                <input type="text" name="responsavel_resolucao" list="lista-resp" maxlength="120" value="${e.pendencia_aberta?.responsavel_resolucao || ''}">
                <datalist id="lista-resp">${responsaveis.map(r => html`<option value="${r}">`)}</datalist></label>
              <label class="campo"><span>Prazo para resolver</span><input type="date" name="prazo_resolucao" value="${e.pendencia_aberta?.prazo_resolucao || ''}"></label>
            </div>` : ''}`,
        botoes: [{
          rotulo: 'Salvar',
          acao: async form => {
            const v = valores(form)
            if (v.motivo === 'Outro motivo' && !v.justificativa) throw new Error('Descreva o motivo no campo de detalhe.')
            if (resolvendo) {
              await salvar(e, novo, { resolucao: v.resolucao, motivo: v.motivo || null, justificativa: v.justificativa || null })
              avisar('Pendência resolvida e mantida no histórico.')
              return true
            }
            await salvar(e, novo, { motivo: v.motivo || null, justificativa: v.justificativa || null,
              responsavel_resolucao: v.responsavel_resolucao || null, prazo_resolucao: v.prazo_resolucao || null })
            return true
          },
        }],
      })
    },
  }

  // ===========================================================================
  // Tela: Hoje
  // ===========================================================================
  const Hoje = {
    dados: null,
    filtros: pref.ler('filtros', { busca: '', status: 'todos', categoria: 'todas', prioridade: 'todas', prazo: 'todos' }),
    fechados: new Set(pref.ler('grupos_fechados', [])),

    async abrir (raiz) {
      Hoje.raiz = raiz
      montar(raiz, html`<div class="carregando">Carregando as tarefas do dia…</div>`)
      if (!responsaveis.length) carregarListas()
      await Hoje.carregar()
    },

    async carregar () {
      try {
        Hoje.dados = await API.chamar('dia')
        Hoje.desenhar()
      } catch (err) {
        if (!Hoje.dados) montar(Hoje.raiz, html`<div class="vazio"><p>${err.message}</p><p style="margin-top:12px"><button class="btn btn-primario" data-tentar>Tentar novamente</button></p></div>`)
        Hoje.raiz.querySelector('[data-tentar]')?.addEventListener('click', () => Hoje.carregar())
        if (Hoje.dados) avisar(err.message, 'erro')
      }
    },

    filtrar (lista) {
      const f = Hoje.filtros
      const termo = f.busca.toLowerCase()
      const fimSemana = UI.somarDias(Hoje.dados.data, 7)
      return lista.filter(e =>
        (!termo || (e.nome + ' ' + e.codigo + ' ' + (e.area || '')).toLowerCase().includes(termo)) &&
        (f.status === 'todos' || (f.status === 'abertas' ? ['a_fazer', 'em_andamento'].includes(e.status) : f.status === 'atrasadas' ? e.atrasada : e.status === f.status)) &&
        (f.categoria === 'todas' || e.categoria === f.categoria) &&
        (f.prioridade === 'todas' || e.prioridade === f.prioridade) &&
        (f.prazo === 'todos' || (f.prazo === 'hoje' ? e.data_prevista === Hoje.dados.data : f.prazo === 'atrasadas' ? e.atrasada : e.data_prevista <= fimSemana)))
    },

    kpis (r) {
      const atras = r.atrasadas + r.nao_realizadas
      return html`
      <div class="kpis">
        <div class="kpi" style="--kpi-cor: var(--color-primary)"><div class="v">${r.previstas}</div><div class="l">Previstas</div></div>
        <div class="kpi" style="--kpi-cor: var(--st-concluida)"><div class="v">${r.concluidas}</div><div class="l">Concluídas</div></div>
        <div class="kpi" style="--kpi-cor: var(--st-em_andamento)"><div class="v">${r.em_andamento}</div><div class="l">Em andamento</div></div>
        <div class="kpi" style="--kpi-cor: var(--st-pendente)"><div class="v">${r.pendentes}</div><div class="l">Pendentes</div></div>
        <div class="kpi" style="--kpi-cor: var(--st-nao_realizada)"><div class="v">${atras}</div><div class="l">Atrasadas / não realizadas</div></div>
        <div class="kpi destaque"><div class="v">${pct(r.taxa_conclusao ?? 0)}</div><div class="l">Concluído</div></div>
      </div>
      <div class="progresso">
        <div class="progresso-topo"><span>Progresso do dia</span><span>${r.concluidas} de ${r.previstas} concluídas${r.dispensadas ? ` · ${r.dispensadas} dispensada(s)` : ''}</span></div>
        <div class="barra" role="img" aria-label="${r.concluidas} de ${r.previstas} concluídas">
          ${[['concluidas', 'concluida'], ['em_andamento', 'em_andamento'], ['pendentes', 'pendente'], ['nao_realizadas', 'nao_realizada']].map(([k, s]) =>
            html`<span style="width:${r.previstas ? (100 * r[k] / r.previstas) : 0}%; background:${COR_STATUS[s]}"></span>`)}
        </div>
        <div class="legenda">
          <span><i style="background:${COR_STATUS.concluida}"></i>Concluídas</span><span><i style="background:${COR_STATUS.em_andamento}"></i>Em andamento</span>
          <span><i style="background:${COR_STATUS.pendente}"></i>Pendentes</span><span><i style="background:${COR_STATUS.nao_realizada}"></i>Não realizadas</span>
          <span><i style="background:var(--surface-sunken)"></i>A fazer</span>
        </div>
      </div>`
    },

    desenhar () {
      const d = Hoje.dados, f = Hoje.filtros
      const lista = Hoje.filtrar(d.execucoes)
      const grupos = Object.keys(CATEGORIAS).map(c => ({ c, itens: lista.filter(e => e.categoria === c), total: d.execucoes.filter(e => e.categoria === c) }))
      const sel = (nome, opcoes) => html`<select data-filtro="${nome}" aria-label="Filtro">${opcoes.map(([v, t]) => html`<option value="${v}" ${f[nome] === v ? 'selected' : ''}>${t}</option>`)}</select>`
      montar(Hoje.raiz, html`
        <div class="pag-cab">
          <div><div class="rotulo">Visão do dia</div><h1>${fmtDataLonga(d.data)}</h1>
            ${!d.dia_util ? html`<p class="muted small">${d.feriado ? 'Feriado: ' + d.feriado : 'Dia não útil no calendário da Rossa'} — apenas tarefas semanais/mensais em andamento.</p>` : ''}</div>
          <div class="pag-acoes"><button class="btn" data-atualizar>Atualizar</button></div>
        </div>
        ${Hoje.kpis(d.resumo)}
        ${d.pendencias_abertas ? html`<div class="aviso-faixa"><span>${d.pendencias_abertas} pendência(s) aberta(s) aguardando resolução.</span><a class="btn btn-pequeno" href="#/pendencias">Ver pendências</a></div>` : ''}
        <div class="filtros">
          <input type="search" data-filtro="busca" placeholder="Buscar tarefa…" value="${f.busca}" aria-label="Buscar tarefa">
          ${sel('status', [['todos', 'Todas as situações'], ['abertas', 'Em aberto'], ['atrasadas', 'Atrasadas'], ...Object.entries(STATUS)])}
          ${sel('categoria', [['todas', 'Todas as categorias'], ...Object.entries(CATEGORIAS)])}
          ${sel('prioridade', [['todas', 'Todas as prioridades'], ...Object.entries(PRIO)])}
          ${sel('prazo', [['todos', 'Qualquer prazo'], ['hoje', 'Vence hoje'], ['atrasadas', 'Atrasadas'], ['semana', 'Próximos 7 dias']])}
          ${Object.values(f).some((v, i) => v !== ['', 'todos', 'todas', 'todas', 'todos'][i]) ? html`<button class="btn-link" data-limpar>Limpar filtros</button>` : ''}
        </div>
        <div data-lista>
          ${grupos.filter(g => g.total.length).map(g => html`
            <section class="grupo" ${Hoje.fechados.has(g.c) ? 'data-fechado' : ''} data-grupo="${g.c}">
              <button class="grupo-cab" data-alternar="${g.c}" aria-expanded="${!Hoje.fechados.has(g.c)}">
                <h2>${CATEGORIAS[g.c]}</h2>
                <span class="cont">${g.total.filter(e => e.status === 'concluida').length}/${g.total.filter(e => e.status !== 'nao_aplicavel').length} concluídas</span>
                <span class="seta">${icone('mais')}</span>
              </button>
              <div class="lista">${g.itens.length ? g.itens.map(e => Tarefas.linha(e)) : html`<p class="muted small">Nenhuma tarefa com os filtros atuais.</p>`}</div>
            </section>`)}
          ${!d.execucoes.length ? html`<div class="vazio">Nenhuma tarefa prevista para hoje.</div>` : ''}
        </div>
        ${d.sob_demanda.length ? html`
          <section class="cartao" style="margin-top:20px">
            <h3>Registrar tarefa sob demanda</h3>
            <p class="muted small" style="margin-bottom:10px">Quando surgir uma destas atividades, registre aqui para que ela entre no histórico do dia.</p>
            <div class="demanda">${d.sob_demanda.map(t => html`<button class="btn" data-demanda="${t.id}">+ ${t.nome}</button>`)}</div>
          </section>` : ''}`)
      Hoje.ligarEventos()
    },

    ligarEventos () {
      const raiz = Hoje.raiz
      raiz.querySelector('[data-atualizar]').addEventListener('click', () => Hoje.carregar())
      raiz.querySelectorAll('[data-filtro]').forEach(c => c.addEventListener(c.type === 'search' ? 'input' : 'change', () => {
        Hoje.filtros[c.dataset.filtro] = c.value; pref.gravar('filtros', Hoje.filtros)
        const pos = c.selectionStart
        Hoje.desenhar()
        if (c.type === 'search') { const n = Hoje.raiz.querySelector('[data-filtro=busca]'); n.focus(); n.setSelectionRange(pos, pos) }
      }))
      raiz.querySelector('[data-limpar]')?.addEventListener('click', () => {
        Hoje.filtros = { busca: '', status: 'todos', categoria: 'todas', prioridade: 'todas', prazo: 'todos' }; pref.gravar('filtros', Hoje.filtros); Hoje.desenhar()
      })
      raiz.querySelectorAll('[data-alternar]').forEach(b => b.addEventListener('click', () => {
        const c = b.dataset.alternar
        if (Hoje.fechados.has(c)) Hoje.fechados.delete(c); else Hoje.fechados.add(c)
        pref.gravar('grupos_fechados', [...Hoje.fechados]); Hoje.desenhar()
      }))
      raiz.querySelectorAll('[data-demanda]').forEach(b => b.addEventListener('click', () => Hoje.registrarDemanda(Number(b.dataset.demanda), b.textContent.slice(2))))
      Tarefas.ligar(raiz.querySelector('[data-lista]'), {
        obter: id => Hoje.dados.execucoes.find(e => e.id === id),
        trocar: nova => {
          const i = Hoje.dados.execucoes.findIndex(e => e.id === nova.id)
          if (i >= 0) Hoje.dados.execucoes[i] = nova
          Hoje.recalcularResumo(); Hoje.desenhar()
        },
        recarregar: () => Hoje.carregar(),
      })
    },

    recalcularResumo () {
      const ex = Hoje.dados.execucoes, agora = Date.now()
      const n = s => ex.filter(e => e.status === s).length
      const previstas = ex.filter(e => e.status !== 'nao_aplicavel').length
      const concl = n('concluida')
      Hoje.dados.resumo = {
        previstas, concluidas: concl, em_andamento: n('em_andamento'), pendentes: n('pendente'), nao_realizadas: n('nao_realizada'),
        dispensadas: n('nao_aplicavel'), atrasadas: ex.filter(e => ['a_fazer', 'em_andamento'].includes(e.status) && new Date(e.prazo) < agora).length,
        taxa_conclusao: previstas ? Math.round(1000 * concl / previstas) / 10 : null,
      }
    },

    registrarDemanda (tarefaId, nome) {
      abrirModal({
        titulo: 'Registrar tarefa sob demanda', subtitulo: nome,
        corpo: html`<label class="campo"><span>Observação <em>(opcional)</em></span><textarea name="observacao" maxlength="4000" placeholder="Ex.: NF 1234 para o cliente X"></textarea></label>
          <label class="check"><input type="checkbox" name="concluida" value="1" checked> Já foi realizada (marcar como concluída)</label>`,
        botoes: [{
          rotulo: 'Registrar',
          acao: async form => {
            const v = valores(form)
            const nova = await API.chamar('registrar_demanda', { tarefa_id: tarefaId, observacao: v.observacao || null })
            if (v.concluida) {
              try { await API.chamar('alterar_status', { id: nova.id, status: 'concluida', versao: nova.versao }) } catch (err) {
                avisar('Registrada, mas a conclusão não foi salva: ' + err.message, 'erro')
              }
            }
            return true
          },
        }],
      }).then(r => { if (r) { avisar('Tarefa registrada.'); Hoje.carregar() } })
    },
  }

  // ===========================================================================
  // Tela: Pendências
  // ===========================================================================
  const Pendencias = {
    filtro: 'aberta',
    async abrir (raiz) {
      Pendencias.raiz = raiz
      if (!responsaveis.length) await carregarListas()
      montar(raiz, html`<div class="carregando">Carregando pendências…</div>`)
      await Pendencias.carregar()
    },
    async carregar () {
      try {
        Pendencias.lista = await API.chamar('pendencias', { status: Pendencias.filtro })
        Pendencias.desenhar()
      } catch (err) { montar(Pendencias.raiz, html`<div class="vazio">${err.message}</div>`) }
    },
    desenhar () {
      const l = Pendencias.lista
      montar(Pendencias.raiz, html`
        <div class="pag-cab"><div><div class="rotulo">Impedimentos</div><h1>Pendências</h1></div>
          <div class="chips" role="group" aria-label="Filtrar pendências">
            ${[['aberta', 'Abertas'], ['resolvida', 'Resolvidas'], ['todas', 'Todas']].map(([v, t]) => html`<button class="chip" data-f="${v}" aria-pressed="${Pendencias.filtro === v}">${t}</button>`)}
          </div></div>
        ${l.length ? l.map(p => html`
          <article class="cartao pend-card">
            <div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <strong>${p.tarefa}</strong><span class="muted small">${p.codigo}</span>
                <span class="pill ${p.status === 'aberta' ? '' : 'pill-neutra'}" data-st="${p.status === 'aberta' ? 'pendente' : 'concluida'}">${p.status === 'aberta' ? (p.dias_aberta ? `Aberta há ${p.dias_aberta} dia(s)` : 'Aberta hoje') : 'Resolvida'}</span>
              </div>
              <dl>
                <div><dt>Data de origem</dt><dd>${fmtData(p.data_origem)}</dd></div>
                <div><dt>Motivo</dt><dd>${p.motivo}</dd></div>
                <div><dt>Observação</dt><dd>${p.detalhe || p.ultima_observacao || '—'}</dd></div>
                <div><dt>Responsável pela resolução</dt><dd>${p.responsavel_resolucao || '—'}</dd></div>
                <div><dt>Prazo para resolução</dt><dd class="${p.prazo_vencido ? 'vencido' : ''}">${p.prazo_resolucao ? fmtData(p.prazo_resolucao) : '—'}${p.prazo_vencido ? ' (vencido)' : ''}</dd></div>
                <div><dt>Situação atual da tarefa</dt><dd><span class="pill" data-st="${p.execucao_status}">${STATUS[p.execucao_status]}</span></dd></div>
                ${p.status === 'resolvida' ? html`<div><dt>Resolvida em</dt><dd>${fmtDataHora(p.resolvida_em)}</dd></div><div><dt>Resolução</dt><dd>${p.resolucao}</dd></div>` : ''}
              </dl>
            </div>
            <div class="acoes">
              ${p.status === 'aberta' ? html`<button class="btn btn-primario" data-resolver="${p.id}">Resolver</button>
                <button class="btn" data-editar="${p.id}">Acompanhamento</button>` : ''}
              <button class="btn" data-ver="${p.execucao_id}">Histórico</button>
            </div>
          </article>`) : html`<div class="vazio">${Pendencias.filtro === 'aberta' ? 'Nenhuma pendência aberta. 👍' : 'Nenhuma pendência neste filtro.'}</div>`}`)
      const raiz = Pendencias.raiz
      raiz.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { Pendencias.filtro = b.dataset.f; Pendencias.carregar() }))
      raiz.querySelectorAll('[data-resolver]').forEach(b => b.addEventListener('click', () => Pendencias.resolver(l.find(p => p.id === Number(b.dataset.resolver)))))
      raiz.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => Pendencias.editar(l.find(p => p.id === Number(b.dataset.editar)))))
      raiz.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => verHistoricoExecucao(Number(b.dataset.ver))))
    },
    resolver (p) {
      abrirModal({
        titulo: 'Resolver pendência', subtitulo: `${p.tarefa} — origem ${fmtData(p.data_origem)}`,
        corpo: html`<p class="small">Motivo: <strong>${p.motivo}</strong>. A pendência continuará registrada no histórico.</p>
          <label class="campo"><span>Como foi resolvida?</span><textarea name="resolucao" required maxlength="2000"></textarea></label>
          <label class="campo"><span>Nova situação da tarefa de ${fmtData(p.data_origem)}</span>
            <select name="novo_status">${['concluida', 'em_andamento', 'a_fazer', 'nao_realizada', 'nao_aplicavel'].map(s => html`<option value="${s}">${STATUS[s]}</option>`)}</select></label>
          <label class="campo"><span>Motivo / justificativa <em>(obrigatório para "Não realizada" e "Não aplicável")</em></span><input type="text" name="justificativa" maxlength="2000"></label>`,
        botoes: [{
          rotulo: 'Resolver',
          acao: async form => {
            const v = valores(form)
            await API.chamar('resolver_pendencia', { id: p.id, resolucao: v.resolucao, novo_status: v.novo_status, execucao_versao: p.execucao_versao,
              motivo: v.novo_status === 'nao_realizada' ? (v.justificativa || null) : null, justificativa: v.justificativa || null })
            return true
          },
        }],
      }).then(r => { if (r) { avisar('Pendência resolvida.'); Pendencias.carregar(); App.atualizarContador() } })
    },
    editar (p) {
      abrirModal({
        titulo: 'Acompanhamento da pendência', subtitulo: p.tarefa,
        corpo: html`<div class="form-grade">
            <label class="campo"><span>Responsável pela resolução</span><input type="text" name="responsavel_resolucao" list="lista-resp2" maxlength="120" value="${p.responsavel_resolucao || ''}">
              <datalist id="lista-resp2">${responsaveis.map(r => html`<option value="${r}">`)}</datalist></label>
            <label class="campo"><span>Prazo para resolução</span><input type="date" name="prazo_resolucao" value="${p.prazo_resolucao || ''}"></label>
          </div>
          <label class="campo"><span>Detalhe</span><textarea name="detalhe" maxlength="2000">${p.detalhe || ''}</textarea></label>`,
        botoes: [{ rotulo: 'Salvar', acao: async form => { const v = valores(form); await API.chamar('atualizar_pendencia', { id: p.id, ...v }); return true } }],
      }).then(r => { if (r) { avisar('Pendência atualizada.'); Pendencias.carregar() } })
    },
  }

  async function verHistoricoExecucao (id) {
    let d
    try { d = await API.chamar('execucao_detalhe', { id }) } catch (err) { return avisar(err.message, 'erro') }
    abrirModal({
      titulo: d.nome, subtitulo: `${d.codigo} · previsto para ${fmtData(d.data_prevista)} · ${STATUS[d.status]}`, largo: true,
      corpo: html`
        ${d.observacoes.length ? html`<div><strong class="small">Observações</strong><ul class="obs-lista">${d.observacoes.map(o => html`<li><time>${fmtDataHora(o.criado_em)}</time>${o.texto}</li>`)}</ul></div>` : ''}
        <div><strong class="small">Histórico completo</strong>${Tarefas.linhaTempo(d.historico)}</div>`,
    })
  }

  // ===========================================================================
  // Tela: Histórico (calendário)
  // ===========================================================================
  const Historico = {
    mes: null, dia: null,
    async abrir (raiz, parametro) {
      Historico.raiz = raiz
      const hoje = UI.dataDoTs(new Date())
      if (parametro && /^\d{4}-\d{2}-\d{2}$/.test(parametro)) Historico.dia = parametro
      Historico.dia = Historico.dia || UI.somarDias(hoje, -1)
      Historico.mes = Historico.dia.slice(0, 7)
      montar(raiz, html`
        <div class="pag-cab"><div><div class="rotulo">Consulta</div><h1>Histórico</h1></div></div>
        <div class="hist-layout">
          <section class="cartao" data-cal></section>
          <section data-diahist><div class="carregando">Carregando…</div></section>
        </div>`)
      await Promise.all([Historico.carregarMes(), Historico.carregarDia()])
    },
    async carregarMes () {
      const alvo = Historico.raiz.querySelector('[data-cal]')
      try { Historico.cal = await API.chamar('calendario_mes', { mes: Historico.mes }) } catch (err) { return montar(alvo, html`<p>${err.message}</p>`) }
      const c = Historico.cal
      const primeiro = new Date(Historico.mes + '-01T12:00:00Z').getUTCDay()
      const vazios = (primeiro + 6) % 7
      const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Historico.mes + '-01T12:00:00Z')).replace(/^./, c => c.toUpperCase())
      montar(alvo, html`
        <div class="pag-cab" style="margin-bottom:10px"><h3>${nomeMes}</h3>
          <div class="cal-nav"><button class="btn btn-pequeno" data-mes="-1" aria-label="Mês anterior">‹</button><button class="btn btn-pequeno" data-mes="1" aria-label="Próximo mês">›</button></div></div>
        <div class="cal">
          ${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(s => html`<div class="sem">${s}</div>`)}
          ${Array.from({ length: vazios }, () => html`<div></div>`)}
          ${c.dias.map(d => {
            const p = d.previstas
            return html`<button type="button" data-dia="${d.data}" class="${!d.dia_util ? 'fora' : ''} ${d.data === Historico.dia ? 'sel' : ''} ${d.data === c.hoje ? 'hoje' : ''}" title="${d.feriado || ''}"
              aria-label="${fmtData(d.data)}: ${d.concluidas} de ${p} concluídas">
              <span class="n">${Number(d.data.slice(8))}</span>
              ${p ? html`<span class="mini-barra"><span style="width:${100 * d.concluidas / p}%;background:${COR_STATUS.concluida}"></span><span style="width:${100 * d.pendentes / p}%;background:${COR_STATUS.pendente}"></span><span style="width:${100 * d.nao_realizadas / p}%;background:${COR_STATUS.nao_realizada}"></span></span>` : html`<span>${d.feriado ? 'Feriado' : ''}</span>`}
            </button>`
          })}
        </div>
        <div class="legenda"><span><i style="background:${COR_STATUS.concluida}"></i>Concluídas</span><span><i style="background:${COR_STATUS.pendente}"></i>Pendentes</span><span><i style="background:${COR_STATUS.nao_realizada}"></i>Não realizadas</span></div>`)
      alvo.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
        const [a, m] = Historico.mes.split('-').map(Number)
        const d = new Date(Date.UTC(a, m - 1 + Number(b.dataset.mes), 1))
        Historico.mes = d.toISOString().slice(0, 7); Historico.carregarMes()
      }))
      alvo.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
        Historico.dia = b.dataset.dia
        alvo.querySelectorAll('[data-dia]').forEach(x => x.classList.toggle('sel', x === b))
        Historico.carregarDia()
      }))
    },
    async carregarDia () {
      const alvo = Historico.raiz.querySelector('[data-diahist]')
      montar(alvo, html`<div class="carregando">Carregando ${fmtData(Historico.dia)}…</div>`)
      let d
      try { d = await API.chamar('historico_dia', { data: Historico.dia }) } catch (err) { return montar(alvo, html`<div class="vazio">${err.message}</div>`) }
      Historico.dados = d
      d.execucoes.forEach(e => Tarefas.detalhes.set(e.id, e))
      const previstas = d.execucoes.filter(e => e.prevista_no_dia), periodo = d.execucoes.filter(e => !e.prevista_no_dia)
      const r = d.resumo
      montar(alvo, html`
        <div class="cartao" style="margin-bottom:12px">
          <h3>${fmtDataLonga(d.data)}</h3>
          ${d.feriado ? html`<p class="muted small">Feriado: ${d.feriado}</p>` : ''}
          <p class="small" style="margin-top:6px">Previstas no dia: <strong>${r.previstas}</strong> · Concluídas: <strong>${r.concluidas}</strong>
            (${r.concluidas_no_prazo} no prazo, ${r.concluidas_com_atraso} com atraso) · Pendentes: <strong>${r.pendentes}</strong> · Não realizadas: <strong>${r.nao_realizadas}</strong>
            ${r.dispensadas ? html` · Dispensadas: <strong>${r.dispensadas}</strong>` : ''} · Execução: <strong>${pct(r.taxa_conclusao)}</strong></p>
        </div>
        <div data-lista data-mostrar-data>
          ${previstas.length ? html`<div class="lista">${previstas.map(e => Tarefas.linha(e))}</div>` : html`<div class="vazio">Nenhuma tarefa com prazo neste dia.</div>`}
          ${periodo.length ? html`<h3 style="margin:18px 0 8px">Em andamento no período (semanais/mensais)</h3><div class="lista">${periodo.map(e => Tarefas.linha(e))}</div>` : ''}
        </div>
        <p class="muted small" style="margin-top:12px">Alterações feitas depois do período aparecem destacadas no histórico de cada tarefa.</p>`)
      Tarefas.ligar(alvo.querySelector('[data-lista]'), {
        obter: id => Historico.dados.execucoes.find(e => e.id === id),
        trocar: nova => {
          const i = Historico.dados.execucoes.findIndex(e => e.id === nova.id)
          if (i >= 0) Historico.dados.execucoes[i] = { ...Historico.dados.execucoes[i], ...nova }
          Historico.carregarDia(); Historico.carregarMes()
        },
        recarregar: () => Historico.carregarDia(),
      })
    },
  }

  window.Telas = Object.assign(window.Telas || {}, { Tarefas, Hoje, Pendencias, Historico, CATEGORIAS, carregarListas })
})()
