// Utilitários de interface: HTML seguro, formatação, avisos, modal e gráficos em SVG.
(function () {
  const FUSO = 'America/Sao_Paulo'

  // ---------- HTML com escape automático ----------
  class Seguro { constructor (s) { this.s = s } toString () { return this.s } }
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const parte = v => v instanceof Seguro ? v.s : Array.isArray(v) ? v.map(parte).join('') : (v === false || v == null) ? '' : esc(v)
  const html = (partes, ...valores) => new Seguro(partes.reduce((acc, p, i) => acc + p + (i < valores.length ? parte(valores[i]) : ''), ''))
  const bruto = s => new Seguro(s)
  const montar = (alvo, conteudo) => { alvo.innerHTML = String(conteudo) }

  // ---------- rótulos ----------
  const STATUS = {
    a_fazer: 'A fazer', em_andamento: 'Em andamento', concluida: 'Concluída',
    pendente: 'Pendente', nao_realizada: 'Não realizada', nao_aplicavel: 'Não aplicável',
  }
  const FREQ = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal', sob_demanda: 'Sob demanda' }
  const PRIO = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  const COR_STATUS = {
    concluida: 'var(--st-concluida)', em_andamento: 'var(--st-em_andamento)', pendente: 'var(--st-pendente)',
    nao_realizada: 'var(--st-nao_realizada)', nao_aplicavel: 'var(--st-nao_aplicavel)', a_fazer: 'var(--border-strong)',
  }

  // ---------- datas (sempre no fuso de São Paulo) ----------
  const dataLocal = iso => { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d, 12)) }
  const fmtData = iso => iso ? iso.split('-').reverse().join('/') : '—'
  const fmtDataCurta = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—'
  const fmtDiaSemana = iso => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(dataLocal(iso)).replace('.', '')
  const fmtDataLonga = iso => {
    const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dataLocal(iso))
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  const fmtHora = ts => ts ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(new Date(ts)) : '—'
  const fmtDataHora = ts => ts ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(new Date(ts)) : '—'
  const dataDoTs = ts => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(new Date(ts))
  const somarDias = (iso, n) => { const d = dataLocal(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  const pct = v => v == null ? '—' : String(v).replace('.', ',') + '%'

  function textoPrazo (e) {
    const hora = fmtHora(e.prazo)
    if (e.frequencia === 'diaria' || e.frequencia === 'sob_demanda') return 'até ' + hora
    return `até ${fmtDiaSemana(e.data_prevista)} ${fmtDataCurta(e.data_prevista)} ${hora}`
  }

  // ---------- avisos ----------
  function avisar (msg, tipo = 'ok', ms) {
    const caixa = document.getElementById('avisos')
    const div = document.createElement('div')
    div.className = 'aviso' + (tipo === 'erro' ? ' erro' : tipo === 'alerta' ? ' alerta' : '')
    div.setAttribute('role', tipo === 'erro' ? 'alert' : 'status')
    div.textContent = msg
    caixa.appendChild(div)
    setTimeout(() => div.remove(), ms || (tipo === 'erro' ? 9000 : 3500))
  }

  // ---------- modal ----------
  // botoes: [{ rotulo, tipo: 'primario'|'perigo', acao: async (form) => true (fecha) | false }]
  function abrirModal ({ titulo, subtitulo, corpo, botoes = [], largo = false, aoAbrir }) {
    const dlg = document.getElementById('modal')
    dlg.className = 'modal' + (largo ? ' largo' : '')
    montar(dlg, html`
      <form method="dialog" class="modal-form" novalidate>
        <div class="modal-cab"><div><h2>${titulo}</h2>${subtitulo ? html`<p>${subtitulo}</p>` : ''}</div>
          <button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
        <div class="modal-corpo">${corpo}<p class="erro-msg" data-erro hidden></p></div>
        <div class="modal-rodape">
          <button type="button" class="btn" data-fechar>${botoes.length ? 'Cancelar' : 'Fechar'}</button>
          ${botoes.map((b, i) => html`<button type="${i === botoes.length - 1 ? 'submit' : 'button'}" class="btn ${b.tipo === 'perigo' ? 'btn-perigo' : 'btn-primario'}" data-botao="${i}">${b.rotulo}</button>`)}
        </div>
      </form>`)
    const form = dlg.querySelector('form')
    const erro = dlg.querySelector('[data-erro]')
    return new Promise(resolve => {
      let resultado = null
      const fechar = () => { dlg.close(); }
      dlg.onclose = () => resolve(resultado)
      dlg.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar))
      const executar = async (i) => {
        const b = botoes[i]
        if (!form.reportValidity()) return
        const btns = dlg.querySelectorAll('.modal-rodape button')
        btns.forEach(x => { x.disabled = true })
        erro.hidden = true
        const original = dlg.querySelector(`[data-botao="${i}"]`).textContent
        dlg.querySelector(`[data-botao="${i}"]`).textContent = 'Salvando…'
        try {
          const r = await b.acao(form)
          if (r !== false) { resultado = r ?? true; fechar() }
        } catch (e) {
          erro.textContent = e.message; erro.hidden = false
        } finally {
          btns.forEach(x => { x.disabled = false })
          const bt = dlg.querySelector(`[data-botao="${i}"]`); if (bt) bt.textContent = original
        }
      }
      form.addEventListener('submit', ev => { ev.preventDefault(); if (botoes.length) executar(botoes.length - 1); else fechar() })
      dlg.querySelectorAll('[data-botao]').forEach(b => {
        if (b.type === 'button') b.addEventListener('click', () => executar(Number(b.dataset.botao)))
      })
      dlg.showModal()
      if (aoAbrir) aoAbrir(dlg)
      const primeiro = dlg.querySelector('.modal-corpo input, .modal-corpo select, .modal-corpo textarea')
      if (primeiro) primeiro.focus()
    })
  }
  const confirmar = (titulo, texto, rotulo = 'Confirmar') =>
    abrirModal({ titulo, corpo: html`<p>${texto}</p>`, botoes: [{ rotulo, acao: async () => true }] })

  const valores = form => Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))

  // ---------- ícones ----------
  const ICONES = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
    nota: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    livro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>',
  }
  const icone = n => bruto(ICONES[n])

  // ---------- gráficos SVG (sem bibliotecas externas) ----------
  // series: [{ nome, cor, valores: [números|null] }], rotulos: [texto]
  function graficoLinhas (rotulos, series, { altura = 220, max = 100, sufixo = '%' } = {}) {
    const L = 640, A = altura, mE = 36, mD = 10, mT = 12, mB = 28
    const w = L - mE - mD, h = A - mT - mB
    const n = Math.max(rotulos.length, 1)
    const x = i => mE + (n === 1 ? w / 2 : (i * w) / (n - 1))
    const y = v => mT + h - (Math.max(0, Math.min(v, max)) / max) * h
    const grades = [0, 25, 50, 75, 100].map(v => v * max / 100)
    const passo = Math.ceil(n / 10)
    let s = `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="${esc(series.map(z => z.nome).join(' e '))}">`
    grades.forEach(g => { s += `<line class="grade" x1="${mE}" x2="${L - mD}" y1="${y(g)}" y2="${y(g)}"/><text x="${mE - 6}" y="${y(g) + 4}" text-anchor="end">${g}${sufixo}</text>` })
    rotulos.forEach((r, i) => { if (i % passo === 0 || i === n - 1) s += `<text x="${x(i)}" y="${A - 8}" text-anchor="middle">${esc(r)}</text>` })
    series.forEach(z => {
      const pts = z.valores.map((v, i) => v == null ? null : `${x(i)},${y(v)}`)
      let d = '', novo = true
      pts.forEach(p => { if (!p) { novo = true; return } d += (novo ? 'M' : 'L') + p; novo = false })
      s += `<path d="${d}" fill="none" stroke="${z.cor}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`
      z.valores.forEach((v, i) => { if (v != null) s += `<circle cx="${x(i)}" cy="${y(v)}" r="${n > 40 ? 1.8 : 3.2}" fill="${z.cor}"><title>${esc(rotulos[i])}: ${esc(pct(v))}</title></circle>` })
    })
    return bruto(s + '</svg>')
  }

  // barras empilhadas por situação: itens [{ rotulo, partes: [{ valor, cor, nome }] }]
  function graficoBarras (itens, { altura = 220 } = {}) {
    const L = 640, A = altura, mE = 36, mD = 10, mT = 12, mB = 28
    const w = L - mE - mD, h = A - mT - mB
    const max = Math.max(1, ...itens.map(i => i.partes.reduce((a, p) => a + p.valor, 0)))
    const bw = Math.min(46, (w / Math.max(itens.length, 1)) * 0.65)
    const passo = Math.ceil(itens.length / 12)
    let s = `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="Execuções por período">`
    ;[0, .5, 1].forEach(f => { const yy = mT + h - f * h; s += `<line class="grade" x1="${mE}" x2="${L - mD}" y1="${yy}" y2="${yy}"/><text x="${mE - 6}" y="${yy + 4}" text-anchor="end">${Math.round(f * max)}</text>` })
    itens.forEach((it, i) => {
      const cx = mE + (w / itens.length) * (i + 0.5)
      let topo = mT + h
      it.partes.forEach(p => {
        if (!p.valor) return
        const ph = (p.valor / max) * h
        topo -= ph
        s += `<rect x="${cx - bw / 2}" y="${topo}" width="${bw}" height="${ph}" fill="${p.cor}" rx="2"><title>${esc(it.rotulo)} — ${esc(p.nome)}: ${p.valor}</title></rect>`
      })
      if (i % passo === 0) s += `<text x="${cx}" y="${A - 8}" text-anchor="middle">${esc(it.rotulo)}</text>`
    })
    return bruto(s + '</svg>')
  }

  window.UI = {
    esc, html, bruto, montar, STATUS, FREQ, PRIO, DIAS, COR_STATUS,
    fmtData, fmtDataCurta, fmtDataLonga, fmtDiaSemana, fmtHora, fmtDataHora, dataDoTs, somarDias, pct, textoPrazo,
    avisar, abrirModal, confirmar, valores, icone, graficoLinhas, graficoBarras,
  }
})()
