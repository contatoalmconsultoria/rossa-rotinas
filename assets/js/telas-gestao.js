// Telas gerenciais: Indicadores e Administração.
(function () {
  const { html, montar, STATUS, FREQ, PRIO, DIAS, COR_STATUS, fmtData, fmtDataCurta, fmtDataHora, pct, avisar, abrirModal, confirmar, valores, icone, graficoLinhas, graficoBarras, somarDias, dataDoTs } = UI

  // ===========================================================================
  // Indicadores
  // ===========================================================================
  const Indicadores = {
    f: null,
    async abrir (raiz) {
      Indicadores.raiz = raiz
      const hoje = dataDoTs(new Date())
      Indicadores.f = Indicadores.f || { inicio: somarDias(hoje, -29), fim: hoje, frequencia: '', categoria: '', tarefa_id: '' }
      if (!Indicadores.cad) { try { Indicadores.cad = await API.chamar('cadastros') } catch { Indicadores.cad = { tarefas: [] } } }
      montar(raiz, html`
        <div class="pag-cab"><div><div class="rotulo">Visão gerencial</div><h1>Indicadores</h1></div>
          <div class="pag-acoes">
            <button class="btn" data-exp="execucoes">${icone('baixar')} Execuções (CSV)</button>
            <button class="btn" data-exp="historico">${icone('baixar')} Alterações (CSV)</button>
            <button class="btn" data-exp="pendencias">${icone('baixar')} Pendências (CSV)</button>
            <button class="btn" data-exp="indicadores">${icone('baixar')} Indicadores por tarefa (CSV)</button>
          </div></div>
        <form class="filtros" data-filtros>
          <div class="chips">${[['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['mes', 'Este mês'], ['mesant', 'Mês anterior']].map(([v, t]) => html`<button type="button" class="chip" data-preset="${v}">${t}</button>`)}</div>
          <label class="campo"><span>De</span><input type="date" name="inicio" value="${Indicadores.f.inicio}" required></label>
          <label class="campo"><span>Até</span><input type="date" name="fim" value="${Indicadores.f.fim}" required></label>
          <label class="campo"><span>Frequência</span><select name="frequencia"><option value="">Todas</option>${Object.entries(FREQ).map(([k, v]) => html`<option value="${k}" ${Indicadores.f.frequencia === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="campo"><span>Categoria</span><select name="categoria"><option value="">Todas</option>${Object.entries(Telas.CATEGORIAS).map(([k, v]) => html`<option value="${k}" ${Indicadores.f.categoria === k ? 'selected' : ''}>${v}</option>`)}</select></label>
          <label class="campo"><span>Tarefa</span><select name="tarefa_id"><option value="">Todas</option>${Indicadores.cad.tarefas.map(t => html`<option value="${t.id}" ${String(Indicadores.f.tarefa_id) === String(t.id) ? 'selected' : ''}>${t.codigo} — ${t.nome}</option>`)}</select></label>
          <button class="btn btn-primario" type="submit" style="align-self:flex-end">Aplicar</button>
        </form>
        <div data-ind><div class="carregando">Calculando indicadores…</div></div>`)
      const form = raiz.querySelector('[data-filtros]')
      form.addEventListener('submit', ev => { ev.preventDefault(); Object.assign(Indicadores.f, valores(form)); Indicadores.carregar() })
      raiz.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
        const h = dataDoTs(new Date()), p = b.dataset.preset
        let ini = somarDias(h, -(Number(p) - 1)), fim = h
        if (p === 'mes') ini = h.slice(0, 8) + '01'
        if (p === 'mesant') { fim = somarDias(h.slice(0, 8) + '01', -1); ini = fim.slice(0, 8) + '01' }
        form.inicio.value = ini; form.fim.value = fim
        Object.assign(Indicadores.f, valores(form)); Indicadores.carregar()
      }))
      raiz.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true
        try { await API.baixar({ ...Indicadores.f, tipo: b.dataset.exp }, `rossa-rotinas-${b.dataset.exp}-${Indicadores.f.inicio}-a-${Indicadores.f.fim}.csv`) } catch (err) { avisar(err.message, 'erro') }
        b.disabled = false
      }))
      await Indicadores.carregar()
    },

    async carregar () {
      const alvo = Indicadores.raiz.querySelector('[data-ind]')
      let d
      try { d = await API.chamar('indicadores', Indicadores.f) } catch (err) { return montar(alvo, html`<div class="vazio">${err.message}</div>`) }
      const r = d.resumo, a = d.anterior.resumo
      const delta = (k, invertido) => {
        if (r[k] == null || a[k] == null) return html`<div class="d igual">sem base anterior</div>`
        const dif = Math.round((r[k] - a[k]) * 10) / 10
        const cls = dif === 0 ? 'igual' : (dif > 0) !== !!invertido ? 'sobe' : 'desce'
        return html`<div class="d ${cls}">${dif > 0 ? '▲' : dif < 0 ? '▼' : '='} ${String(Math.abs(dif)).replace('.', ',')} p.p. vs. período anterior</div>`
      }
      const deltaN = (k, invertido, neutro) => {
        const dif = r[k] - a[k]
        const cls = dif === 0 || neutro ? 'igual' : (dif > 0) !== !!invertido ? 'sobe' : 'desce'
        return html`<div class="d ${cls}">${dif > 0 ? '+' : ''}${dif} vs. anterior (${a[k]})</div>`
      }
      const partes = x => [
        { nome: 'Concluídas no prazo', valor: x.concluidas_no_prazo, cor: COR_STATUS.concluida },
        { nome: 'Concluídas com atraso', valor: x.concluidas_com_atraso, cor: '#7FB89A' },
        { nome: 'Pendentes', valor: x.pendentes, cor: COR_STATUS.pendente },
        { nome: 'Não realizadas', valor: x.nao_realizadas, cor: COR_STATUS.nao_realizada },
        { nome: 'Em aberto', valor: x.a_fazer + x.em_andamento, cor: 'var(--border-strong)' },
      ]
      const maxNR = Math.max(1, ...d.mais_nao_realizadas.map(x => x.nao_realizadas))
      const maxIm = Math.max(1, ...d.mais_impedimentos.map(x => x.pendencias))
      const fx = d.pendencias_por_atraso
      montar(alvo, html`
        <div class="kpis">
          <div class="kpi destaque"><div class="v">${pct(r.taxa_conclusao)}</div><div class="l">Taxa de conclusão</div></div>
          <div class="kpi" style="--kpi-cor: var(--st-concluida)"><div class="v">${pct(r.taxa_no_prazo)}</div><div class="l">Concluídas dentro do prazo</div>${delta('taxa_no_prazo')}</div>
          <div class="kpi" style="--kpi-cor: var(--color-primary)"><div class="v">${r.previstas}</div><div class="l">Previstas no período</div>${deltaN('previstas', false, true)}</div>
          <div class="kpi" style="--kpi-cor: #7FB89A"><div class="v">${r.concluidas_com_atraso}</div><div class="l">Concluídas com atraso</div>${deltaN('concluidas_com_atraso', true)}</div>
          <div class="kpi" style="--kpi-cor: var(--st-nao_realizada)"><div class="v">${r.nao_realizadas}</div><div class="l">Não realizadas</div>${deltaN('nao_realizadas', true)}</div>
          <div class="kpi" style="--kpi-cor: var(--st-nao_aplicavel)"><div class="v">${r.dispensadas}</div><div class="l">Dispensadas (não contam)</div></div>
        </div>
        <p class="muted small" style="margin:-4px 0 14px">Período ${fmtData(d.inicio)} a ${fmtData(d.fim)} comparado a ${fmtData(d.anterior.inicio)} a ${fmtData(d.anterior.fim)} (taxa de conclusão anterior: ${pct(a.taxa_conclusao)}${r.taxa_conclusao != null && a.taxa_conclusao != null ? html`; variação ${String(Math.round((r.taxa_conclusao - a.taxa_conclusao) * 10) / 10).replace('.', ',')} p.p.` : ''}).
          Taxa de conclusão = concluídas ÷ previstas; dispensadas não entram no cálculo e não contam como concluídas.</p>

        <section class="cartao"><h3>Evolução da execução por dia</h3>
          ${d.por_dia.length ? graficoLinhas(d.por_dia.map(x => fmtDataCurta(x.data)), [
            { nome: 'Taxa de conclusão', cor: 'var(--color-primary)', valores: d.por_dia.map(x => x.taxa_conclusao) },
            { nome: 'Dentro do prazo', cor: 'var(--color-accent)', valores: d.por_dia.map(x => x.taxa_no_prazo) },
          ]) : html`<p class="muted">Sem dados no período.</p>`}
          <div class="legenda"><span><i style="background:var(--color-primary)"></i>Taxa de conclusão</span><span><i style="background:var(--color-accent)"></i>Concluídas dentro do prazo</span></div>
        </section>

        <div class="grade-2" style="margin-top:14px">
          <section class="cartao"><h3>Execução semanal</h3>
            ${graficoBarras(d.por_semana.map(x => ({ rotulo: fmtDataCurta(x.semana), partes: partes(x) })), { altura: 200 })}
            ${tabelaPeriodo(d.por_semana, 'semana', x => 'Sem. ' + fmtDataCurta(x.semana))}
          </section>
          <section class="cartao"><h3>Execução mensal</h3>
            ${graficoBarras(d.por_mes.map(x => ({ rotulo: x.mes.slice(5) + '/' + x.mes.slice(2, 4), partes: partes(x) })), { altura: 200 })}
            ${tabelaPeriodo(d.por_mes, 'mes', x => x.mes.slice(5) + '/' + x.mes.slice(0, 4))}
          </section>
        </div>
        <div class="legenda" style="margin:8px 0 14px">${partes(r).map(p => html`<span><i style="background:${p.cor}"></i>${p.nome}</span>`)}</div>

        <div class="grade-2">
          <section class="cartao"><h3>Tarefas mais frequentemente não realizadas</h3>
            ${d.mais_nao_realizadas.length ? html`<div class="ranking">${d.mais_nao_realizadas.map(x => html`
              <div class="ranking-item"><span>${x.codigo} — ${x.nome}<br><span class="muted small">${x.nao_realizadas} de ${x.previstas} (${pct(x.percentual)})</span></span>
                <span class="b"><span style="width:${100 * x.nao_realizadas / maxNR}%"></span></span><span class="q">${x.nao_realizadas}</span></div>`)}</div>` : html`<p class="muted">Nenhuma tarefa não realizada no período.</p>`}
          </section>
          <section class="cartao"><h3>Tarefas que mais apresentam impedimentos</h3>
            ${d.mais_impedimentos.length ? html`<div class="ranking">${d.mais_impedimentos.map(x => html`
              <div class="ranking-item" style="--rk: var(--st-pendente)"><span>${x.codigo} — ${x.nome}${x.abertas ? html`<br><span class="muted small">${x.abertas} ainda aberta(s)</span>` : ''}</span>
                <span class="b"><span style="width:${100 * x.pendencias / maxIm}%"></span></span><span class="q">${x.pendencias}</span></div>`)}</div>` : html`<p class="muted">Nenhuma pendência registrada no período.</p>`}
          </section>
        </div>

        <div class="grade-2" style="margin-top:14px">
          <section class="cartao"><h3>Pendências abertas por tempo de atraso</h3>
            <div class="faixas">
              <div><b>${fx.ate_2_dias}</b><span>até 2 dias</span></div><div><b>${fx.de_3_a_7}</b><span>3 a 7 dias</span></div>
              <div><b>${fx.de_8_a_15}</b><span>8 a 15 dias</span></div><div style="background:var(--danger-soft)"><b>${fx.acima_de_15}</b><span>mais de 15 dias</span></div>
            </div>
            <p class="small" style="margin-top:10px"><a href="#/pendencias">Ver as ${fx.total} pendência(s) aberta(s)</a></p>
          </section>
          <section class="cartao"><h3>Motivos registrados</h3>
            ${d.motivos.length ? html`<div class="tabela-wrap"><table><tbody>${d.motivos.map(m => html`<tr><td>${m.motivo}</td><td class="num">${m.quantidade}</td></tr>`)}</tbody></table></div>` : html`<p class="muted">Sem motivos no período.</p>`}
          </section>
        </div>

        <section class="cartao" style="margin-top:14px"><h3>Por categoria</h3>${tabelaResumo(d.por_categoria, x => x.nome)}</section>
        <section class="cartao"><h3>Por tarefa</h3>${tabelaResumo(d.por_tarefa, x => x.codigo + ' — ' + x.nome)}</section>`)
    },
  }

  function tabelaPeriodo (lista, chave, rotulo) {
    return html`<div class="tabela-wrap"><table><thead><tr><th>Período</th><th class="num">Previstas</th><th class="num">Conclusão</th><th class="num">No prazo</th></tr></thead>
      <tbody>${lista.map(x => html`<tr><td>${rotulo(x)}</td><td class="num">${x.previstas}</td><td class="num">${pct(x.taxa_conclusao)}</td><td class="num">${pct(x.taxa_no_prazo)}</td></tr>`)}</tbody></table></div>`
  }
  function tabelaResumo (lista, rotulo) {
    if (!lista.length) return html`<p class="muted">Sem dados no período.</p>`
    return html`<div class="tabela-wrap"><table><thead><tr><th></th><th class="num">Previstas</th><th class="num">Concluídas</th><th class="num">No prazo</th><th class="num">Com atraso</th><th class="num">Pendentes</th><th class="num">Não realizadas</th><th class="num">Dispensadas</th><th class="num">Conclusão</th><th class="num">No prazo %</th></tr></thead>
      <tbody>${lista.map(x => html`<tr><td>${rotulo(x)}</td><td class="num">${x.previstas}</td><td class="num">${x.concluidas}</td><td class="num">${x.concluidas_no_prazo}</td><td class="num">${x.concluidas_com_atraso}</td>
        <td class="num">${x.pendentes}</td><td class="num">${x.nao_realizadas}</td><td class="num">${x.dispensadas}</td><td class="num"><strong>${pct(x.taxa_conclusao)}</strong></td><td class="num">${pct(x.taxa_no_prazo)}</td></tr>`)}</tbody></table></div>`
  }

  // ===========================================================================
  // Administração (perfil Gestão)
  // ===========================================================================
  const Admin = {
    aba: 'tarefas',
    async abrir (raiz) {
      Admin.raiz = raiz
      montar(raiz, html`<div class="carregando">Carregando cadastros…</div>`)
      await Admin.carregar()
    },
    async carregar () {
      try { Admin.c = await API.chamar('cadastros') } catch (err) { return montar(Admin.raiz, html`<div class="vazio">${err.message}</div>`) }
      Indicadores.cad = Admin.c
      Admin.desenhar()
    },
    desenhar () {
      const abas = [['tarefas', 'Tarefas'], ['pops', 'Procedimentos (POPs)'], ['pessoas', 'Áreas e responsáveis'], ['calendario', 'Calendário e feriados'], ['acesso', 'Acesso e sessões']]
      montar(Admin.raiz, html`
        <div class="pag-cab"><div><div class="rotulo">Gestão</div><h1>Administração</h1></div></div>
        <div class="abas" role="tablist">${abas.map(([k, t]) => html`<button role="tab" data-aba="${k}" aria-selected="${Admin.aba === k}">${t}</button>`)}</div>
        <div data-aba-conteudo></div>`)
      Admin.raiz.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => { Admin.aba = b.dataset.aba; Admin.desenhar() }))
      const alvo = Admin.raiz.querySelector('[data-aba-conteudo]')
      ;({ tarefas: Admin.tarefas, pops: Admin.pops, pessoas: Admin.pessoas, calendario: Admin.calendario, acesso: Admin.acesso })[Admin.aba](alvo)
    },

    // ---------- tarefas ----------
    tarefas (alvo) {
      const c = Admin.c
      const regra = t => t.frequencia === 'diaria' ? 'Todo dia útil'
        : t.frequencia === 'semanal' ? 'Toda ' + DIAS[t.dia_semana].toLowerCase()
        : t.frequencia === 'mensal' ? (t.intervalo_meses > 1 ? `A cada ${t.intervalo_meses} meses · ` : 'Mensal · ') + (t.tipo_dia_prazo === 'ultimo_util' ? 'último dia útil' : t.tipo_dia_prazo === 'util' ? `${t.dia_prazo}º dia útil` : `dia ${t.dia_prazo}`)
        : 'Sob demanda'
      montar(alvo, html`
        <div class="pag-cab" style="margin-bottom:10px"><p class="muted small">Tarefas com histórico não podem ser excluídas — use "Desativar". Alterações valem a partir da próxima execução; o passado não é reescrito.</p>
          <button class="btn btn-primario" data-nova>+ Nova tarefa</button></div>
        ${c.categorias.map(cat => {
          const lista = c.tarefas.filter(t => t.categoria === cat.codigo)
          return html`<section class="cartao"><h3>${cat.nome}</h3><div class="tabela-wrap"><table>
            <thead><tr><th>Ordem</th><th>Código</th><th>Tarefa</th><th>Recorrência</th><th>Prazo</th><th>Prioridade</th><th>POP</th><th>Situação</th><th></th></tr></thead>
            <tbody>${lista.map((t, i) => html`<tr class="${t.ativo ? '' : 'inativa'}">
              <td><span class="ordem-btns"><button data-mover="${t.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button data-mover="${t.id}" data-dir="1" ${i === lista.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button></span></td>
              <td>${t.codigo}</td><td>${t.nome}<br><span class="muted small">${t.area || ''}${t.responsavel ? ' · ' + t.responsavel : ''}</span></td>
              <td>${regra(t)}</td><td>${t.horario_prazo}</td><td><span class="prio prio-${t.prioridade}">${PRIO[t.prioridade]}</span></td>
              <td>${t.pop ? t.pop.split(' — ')[0] : '—'}</td><td>${t.ativo ? 'Ativa' : 'Inativa'}<br><span class="muted small">${t.execucoes} registro(s)</span></td>
              <td><button class="btn btn-pequeno" data-editar="${t.id}">Editar</button></td></tr>`)}</tbody></table></div></section>`
        })}`)
      alvo.querySelector('[data-nova]').addEventListener('click', () => Admin.formTarefa(null))
      alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => Admin.formTarefa(c.tarefas.find(t => t.id === Number(b.dataset.editar)))))
      alvo.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', async () => {
        const t = c.tarefas.find(x => x.id === Number(b.dataset.mover))
        const lista = c.tarefas.filter(x => x.categoria === t.categoria)
        const i = lista.indexOf(t), j = i + Number(b.dataset.dir)
        ;[lista[i], lista[j]] = [lista[j], lista[i]]
        try { await API.chamar('reordenar_tarefas', { ids: lista.map(x => x.id) }); avisar('Ordem salva.'); Admin.carregar() } catch (err) { avisar(err.message, 'erro') }
      }))
    },

    formTarefa (t) {
      const c = Admin.c
      const v = t || { categoria: 'diaria', frequencia: 'diaria', prioridade: 'media', horario_prazo: '18:00', intervalo_meses: 1, mes_base: 1, ativo: true }
      const opc = (lista, atual, vazio) => html`${vazio ? html`<option value="">${vazio}</option>` : ''}${lista.map(([k, t2]) => html`<option value="${k}" ${String(atual ?? '') === String(k) ? 'selected' : ''}>${t2}</option>`)}`
      abrirModal({
        titulo: t ? 'Editar tarefa' : 'Nova tarefa', subtitulo: t ? `${t.codigo} · ${t.execucoes} registro(s) no histórico — o passado não será alterado` : '', largo: true,
        corpo: html`<div class="form-grade">
            <label class="campo"><span>Código</span><input type="text" name="codigo" required maxlength="20" pattern="[A-Za-z0-9][A-Za-z0-9_\\-]*" value="${v.codigo || ''}"></label>
            <label class="campo"><span>Categoria</span><select name="categoria">${opc(c.categorias.map(x => [x.codigo, x.nome]), v.categoria)}</select></label>
            <label class="campo inteira"><span>Nome da tarefa</span><input type="text" name="nome" required maxlength="200" value="${v.nome || ''}"></label>
            <label class="campo inteira"><span>Descrição / orientação</span><textarea name="descricao" maxlength="2000">${v.descricao || ''}</textarea></label>
            <label class="campo"><span>Frequência</span><select name="frequencia" data-freq>${opc(Object.entries(FREQ), v.frequencia)}</select></label>
            <label class="campo"><span>Horário previsto (prazo)</span><input type="time" name="horario_prazo" value="${v.horario_prazo}" required></label>
            <label class="campo" data-so="semanal"><span>Dia da semana</span><select name="dia_semana">${opc(DIAS.slice(1).map((d, i) => [i + 1, d]), v.dia_semana)}</select></label>
            <label class="campo" data-so="mensal"><span>Regra do prazo</span><select name="tipo_dia_prazo">${opc([['util', 'N-ésimo dia útil'], ['corrido', 'Dia do mês (corrido)'], ['ultimo_util', 'Último dia útil']], v.tipo_dia_prazo || 'util')}</select></label>
            <label class="campo" data-so="mensal"><span>Dia (N)</span><input type="number" name="dia_prazo" min="1" max="31" value="${v.dia_prazo ?? 5}"></label>
            <label class="campo" data-so="mensal"><span>Repetir a cada</span><select name="intervalo_meses">${opc([[1, '1 mês'], [2, '2 meses'], [3, '3 meses (trimestral)'], [4, '4 meses'], [6, '6 meses (semestral)'], [12, '12 meses (anual)']], v.intervalo_meses)}</select></label>
            <label class="campo" data-so="mensal"><span>Mês de referência do ciclo</span><select name="mes_base">${opc(['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => [i + 1, m]), v.mes_base)}</select></label>
            <label class="campo" data-so="semanal mensal"><span>Aparecer quantos dias antes do prazo? <em>(vazio = desde o início do período)</em></span><input type="number" name="antecedencia_dias" min="0" max="60" value="${v.antecedencia_dias ?? ''}"></label>
            <label class="campo"><span>Prioridade</span><select name="prioridade">${opc(Object.entries(PRIO), v.prioridade)}</select></label>
            <label class="campo"><span>Área administrativa</span><select name="area_id">${opc(c.areas.filter(a => a.ativo || a.id === v.area_id).map(a => [a.id, a.nome]), v.area_id, '—')}</select></label>
            <label class="campo"><span>Responsável</span><select name="responsavel_id">${opc(c.responsaveis.filter(r => r.ativo || r.id === v.responsavel_id).map(r => [r.id, r.nome]), v.responsavel_id, '—')}</select></label>
            <label class="campo"><span>POP vinculado</span><select name="pop_id">${opc(c.pops.filter(p => p.ativo || p.id === v.pop_id).map(p => [p.id, p.codigo + ' — ' + p.nome]), v.pop_id, 'Nenhum')}</select></label>
            ${!t ? html`<label class="campo"><span>Início de vigência</span><input type="date" name="inicio_vigencia" value="${dataDoTs(new Date())}"></label>` : ''}
            <label class="check inteira"><input type="checkbox" name="ativo" value="1" ${v.ativo ? 'checked' : ''}> Tarefa ativa (desmarque para desativar; o histórico é preservado)</label>
          </div>`,
        aoAbrir: dlg => {
          const sel = dlg.querySelector('[data-freq]')
          const atualizar = () => dlg.querySelectorAll('[data-so]').forEach(el => { el.hidden = !el.dataset.so.split(' ').includes(sel.value) })
          sel.addEventListener('change', atualizar); atualizar()
        },
        botoes: [{
          rotulo: 'Salvar tarefa',
          acao: async form => {
            const x = valores(form)
            const dados = { ...x, id: t?.id ?? null, ativo: !!x.ativo, ordem: t?.ordem ?? null }
            if (t && t.ativo && !dados.ativo && !await confirmarDesativar(t)) return false
            await API.chamar('salvar_tarefa', dados)
            return true
          },
        }],
      }).then(r => { if (r) { avisar('Tarefa salva.'); Admin.carregar() } })
    },

    // ---------- POPs ----------
    pops (alvo) {
      montar(alvo, html`
        <div class="pag-cab" style="margin-bottom:10px"><p class="muted small">Cadastre o link (https://) de cada procedimento publicado. O botão "Ver procedimento" aparece nas tarefas vinculadas.</p>
          <button class="btn btn-primario" data-novo>+ Novo POP</button></div>
        <section class="cartao"><div class="tabela-wrap"><table>
          <thead><tr><th>Código</th><th>Nome</th><th>Versão</th><th>Link</th><th>Situação</th><th></th></tr></thead>
          <tbody>${Admin.c.pops.map(p => html`<tr class="${p.ativo ? '' : 'inativa'}"><td>${p.codigo}</td><td>${p.nome}</td><td>${p.versao || '—'}</td>
            <td>${p.url ? html`<a href="${p.url}" target="_blank" rel="noopener noreferrer">abrir</a>` : html`<span class="muted">pendente</span>`}</td>
            <td>${p.ativo ? 'Ativo' : 'Inativo'}</td><td><button class="btn btn-pequeno" data-editar="${p.id}">Editar</button></td></tr>`)}</tbody></table></div></section>`)
      const form = p => abrirModal({
        titulo: p ? 'Editar POP' : 'Novo POP',
        corpo: html`<div class="form-grade">
          <label class="campo"><span>Código</span><input type="text" name="codigo" required maxlength="30" value="${p?.codigo || ''}"></label>
          <label class="campo"><span>Versão</span><input type="text" name="versao" maxlength="30" value="${p?.versao || ''}"></label>
          <label class="campo inteira"><span>Nome</span><input type="text" name="nome" required maxlength="200" value="${p?.nome || ''}"></label>
          <label class="campo inteira"><span>Link do documento (https://…)</span><input type="url" name="url" maxlength="1000" pattern="https?://.+" value="${p?.url || ''}"></label>
          <label class="campo inteira"><span>Observação</span><textarea name="observacao" maxlength="1000">${p?.observacao || ''}</textarea></label>
          <label class="check"><input type="checkbox" name="ativo" value="1" ${!p || p.ativo ? 'checked' : ''}> Ativo</label></div>`,
        botoes: [{ rotulo: 'Salvar', acao: async f => { const x = valores(f); await API.chamar('salvar_pop', { ...x, id: p?.id ?? null, ativo: !!x.ativo }); return true } }],
      }).then(r => { if (r) { avisar('POP salvo.'); Admin.carregar() } })
      alvo.querySelector('[data-novo]').addEventListener('click', () => form(null))
      alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => form(Admin.c.pops.find(p => p.id === Number(b.dataset.editar)))))
    },

    // ---------- áreas e responsáveis ----------
    pessoas (alvo) {
      const bloco = (tipo, titulo, lista, comFuncao) => html`<section class="cartao"><div class="pag-cab" style="margin-bottom:8px"><h3>${titulo}</h3><button class="btn btn-pequeno" data-novo="${tipo}">+ Adicionar</button></div>
        <table><tbody>${lista.map(x => html`<tr class="${x.ativo ? '' : 'inativa'}"><td>${x.nome}${comFuncao && x.funcao ? html`<br><span class="muted small">${x.funcao}</span>` : ''}</td><td>${x.ativo ? 'Ativo' : 'Inativo'}</td>
          <td class="num"><button class="btn btn-pequeno" data-editar="${tipo}:${x.id}">Editar</button></td></tr>`)}</tbody></table></section>`
      montar(alvo, html`<div class="grade-2">${bloco('area', 'Áreas administrativas', Admin.c.areas, false)}${bloco('responsavel', 'Responsáveis', Admin.c.responsaveis, true)}</div>`)
      const form = (tipo, x) => abrirModal({
        titulo: (x ? 'Editar ' : 'Novo ') + (tipo === 'area' ? 'área' : 'responsável'),
        corpo: html`<label class="campo"><span>Nome</span><input type="text" name="nome" required maxlength="120" value="${x?.nome || ''}"></label>
          ${tipo === 'responsavel' ? html`<label class="campo"><span>Função</span><input type="text" name="funcao" maxlength="120" value="${x?.funcao || ''}"></label>` : ''}
          <label class="check"><input type="checkbox" name="ativo" value="1" ${!x || x.ativo ? 'checked' : ''}> Ativo</label>`,
        botoes: [{ rotulo: 'Salvar', acao: async f => { const v = valores(f); await API.chamar(tipo === 'area' ? 'salvar_area' : 'salvar_responsavel', { ...v, id: x?.id ?? null, ativo: !!v.ativo }); return true } }],
      }).then(r => { if (r) { avisar('Salvo.'); Admin.carregar() } })
      alvo.querySelectorAll('[data-novo]').forEach(b => b.addEventListener('click', () => form(b.dataset.novo, null)))
      alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => {
        const [tipo, id] = b.dataset.editar.split(':')
        form(tipo, (tipo === 'area' ? Admin.c.areas : Admin.c.responsaveis).find(x => x.id === Number(id)))
      }))
    },

    // ---------- calendário ----------
    calendario (alvo) {
      const cal = Admin.c.calendario
      montar(alvo, html`
        <section class="cartao"><h3>Dias de trabalho</h3>
          <p class="muted small" style="margin-bottom:10px">Segunda a sexta são dias úteis. Tarefas diárias só são geradas em dias úteis; prazos semanais e mensais que caem em dia não útil são antecipados.</p>
          <form data-cal style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
            <label class="check"><input type="checkbox" name="trabalha_sabado" ${cal.trabalha_sabado ? 'checked' : ''}> Trabalha aos sábados</label>
            <label class="check"><input type="checkbox" name="trabalha_domingo" ${cal.trabalha_domingo ? 'checked' : ''}> Trabalha aos domingos</label>
            <button class="btn btn-primario btn-pequeno" type="submit">Salvar</button>
          </form>
          <p class="muted small" style="margin-top:8px">Início da operação do painel: ${fmtData(cal.data_inicio_operacao)} · último processamento: ${fmtData(cal.ultimo_dia_processado)}</p>
        </section>
        <section class="cartao"><div class="pag-cab" style="margin-bottom:8px"><h3>Feriados e exceções</h3><button class="btn btn-primario btn-pequeno" data-novo>+ Adicionar data</button></div>
          <p class="muted small" style="margin-bottom:8px">Cadastre feriados municipais/estaduais, pontes e dias extras de trabalho. Datas inativas são ignoradas.</p>
          <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Efeito</th><th>Situação</th><th></th></tr></thead>
          <tbody>${Admin.c.excecoes.map(x => html`<tr class="${x.ativo ? '' : 'inativa'}"><td>${fmtData(x.data)} <span class="muted small">${UI.fmtDiaSemana(x.data)}</span></td><td>${x.descricao}</td><td>${x.tipo}</td>
            <td>${x.dia_util ? 'Dia de trabalho' : 'Sem expediente'}</td><td>${x.ativo ? 'Ativo' : 'Inativo'}</td>
            <td class="num"><button class="btn btn-pequeno" data-editar="${x.data}">Editar</button></td></tr>`)}</tbody></table></div></section>`)
      alvo.querySelector('[data-cal]').addEventListener('submit', async ev => {
        ev.preventDefault()
        const f = ev.target
        try { await API.chamar('salvar_calendario', { trabalha_sabado: f.trabalha_sabado.checked, trabalha_domingo: f.trabalha_domingo.checked }); avisar('Calendário salvo.'); Admin.carregar() } catch (err) { avisar(err.message, 'erro') }
      })
      const form = x => abrirModal({
        titulo: x ? 'Editar data' : 'Nova data no calendário',
        corpo: html`<div class="form-grade">
          <label class="campo"><span>Data</span><input type="date" name="data" required value="${x?.data || ''}" ${x ? 'readonly' : ''}></label>
          <label class="campo"><span>Tipo</span><select name="tipo">${[['municipal', 'Feriado municipal'], ['estadual', 'Feriado estadual'], ['nacional', 'Feriado nacional'], ['empresa', 'Folga/ponte da empresa'], ['dia_extra', 'Dia extra de trabalho']].map(([k, t]) => html`<option value="${k}" ${x?.tipo === k ? 'selected' : ''}>${t}</option>`)}</select></label>
          <label class="campo inteira"><span>Descrição</span><input type="text" name="descricao" required maxlength="120" value="${x?.descricao || ''}"></label>
          <label class="check"><input type="checkbox" name="dia_util" value="1" ${x?.dia_util ? 'checked' : ''}> Haverá expediente nesta data (dia extra)</label>
          <label class="check"><input type="checkbox" name="ativo" value="1" ${!x || x.ativo ? 'checked' : ''}> Ativo</label></div>
          <p class="muted small">Alterações no calendário valem para os dias ainda não gerados; registros já criados permanecem no histórico.</p>`,
        botoes: [{ rotulo: 'Salvar', acao: async f => { const v = valores(f); await API.chamar('salvar_excecao', { ...v, dia_util: !!v.dia_util, ativo: !!v.ativo }); return true } }],
      }).then(r => { if (r) { avisar('Calendário salvo.'); Admin.carregar() } })
      alvo.querySelector('[data-novo]').addEventListener('click', () => form(null))
      alvo.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => form(Admin.c.excecoes.find(x => x.data === b.dataset.editar))))
    },

    // ---------- acesso ----------
    acesso (alvo) {
      const c = Admin.c
      montar(alvo, html`
        <section class="cartao"><h3>Códigos de acesso</h3>
          <p class="muted small" style="margin-bottom:10px">Há um código para a <strong>Operação</strong> (auxiliar administrativa: usa o painel e registra as rotinas) e outro para a <strong>Gestão</strong> (também administra cadastros e acessos).
            Os códigos são guardados apenas como hash; nem a gestão consegue consultá-los. Ao trocar um código, as sessões abertas daquele perfil são encerradas.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-codigo="operacao">Trocar código da Operação</button><button class="btn" data-codigo="gestao">Trocar código da Gestão</button></div>
          <div class="tabela-wrap" style="margin-top:12px"><table><thead><tr><th>Perfil</th><th>Descrição</th><th>Criado em</th><th>Situação</th></tr></thead>
            <tbody>${c.credenciais.map(k => html`<tr class="${k.ativo ? '' : 'inativa'}"><td>${k.perfil === 'gestao' ? 'Gestão' : 'Operação'}</td><td>${k.descricao}</td><td>${fmtDataHora(k.criado_em)}</td><td>${k.ativo ? 'Ativo' : 'Desativado ' + fmtDataHora(k.desativado_em)}</td></tr>`)}</tbody></table></div>
        </section>
        <section class="cartao"><h3>Computadores conectados</h3>
          <div class="tabela-wrap"><table><thead><tr><th>Perfil</th><th>Computador</th><th>Entrou em</th><th>Último uso</th><th>Expira em</th><th></th></tr></thead>
            <tbody>${c.sessoes.map(s => html`<tr><td>${s.perfil === 'gestao' ? 'Gestão' : 'Operação'}</td><td>${s.dispositivo || '—'}<br><span class="muted small">${s.ip || ''}</span></td><td>${fmtDataHora(s.criada_em)}</td><td>${fmtDataHora(s.ultimo_uso_em)}</td><td>${fmtDataHora(s.expira_em)}</td>
              <td class="num"><button class="btn btn-pequeno btn-perigo" data-revogar="${s.id}">Desconectar</button></td></tr>`)}</tbody></table></div></section>`)
      alvo.querySelectorAll('[data-codigo]').forEach(b => b.addEventListener('click', () => abrirModal({
        titulo: 'Trocar código — ' + (b.dataset.codigo === 'gestao' ? 'Gestão' : 'Operação'),
        corpo: html`<label class="campo"><span>Novo código (mínimo 10 caracteres, com letras e números)</span><input type="password" name="novo_codigo" required minlength="10" maxlength="128" autocomplete="new-password"></label>
          <label class="campo"><span>Repita o novo código</span><input type="password" name="repetir" required minlength="10" maxlength="128" autocomplete="new-password"></label>
          <label class="check"><input type="checkbox" name="revogar" value="1" checked> Desconectar os computadores que usam o código atual</label>`,
        botoes: [{ rotulo: 'Trocar código', acao: async f => {
          const v = valores(f)
          if (v.novo_codigo !== v.repetir) throw new Error('Os códigos digitados não conferem.')
          const r = await API.chamar('alterar_codigo', { perfil: b.dataset.codigo, novo_codigo: v.novo_codigo, revogar_sessoes: !!v.revogar })
          avisar(`Código alterado. ${r.sessoes_revogadas} sessão(ões) encerrada(s).`)
          return true
        } }],
      }).then(r => { if (r) Admin.carregar() })))
      alvo.querySelectorAll('[data-revogar]').forEach(b => b.addEventListener('click', async () => {
        if (!await confirmar('Desconectar computador?', 'Ele precisará informar o código de acesso novamente.', 'Desconectar')) return
        try { await API.chamar('revogar_sessao', { id: b.dataset.revogar }); avisar('Computador desconectado.'); Admin.carregar() } catch (err) { avisar(err.message, 'erro') }
      }))
    },
  }

  async function confirmarDesativar (t) {
    return confirm(`Desativar "${t.nome}"?\n\nO histórico é mantido. Execuções de hoje ainda não iniciadas ficarão como "Não aplicável" e não serão geradas novas.`)
  }

  window.Telas = Object.assign(window.Telas || {}, { Indicadores, Admin })
})()
