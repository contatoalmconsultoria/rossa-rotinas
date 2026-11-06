// Tela "Meu dia" (assistente): uma atividade por vez, recado do dia e dúvidas.
// Tela "Dúvidas e recado" (gestão): responder dúvidas e escrever o recado do dia.
(function () {
  const { html, montar, avisar, abrirModal, valores, fmtDataCurta, fmtDataLonga, fmtHora, fmtDataHora, dataDoTs } = UI

  // ---------- regras da fila ----------
  const FINAL = ['concluida', 'nao_realizada', 'nao_aplicavel']
  // "pendente" (pulada com justificativa) libera a fila no dia em que foi pulada e volta no dia seguinte
  const resolvidaHoje = (e, hoje) => FINAL.includes(e.status) || (e.status === 'pendente' && dataDoTs(e.atualizado_em) === hoje)
  const naFila = (e, limite) => e.frequencia === 'diaria' || e.data_prevista <= limite
  const ORDEM_CAT = { diaria: 0, semanal: 1, mensal: 2, periodica: 3 }
  const rotuloFreq = { diaria: 'Rotina diária', semanal: 'Rotina semanal', mensal: 'Rotina mensal', periodica: 'Rotina periódica', sob_demanda: 'Sob demanda' }
  const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }

  function montarFila (d) {
    const idx = new Map(d.execucoes.map((e, i) => [e.id, i]))
    const ordenar = (a, b) => (ORDEM_CAT[a.categoria] ?? 9) - (ORDEM_CAT[b.categoria] ?? 9) ||
      (a.categoria === 'diaria' ? 0 : (a.data_prevista || '').localeCompare(b.data_prevista || '')) || idx.get(a.id) - idx.get(b.id)
    const fila = d.execucoes.filter(e => naFila(e, d.limite_fila)).sort(ordenar)
    const adiantar = d.execucoes.filter(e => !naFila(e, d.limite_fila)).sort(ordenar)
    return { fila, adiantar }
  }

  const MeuDia = {
    async abrir (raiz) {
      MeuDia.raiz = raiz
      montar(raiz, html`<div class="carregando">Separando as suas atividades…</div>`)
      await MeuDia.carregar()
    },

    async carregar () {
      const raiz = MeuDia.raiz
      try { MeuDia.d = await API.chamar('fila') } catch (err) {
        if (raiz.isConnected) montar(raiz, html`<div class="vazio">${err.message}</div>`)
        return
      }
      if (raiz.isConnected) MeuDia.desenhar()
    },

    desenhar () {
      const d = MeuDia.d, raiz = MeuDia.raiz, hoje = d.hoje
      const { fila, adiantar } = montarFila(d)
      const feitas = fila.filter(e => resolvidaHoje(e, hoje)).length
      const total = fila.length
      const atualIdx = fila.findIndex(e => !resolvidaHoje(e, hoje))
      const atual = atualIdx >= 0 ? fila[atualIdx] : null
      const nome = API.usuario?.nome || ''
      const gestao = d.gestao_nome || 'gestão'
      const atrasadas = fila.filter(e => !resolvidaHoje(e, hoje) && e.atrasada && e.frequencia !== 'diaria').length
      const respostas = (d.duvidas || []).filter(x => x.resposta && !x.lida && API.usuario?.perfil !== 'gestao')

      let fala
      if (!d.dia_util && total === 0) fala = html`Hoje é ${fmtDataLonga(hoje).toLowerCase()}${d.feriado ? ` (${d.feriado})` : ''} e não é dia útil, então não há rotinas. Bom descanso!`
      else if (total === 0) fala = html`Hoje não há atividades programadas para você. Se surgir alguma demanda, registre em “Fiz uma tarefa sob demanda”.`
      else if (!atual) fala = html`Você já passou por todas as <b>${total}</b> atividades de hoje. Obrigada pelo capricho!`
      else if (feitas === 0) fala = html`Hoje separei <b>${total} ${total === 1 ? 'atividade' : 'atividades'}</b> para você. Vamos fazer uma de cada vez, na ordem, combinado? Quando terminar uma, é só me avisar que eu libero a próxima.`
      else fala = html`Você já fez <b>${feitas} de ${total}</b> atividades hoje. Bora seguir? ${total - feitas === 1 ? 'Falta 1.' : `Faltam ${total - feitas}.`}`

      montar(raiz, html`
        <div class="meudia">
          <section class="conversa">
            <div class="fala"><div class="avatar">R</div><div class="balao">
              <div class="rotulo-dia">${fmtDataLonga(hoje)}</div>
              <h1>${saudacao()}${nome ? `, ${nome}` : ''}!</h1>
              <p>${fala}</p>
              ${atrasadas ? html`<p class="alerta-txt">Atenção: ${atrasadas} ${atrasadas > 1 ? 'rotinas estão' : 'rotina está'} com prazo vencido.</p>` : ''}
            </div></div>
            ${d.recado ? html`<div class="fala"><div class="avatar adm">${gestao[0]}</div><div class="balao recado">
              <div class="quem">Recado da ${gestao}</div><p class="pre">${d.recado.texto}</p></div></div>` : ''}
            ${respostas.map(x => html`<div class="fala"><div class="avatar adm">${gestao[0]}</div><div class="balao resposta">
              <div class="quem">${x.respondida_por || gestao} respondeu sua dúvida</div>
              <p class="muted small">Você perguntou${x.tarefa ? ` sobre “${x.tarefa}”` : ''}: ${x.texto}</p>
              <p class="pre"><b>${x.resposta}</b></p>
              <button class="btn btn-pequeno" data-lida="${x.id}">Entendi</button></div></div>`)}
          </section>

          ${total ? html`<div class="progresso-md"><div class="barra"><i style="width:${Math.round(feitas / total * 100)}%"></i></div><b>${feitas}/${total} feitas</b></div>` : ''}

          ${atual ? html`
            <section class="atual">
              <span class="etq ${atual.atrasada && atual.frequencia !== 'diaria' ? 'urg' : ''}">${rotuloFreq[atual.frequencia] || 'Rotina'} ${atual.codigo}${atual.atrasada && atual.frequencia !== 'diaria' ? ' · ATRASADA' : ''}${atual.status === 'pendente' ? ' · voltou da véspera' : ''} · ${atualIdx + 1} de ${total}</span>
              <h2>${atual.nome}</h2>
              <div class="meta">${MeuDia.meta(atual)}</div>
              ${atual.descricao ? html`<div class="passos">${atual.descricao}</div>` : ''}
              ${atual.status === 'pendente' && atual.justificativa ? html`<p class="muted small">Ontem: ${atual.motivo}${atual.justificativa ? ' — ' + atual.justificativa : ''}</p>` : ''}
              <div class="acoes">
                <button class="btn btn-ok" data-concluir="${atual.id}">✓ Já fiz esta atividade</button>
                <button class="btn" data-duvida="${atual.id}">Tenho uma dúvida</button>
                <button class="btn btn-alerta" data-pular="${atual.id}">Pular (com justificativa)</button>
              </div>
            </section>` : total ? html`
            <section class="festa"><div class="em">🎉</div><h2>Dia concluído!</h2>
              <p>Você passou por todas as atividades de hoje${fila.some(e => e.status !== 'concluida') ? ' (algumas com justificativa)' : ''}. Ótimo trabalho!</p></section>` : ''}

          ${total ? html`<section class="lista-md"><h3>Seu dia</h3>
            ${fila.map((e, i) => {
              const ok = resolvidaHoje(e, hoje)
              const ic = e.status === 'concluida' ? html`<div class="ic feita">✓</div>`
                : ok ? html`<div class="ic pulada">↷</div>`
                  : i === atualIdx ? html`<div class="ic agora">${i + 1}</div>` : html`<div class="ic bloq">🔒</div>`
              const sub = e.status === 'concluida' ? `Feita às ${fmtHora(e.concluida_em)}`
                : ok ? `Pulada${e.motivo ? ': ' + e.motivo : ''}`
                  : i === atualIdx ? 'Fazendo agora' : 'Libera depois da anterior'
              return html`<div class="item ${!ok && i !== atualIdx ? 'bloq' : ''}">${ic}<div class="tx">
                <b><span class="cod">${e.codigo}</span> ${e.nome}</b>
                <span>${rotuloFreq[e.frequencia] || ''}${e.frequencia !== 'diaria' ? ' · prazo ' + fmtDataCurta(e.data_prevista) : ''}${!ok && e.atrasada && e.frequencia !== 'diaria' ? html` · <b class="verm">atrasada</b>` : ''} · ${sub}</span>
                ${ok && e.status !== 'concluida' && e.justificativa ? html`<span class="just">${e.justificativa}</span>` : ''}</div></div>`
            })}</section>` : ''}

          ${adiantar.length ? html`<section class="lista-md"><h3>Do mês, para adiantar <span class="muted small">(não travam a fila; entram nela 2 dias úteis antes do prazo)</span></h3>
            ${adiantar.map(e => html`<div class="item">${e.status === 'concluida' ? html`<div class="ic feita">✓</div>` : html`<div class="ic cal">📅</div>`}
              <div class="tx"><b><span class="cod">${e.codigo}</span> ${e.nome}</b><span>Prazo ${fmtDataCurta(e.data_prevista)} às ${fmtHora(e.prazo)}${e.status === 'concluida' ? ' · feita às ' + fmtHora(e.concluida_em) : ''}</span></div>
              ${e.status === 'concluida' ? '' : html`<button class="btn btn-pequeno" data-concluir="${e.id}">Ver / concluir</button>`}</div>`)}</section>` : ''}

          <div class="linha-acoes">
            ${(d.sob_demanda || []).length ? html`<button class="btn" data-sob-demanda>➕ Fiz uma tarefa sob demanda</button>` : ''}
            <button class="btn" data-duvida="">✉️ Mandar uma dúvida para a ${gestao}</button>
            ${(d.duvidas || []).length && API.usuario?.perfil !== 'gestao' ? html`<button class="btn" data-minhas>Minhas dúvidas (${d.duvidas.length})</button>` : ''}
          </div>
        </div>`)

      const achar = id => d.execucoes.find(e => e.id === Number(id))
      raiz.querySelectorAll('[data-concluir]').forEach(b => b.addEventListener('click', () => MeuDia.concluir(achar(b.dataset.concluir))))
      raiz.querySelectorAll('[data-pular]').forEach(b => b.addEventListener('click', () => MeuDia.pular(achar(b.dataset.pular))))
      raiz.querySelectorAll('[data-duvida]').forEach(b => b.addEventListener('click', () => MeuDia.duvida(b.dataset.duvida ? achar(b.dataset.duvida) : null)))
      raiz.querySelectorAll('[data-lida]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true
        try { d.duvidas = await API.chamar('marcar_duvida_lida', { id: Number(b.dataset.lida) }); MeuDia.desenhar() } catch (err) { avisar(err.message, 'erro'); b.disabled = false }
      }))
      raiz.querySelector('[data-sob-demanda]')?.addEventListener('click', () => MeuDia.sobDemanda())
      raiz.querySelector('[data-minhas]')?.addEventListener('click', () => MeuDia.minhas())
    },

    meta (e) {
      const partes = []
      partes.push(e.frequencia === 'diaria' ? `Até ${fmtHora(e.prazo)}` : `Prazo ${fmtDataCurta(e.data_prevista)} às ${fmtHora(e.prazo)}`)
      if (e.area) partes.push(e.area)
      if (e.pop?.url) partes.push(html`<a href="${e.pop.url}" target="_blank" rel="noopener noreferrer">Ver procedimento (${e.pop.codigo})</a>`)
      else if (e.pop?.codigo) partes.push(`POP ${e.pop.codigo}`)
      return html`${partes.map((p, i) => html`${i ? ' · ' : ''}${p}`)}`
    },

    concluir (e) {
      abrirModal({
        titulo: e.status === 'a_fazer' || e.status === 'em_andamento' || e.status === 'pendente' ? 'Boa! ✓' : e.nome,
        subtitulo: `Marcar “${e.codigo} — ${e.nome}” como feita.`,
        corpo: html`${e.descricao ? html`<div class="passos">${e.descricao}</div>` : ''}
          <label class="campo"><span>Observação <em>(opcional)</em></span><textarea name="obs" maxlength="4000" placeholder="Ex.: NF 1234 lançada; faltou o boleto do fornecedor X"></textarea></label>`,
        botoes: [{ rotulo: 'Concluir e seguir', acao: async form => {
          const v = valores(form)
          await API.chamar('alterar_status', { id: e.id, status: 'concluida', versao: e.versao, resolucao: e.status === 'pendente' ? 'Concluída pela assistente' : null })
          if (v.obs) { try { await API.chamar('adicionar_observacao', { id: e.id, texto: v.obs }) } catch (err) { avisar('Concluída, mas a observação não foi salva: ' + err.message, 'erro') } }
          return true
        } }],
      }).then(r => { if (r) { avisar('Feito! Próxima liberada.'); MeuDia.carregar() } })
    },

    pular (e) {
      const motivos = MeuDia.d.motivos || ['Outro motivo']
      const volta = e.frequencia !== 'diaria'
      abrirModal({
        titulo: 'Pular esta atividade?',
        subtitulo: `Para seguir sem fazer “${e.nome}”, conte o motivo. A ${MeuDia.d.gestao_nome || 'gestão'} vai ver a sua justificativa.${volta ? ' Ela volta para a sua fila amanhã.' : ''}`,
        corpo: html`<label class="campo"><span>Motivo</span><select name="motivo" required><option value="">Selecione…</option>${motivos.map(m => html`<option>${m}</option>`)}</select></label>
          <label class="campo"><span>Explique em poucas palavras</span><textarea name="justificativa" required minlength="5" maxlength="2000" placeholder="Ex.: o fornecedor ainda não mandou o XML da nota"></textarea></label>`,
        botoes: [{ rotulo: 'Pular com justificativa', tipo: 'perigo', acao: async form => {
          const v = valores(form)
          if (v.justificativa.length < 5) throw new Error('Escreva a justificativa.')
          await API.chamar('alterar_status', { id: e.id, status: volta ? 'pendente' : 'nao_realizada', versao: e.versao, motivo: v.motivo, justificativa: v.justificativa })
          return true
        } }],
      }).then(r => { if (r) { avisar('Registrado. Seguimos para a próxima.'); MeuDia.carregar() } })
    },

    duvida (e) {
      const gestao = MeuDia.d.gestao_nome || 'gestão'
      abrirModal({
        titulo: 'Qual é a sua dúvida?',
        subtitulo: `${e ? `Sobre “${e.codigo} — ${e.nome}”. ` : ''}A pergunta vai para a ${gestao}, e a resposta aparece aqui no painel.`,
        corpo: html`<label class="campo"><span>Sua dúvida</span><textarea name="texto" required maxlength="2000" rows="4"></textarea></label>`,
        botoes: [{ rotulo: `Enviar para a ${gestao}`, acao: async form => {
          const v = valores(form)
          if (!v.texto) throw new Error('Escreva a sua dúvida.')
          MeuDia.d.duvidas = await API.chamar('enviar_duvida', { texto: v.texto, execucao_id: e?.id ?? null })
          return true
        } }],
      }).then(r => { if (r) { avisar('Dúvida enviada.'); MeuDia.desenhar() } })
    },

    sobDemanda () {
      const lista = MeuDia.d.sob_demanda
      abrirModal({
        titulo: 'Tarefa sob demanda', subtitulo: 'Registre quando fizer uma tarefa que foi pedida para você.',
        corpo: html`<label class="campo"><span>Qual tarefa?</span><select name="tarefa" required><option value="">Selecione…</option>${lista.map(t => html`<option value="${t.id}">${t.codigo} — ${t.nome}</option>`)}</select></label>
          <label class="campo"><span>Observação <em>(opcional)</em></span><textarea name="obs" maxlength="4000" placeholder="Ex.: NF 1234 para o cliente X"></textarea></label>`,
        botoes: [{ rotulo: 'Registrar', acao: async form => {
          const v = valores(form)
          const nova = await API.chamar('registrar_demanda', { tarefa_id: Number(v.tarefa), observacao: v.obs || null })
          try { await API.chamar('alterar_status', { id: nova.id, status: 'concluida', versao: nova.versao }) } catch (err) { avisar('Registrada, mas a conclusão não foi salva: ' + err.message, 'erro') }
          return true
        } }],
      }).then(r => { if (r) { avisar('Tarefa registrada.'); MeuDia.carregar() } })
    },

    minhas () {
      const lista = MeuDia.d.duvidas || []
      abrirModal({
        titulo: 'Minhas dúvidas', subtitulo: 'As sem resposta aparecem primeiro.', largo: true,
        corpo: html`<div class="duvidas-lista">${lista.map(x => html`<div class="duvida ${x.resposta ? '' : 'aberta'}">
          <div class="muted small">${fmtDataHora(x.criada_em)}${x.tarefa ? ' · ' + x.tarefa : ''}</div>
          <p>${x.texto}</p>
          ${x.resposta ? html`<p class="resp"><b>${x.respondida_por || 'Gestão'}:</b> ${x.resposta}</p>` : html`<p class="muted small">Aguardando resposta</p>`}</div>`)}</div>`,
      })
    },
  }

  // ===========================================================================
  // Gestão: dúvidas e recado do dia
  // ===========================================================================
  const Duvidas = {
    async abrir (raiz) {
      Duvidas.raiz = raiz
      montar(raiz, html`<div class="carregando">Carregando…</div>`)
      try { Duvidas.d = await API.chamar('fila') } catch (err) { return montar(raiz, html`<div class="vazio">${err.message}</div>`) }
      if (raiz.isConnected) Duvidas.desenhar()
    },
    desenhar () {
      const d = Duvidas.d, raiz = Duvidas.raiz
      const abertas = d.duvidas.filter(x => !x.resposta)
      const respondidas = d.duvidas.filter(x => x.resposta)
      montar(raiz, html`
        <div class="pag-cab"><div><div class="rotulo">Gestão</div><h1>Dúvidas e recado</h1></div></div>
        <section class="cartao"><h3>Recado do dia para a assistente</h3>
          <p class="muted small" style="margin-bottom:8px">Aparece no topo do “Meu dia” só hoje (${fmtDataCurta(d.hoje)}). Deixe em branco e salve para apagar.</p>
          <form data-recado><textarea name="texto" maxlength="2000" rows="3" placeholder="Ex.: Hoje priorize as notas fiscais; o contador vem às 15h.">${d.recado?.texto || ''}</textarea>
            <div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button class="btn btn-primario btn-pequeno" type="submit">Salvar recado</button>
            ${d.recado ? html`<span class="muted small">Salvo às ${fmtHora(d.recado.atualizado_em)}</span>` : ''}</div></form>
        </section>
        <section class="cartao"><h3>Aguardando resposta (${abertas.length})</h3>
          ${abertas.length ? abertas.map(x => Duvidas.linha(x)) : html`<p class="muted">Nenhuma dúvida aberta.</p>`}
        </section>
        <section class="cartao"><h3>Respondidas (últimos 60 dias)</h3>
          ${respondidas.length ? respondidas.map(x => Duvidas.linha(x)) : html`<p class="muted">Nenhuma ainda.</p>`}
        </section>`)
      raiz.querySelector('[data-recado]').addEventListener('submit', async ev => {
        ev.preventDefault()
        const btn = ev.target.querySelector('button'); btn.disabled = true
        try {
          await API.chamar('salvar_recado', { texto: ev.target.texto.value.trim() || null })
          avisar(ev.target.texto.value.trim() ? 'Recado salvo.' : 'Recado apagado.')
          Duvidas.abrir(raiz)
        } catch (err) { avisar(err.message, 'erro'); btn.disabled = false }
      })
      raiz.querySelectorAll('[data-responder]').forEach(b => b.addEventListener('click', () => Duvidas.responder(d.duvidas.find(x => x.id === Number(b.dataset.responder)))))
    },
    linha (x) {
      return html`<div class="duvida ${x.resposta ? '' : 'aberta'}">
        <div class="muted small">${x.autor} · ${fmtDataHora(x.criada_em)}${x.tarefa ? ' · ' + x.tarefa : ''}</div>
        <p>${x.texto}</p>
        ${x.resposta ? html`<p class="resp"><b>Resposta:</b> ${x.resposta} <span class="muted small">${x.lida ? '· lida' : '· ainda não lida'}</span></p>` : ''}
        <button class="btn btn-pequeno ${x.resposta ? '' : 'btn-primario'}" data-responder="${x.id}">${x.resposta ? 'Editar resposta' : 'Responder'}</button></div>`
    },
    responder (x) {
      abrirModal({
        titulo: 'Responder dúvida', subtitulo: `${x.tarefa ? `Sobre “${x.tarefa}”: ` : ''}${x.texto}`,
        corpo: html`<label class="campo"><span>Resposta</span><textarea name="resposta" required maxlength="4000" rows="5">${x.resposta || ''}</textarea></label>`,
        botoes: [{ rotulo: 'Enviar resposta', acao: async form => {
          Duvidas.d.duvidas = await API.chamar('responder_duvida', { id: x.id, resposta: valores(form).resposta }); return true
        } }],
      }).then(r => { if (r) { avisar('Resposta enviada.'); Duvidas.desenhar(); App.atualizarContador() } })
    },
  }

  window.Telas = Object.assign(window.Telas || {}, { MeuDia, Duvidas })
})()
