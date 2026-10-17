import React, { useEffect, useRef, useState } from 'react'
import { normalizeRichContent } from '../../../lib/cbtgen/contentModel'

const LATEX_SYMBOLS = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ϵ',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'ϕ', chi: 'χ', psi: 'ψ',
  omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
  Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  infinity: '∞', infty: '∞', pm: '±', mp: '∓', times: '×', cdot: '·',
  div: '÷', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', ne: '≠',
  approx: '≈', sim: '∼', equiv: '≡', in: '∈', notin: '∉', subset: '⊂',
  subseteq: '⊆', supset: '⊃', supseteq: '⊇', to: '→', rightarrow: '→',
  leftarrow: '←', Leftrightarrow: '⇔', Rightarrow: '⇒', Leftarrow: '⇐',
  forall: '∀', exists: '∃', partial: '∂', nabla: '∇', sum: '∑', prod: '∏',
  int: '∫', oint: '∮', sqrt: '√', degree: '°', circ: '∘', ldots: '…', dots: '…',
  cdots: '⋯', vdots: '⋮', ddots: '⋱', ell: '…', prime: '′', emptyset: '∅',
  cap: '∩', cup: '∪', land: '∧', lor: '∨', neg: '¬', therefore: '∴',
  because: '∵', angle: '∠', parallel: '∥', perp: '⊥', propto: '∝',
}

const FUNCTION_NAMES = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det',
])

function readLatexGroup(source, index) {
  if (source[index] !== '{') return { value: source[index] || '', next: index + 1 }
  let depth = 1
  let i = index + 1
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') depth -= 1
    i += 1
  }
  return { value: source.slice(index + 1, Math.max(index + 1, i - 1)), next: i }
}

function readRequiredGroup(source, index) {
  while (/\s/.test(source[index] || '')) index += 1
  return readLatexGroup(source, index)
}

function makeRow(value, key) {
  return <mrow key={key}>{parseLatex(value)}</mrow>
}

function parseMatrixEnvironment(body, keyPrefix) {
  const rows = body.split(/\\\\/g)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(/(?<!\\)&/g).map((cell) => cell.trim()))

  return (
    <mtable key={keyPrefix} columnalign="center">
      {rows.map((row, r) => (
        <mtr key={`${keyPrefix}-r${r}`}>
          {row.map((cell, c) => <mtd key={`${keyPrefix}-${r}-${c}`}>{parseLatex(cell)}</mtd>)}
        </mtr>
      ))}
    </mtable>
  )
}

let mathJaxLoadPromise

function ensureMathJax() {
  if (typeof window === 'undefined') return Promise.reject(new Error('MathJax requires a browser'))
  if (window.MathJax?.typesetPromise) return Promise.resolve(window.MathJax)
  if (mathJaxLoadPromise) return mathJaxLoadPromise

  // MathJax is the primary LaTeX renderer. The local MathML renderer below stays
  // available as an offline fallback, so questions remain visible without CDN access.
  window.MathJax = {
    ...(window.MathJax || {}),
    tex: {
      ...(window.MathJax?.tex || {}),
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      packages: { '[+]': ['mhchem'] },
    },
    loader: { ...(window.MathJax?.loader || {}), load: ['[tex]/mhchem'] },
    startup: { ...(window.MathJax?.startup || {}), typeset: false },
  }

  mathJaxLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cbtgen-mathjax="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.MathJax), { once: true })
      existing.addEventListener('error', () => reject(new Error('MathJax failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
    script.async = true
    script.dataset.cbtgenMathjax = 'true'
    script.onload = () => window.MathJax?.startup?.promise
      ? window.MathJax.startup.promise.then(() => resolve(window.MathJax), reject)
      : resolve(window.MathJax)
    script.onerror = () => reject(new Error('MathJax failed to load'))
    document.head.appendChild(script)
  })
  return mathJaxLoadPromise
}

function MathJaxLatex({ source, display, fallback }) {
  const nodeRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true
    const node = nodeRef.current

    ensureMathJax().then(async (mathJax) => {
      if (!active) return
      if (!node) {
        setStatus('ready')
        return
      }

      try {
        if (mathJax.typesetClear) mathJax.typesetClear([node])
        await mathJax.typesetPromise([node])
        if (active) setStatus('ready')
      } catch {
        if (active) setStatus('fallback')
      }
    }).catch(() => {
      if (active) setStatus('fallback')
    })

    return () => {
      active = false
      if (node && window.MathJax?.typesetClear) {
        window.MathJax.typesetClear([node])
      }
    }
  }, [source, display, status])

  if (status === 'fallback') return fallback
  if (status === 'loading') return fallback
  return <span ref={nodeRef} className="question-math-source">{display === 'inline' ? `\\(${source}\\)` : `\\[${source}\\]`}</span>
}

export function LatexMath({ value, format = 'latex', display = 'block' }) {
  const source = String(value ?? '').trim()
  if (!source) return null

  if (format === 'mathml' && /<math[\s>]/i.test(source)) {
    return <span className={`question-math question-math-mathml question-math-${display}`} dangerouslySetInnerHTML={{ __html: source }} />
  }

  if (format === 'latex') {
    return (
      <span className={`question-math question-math-${display}`} aria-label="Mathematical expression">
        <MathJaxLatex
          source={source}
          display={display}
          fallback={<math xmlns="http://www.w3.org/1998/Math/MathML" display={display === 'inline' ? 'inline' : 'block'}><mrow>{parseLatex(source)}</mrow></math>}
        />
      </span>
    )
  }

  // Unicode/plain-symbol math is intentionally rendered as text, not misparsed as TeX.
  return <span className={`question-math question-math-unicode question-math-${display}`} aria-label="Mathematical expression">{source}</span>
}

function parseLatex(source) {
  const nodes = []
  let i = 0

  const parseAtom = () => {
    while (i < source.length && /\s/.test(source[i])) i += 1
    if (i >= source.length) return null

    const char = source[i]
    let node

    if (char === '{') {
      const group = readLatexGroup(source, i)
      i = group.next
      node = makeRow(group.value, `group-${i}`)
    } else if (char === '\\') {
      i += 1

      // TeX spacing/control punctuation.
      if (source[i] === ',' || source[i] === ';' || source[i] === ':' || source[i] === '!' || source[i] === ' ') {
        i += 1
        return parseAtom()
      }

      const match = source.slice(i).match(/^[A-Za-z]+/)
      const command = match ? match[0] : source[i] || ''
      i += command.length

      if (command === 'begin') {
        const env = readRequiredGroup(source, i)
        i = env.next
        const endToken = `\\end{${env.value}}`
        const endIndex = source.indexOf(endToken, i)
        if (endIndex >= 0) {
          const body = source.slice(i, endIndex)
          i = endIndex + endToken.length
          if (/matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases/.test(env.value)) {
            const matrix = parseMatrixEnvironment(body, `matrix-${i}`)
            if (env.value === 'pmatrix') node = <mrow key={`pm-${i}`}><mo>(</mo>{matrix}<mo>)</mo></mrow>
            else if (env.value === 'bmatrix') node = <mrow key={`bm-${i}`}><mo>[</mo>{matrix}<mo>]</mo></mrow>
            else if (env.value === 'Bmatrix') node = <mrow key={`Bm-${i}`}><mo>{'{'}</mo>{matrix}<mo>{'}'}</mo></mrow>
            else if (env.value === 'vmatrix') node = <mrow key={`vm-${i}`}><mo>|</mo>{matrix}<mo>|</mo></mrow>
            else if (env.value === 'Vmatrix') node = <mrow key={`Vm-${i}`}><mo>‖</mo>{matrix}<mo>‖</mo></mrow>
            else node = matrix
          } else {
            node = makeRow(body, `env-${i}`)
          }
        } else {
          node = <mi key={`begin-${i}`}>{env.value}</mi>
        }
      } else if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
        const numerator = readRequiredGroup(source, i); i = numerator.next
        const denominator = readRequiredGroup(source, i); i = denominator.next
        node = <mfrac key={`frac-${i}`}><mrow>{parseLatex(numerator.value)}</mrow><mrow>{parseLatex(denominator.value)}</mrow></mfrac>
      } else if (command === 'sqrt') {
        while (/\s/.test(source[i] || '')) i += 1
        let indexValue = null
        if (source[i] === '[') {
          const close = source.indexOf(']', i + 1)
          if (close >= 0) { indexValue = source.slice(i + 1, close); i = close + 1 }
        }
        const group = readRequiredGroup(source, i); i = group.next
        node = indexValue
          ? <mroot key={`root-${i}`}><mrow>{parseLatex(group.value)}</mrow><mrow>{parseLatex(indexValue)}</mrow></mroot>
          : <msqrt key={`sqrt-${i}`}><mrow>{parseLatex(group.value)}</mrow></msqrt>
      } else if (command === 'left' || command === 'right') {
        // Delimiter immediately follows the command. Keep it as a visible operator.
        while (/\s/.test(source[i] || '')) i += 1
        if (source[i] === '\\') {
          i += 1
          const d = source.slice(i).match(/^[A-Za-z]+/)
          const delimiter = d ? d[0] : ''
          i += delimiter.length
          node = <mo key={`delim-${i}`}>{LATEX_SYMBOLS[delimiter] || delimiter}</mo>
        } else {
          node = <mo key={`delim-${i}`}>{source[i] || ''}</mo>
          i += 1
        }
      } else if (command === 'overline' || command === 'bar' || command === 'vec' || command === 'hat' || command === 'widehat' || command === 'widetilde' || command === 'tilde') {
        const group = readRequiredGroup(source, i); i = group.next
        const accent = command === 'overline' || command === 'bar' ? '¯' : command === 'vec' ? '→' : command.includes('hat') ? 'ˆ' : '~'
        node = <mover key={`accent-${i}`} accent="true"><mrow>{parseLatex(group.value)}</mrow><mo>{accent}</mo></mover>
      } else if (command === 'text' || command === 'mathrm' || command === 'mathbf' || command === 'mathit' || command === 'mathbb' || command === 'mathcal' || command === 'operatorname') {
        const group = readRequiredGroup(source, i); i = group.next
        const mathvariant = command === 'mathbf' ? 'bold' : command === 'mathbb' ? 'double-struck' : command === 'mathcal' ? 'script' : command === 'mathit' ? 'italic' : 'normal'
        node = command === 'text' || command === 'operatorname'
          ? <mtext key={`text-${i}`}>{group.value}</mtext>
          : <mrow key={`styled-${i}`} mathvariant={mathvariant}>{parseLatex(group.value)}</mrow>
      } else if (FUNCTION_NAMES.has(command)) {
        node = <mi key={`fn-${i}`} mathvariant="normal">{command}</mi>
      } else if (LATEX_SYMBOLS[command]) {
        const symbol = LATEX_SYMBOLS[command]
        node = /[A-Za-zα-ωΑ-Ω]/.test(symbol)
          ? <mi key={`cmd-${i}`}>{symbol}</mi>
          : <mo key={`cmd-${i}`}>{symbol}</mo>
      } else if (command === 'not') {
        node = <mo key={`not-${i}`}≯</mo>
      } else if (command === ' ') {
        node = <mspace key={`space-${i}`} width="0.25em" />
      } else {
        node = <mi key={`unknown-${i}`}>{command}</mi>
      }
    } else if (/[0-9]/.test(char)) {
      const match = source.slice(i).match(/^\d+(?:\.\d+)?/)
      const text = match ? match[0] : char
      i += text.length
      node = <mn key={`num-${i}`}>{text}</mn>
    } else if (/[A-Za-z]/.test(char)) {
      const match = source.slice(i).match(/^[A-Za-z]+/)
      const text = match ? match[0] : char
      i += text.length
      node = <mi key={`id-${i}`}>{text}</mi>
    } else {
      i += 1
      node = <mo key={`op-${i}`}>{char}</mo>
    }

    let sub = null
    let sup = null
    while (i < source.length) {
      while (/\s/.test(source[i] || '')) i += 1
      if (source[i] !== '^' && source[i] !== '_') break
      const marker = source[i++]
      while (/\s/.test(source[i] || '')) i += 1

      let valueNode
      if (source[i] === '{') {
        const group = readLatexGroup(source, i); i = group.next
        valueNode = <mrow>{parseLatex(group.value)}</mrow>
      } else if (source[i] === '\\') {
        valueNode = parseAtom()
      } else {
        const single = source[i] || ''
        i += 1
        valueNode = /[0-9]/.test(single) ? <mn>{single}</mn> : <mi>{single}</mi>
      }

      if (marker === '^') sup = valueNode
      else sub = valueNode
    }

    if (sub && sup) node = <msubsup>{node}{sub}{sup}</msubsup>
    else if (sub) node = <msub>{node}{sub}</msub>
    else if (sup) node = <msup>{node}{sup}</msup>

    return node
  }

  while (i < source.length) {
    const atom = parseAtom()
    if (!atom) break
    nodes.push(React.cloneElement(atom, { key: `node-${nodes.length}` }))
  }

  return nodes
}

function contentText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(contentText).join('')
  if (typeof value === 'object') return String(value.value ?? value.text ?? value.label ?? '')
  return ''
}

function RichTable({ block }) {
  const headers = block.headers || []
  const rows = block.rows || []
  return (
    <figure className="content-table-figure">
      {block.caption && <figcaption>{block.caption}</figcaption>}
      <div className="content-table-scroll">
        <table className="content-table">
          {headers.length > 0 && <thead><tr>{headers.map((header, i) => <th key={i} scope="col">{contentText(header)}</th>)}</tr></thead>}
          <tbody>{rows.map((row, i) => <tr key={i}>{(Array.isArray(row) ? row : [row]).map((cell, j) => {
            const value = cell && typeof cell === 'object' ? (cell.text ?? cell.value ?? '') : cell
            const props = {}
            if (cell && typeof cell === 'object') {
              if (Number.isInteger(cell.colSpan) && cell.colSpan > 1) props.colSpan = cell.colSpan
              if (Number.isInteger(cell.rowSpan) && cell.rowSpan > 1) props.rowSpan = cell.rowSpan
              if (cell.header) return <th key={j} scope="row" {...props}>{contentText(value)}</th>
            }
            return <td key={j} {...props}>{contentText(value)}</td>
          })}</tr>)}</tbody>
        </table>
      </div>
    </figure>
  )
}

function DataChart({ block }) {
  // Deliberately renders only explicitly supplied values; it never infers data from a source image.
  const rows = block.data || []
  const xKey = block.xKey || 'x'
  const series = block.series?.length ? block.series : [{ dataKey: 'y', label: block.label || 'Series' }]
  const values = rows.flatMap((row) => series.map((item) => Number(row?.[item.dataKey])).filter(Number.isFinite))
  if (!rows.length || !values.length || block.chartType === 'unknown') {
    return <div className="content-chart-fallback" role="img" aria-label={block.alt || 'Chart data could not be rendered as a structured chart'}>
      {block.assetUrl || block.assetRef ? <img src={block.assetUrl || block.assetRef} alt={block.alt || 'Source chart'} /> : <p>{block.alt || 'Chart present in source; structured chart data is unavailable.'}</p>}
    </div>
  }
  const width = 640, height = 300, left = 48, right = 18, top = 20, bottom = 44
  const plotW = width - left - right, plotH = height - top - bottom
  const min = Math.min(0, ...values), max = Math.max(1, ...values), range = max - min || 1
  const xAt = (i) => left + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW)
  const yAt = (v) => top + ((max - v) / range) * plotH
  if (block.chartType === 'pie') {
    const first = series[0]
    const pieValues = rows.map((row) => Math.max(0, Number(row?.[first.dataKey]) || 0))
    const total = pieValues.reduce((sum, v) => sum + v, 0)
    if (total <= 0) return <p>Chart values are not available.</p>
    const cx = 180, cy = 145, radius = 105
    const slices = pieValues.map((v, i) => {
      const angle = -Math.PI / 2 + pieValues
        .slice(0, i)
        .reduce((sum, previous) => sum + (previous / total) * Math.PI * 2, 0)
      const next = angle + (v / total) * Math.PI * 2
      const x1 = cx + radius * Math.cos(angle), y1 = cy + radius * Math.sin(angle)
      const x2 = cx + radius * Math.cos(next), y2 = cy + radius * Math.sin(next)
      const path = v / total > 0.999 ? `M ${cx} ${cy-radius} A ${radius} ${radius} 0 1 1 ${cx-0.01} ${cy-radius} Z` : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${next-angle > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`
      const result = { path, label: contentText(rows[i]?.[xKey] ?? `Item ${i + 1}`), value: v }
      return result
    })
    return <figure className="content-chart"><figcaption>{block.title || block.alt || 'Chart'}</figcaption><svg viewBox="0 0 420 300" role="img" aria-label={block.alt || block.title || 'Pie chart'}>{slices.map((slice, i) => <g key={i}><path d={slice.path} fill={`hsl(${(i * 67) % 360} 58% 52%)`} stroke="currentColor" strokeWidth="1"/><text x="300" y={35 + i * 23} fontSize="12">{slice.label}: {slice.value}</text></g>)}</svg></figure>
  }
  return <figure className="content-chart"><figcaption>{block.title || block.alt || 'Chart'}</figcaption><div className="content-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={block.alt || block.title || `${block.chartType} chart`}>
    {[0, .25, .5, .75, 1].map((fraction) => { const y = top + fraction * plotH; const v = max - fraction * range; return <g key={fraction}><line x1={left} y1={y} x2={width-right} y2={y} stroke="currentColor" opacity=".16"/><text x={left-8} y={y+4} textAnchor="end" fontSize="10" fill="currentColor">{Number(v.toFixed(3))}</text></g> })}
    <line x1={left} y1={top} x2={left} y2={top+plotH} stroke="currentColor"/><line x1={left} y1={top+plotH} x2={width-right} y2={top+plotH} stroke="currentColor"/>
    {series.map((item, si) => {
      const points = rows.map((row, i) => ({ x: rows.length === 1 ? left + plotW/2 : left + (i/(rows.length-1))*plotW, y: yAt(Number(row?.[item.dataKey])), valid: Number.isFinite(Number(row?.[item.dataKey])) }))
      const valid = points.filter((point) => point.valid)
      if (block.chartType === 'bar') {
        const slot = plotW / Math.max(1, rows.length), barW = Math.max(2, slot / (series.length + 1))
        return <g key={item.dataKey}>{points.map((point, i) => point.valid && <rect key={i} x={left + i*slot + si*barW} y={point.y} width={barW-2} height={Math.max(1, top+plotH-point.y)} fill={`hsl(${(si*73+205)%360} 58% 48%)`}><title>{`${contentText(rows[i]?.[xKey])}: ${rows[i][item.dataKey]}`}</title></rect>)}</g>
      }
      return <g key={item.dataKey}><polyline points={valid.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={`hsl(${(si*73+205)%360} 58% 42%)`} strokeWidth="2.5"/>{valid.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="3.5" fill={`hsl(${(si*73+205)%360} 58% 42%)`}/>)}</g>
    })}
    {rows.map((row, i) => <text key={i} x={xAt(i)} y={height-18} textAnchor="middle" fontSize="10" fill="currentColor">{contentText(row?.[xKey]).slice(0, 12)}</text>)}
  </svg></div><div className="content-chart-legend">{series.map((item, i) => <span key={item.dataKey}><i style={{ background: `hsl(${(i*73+205)%360} 58% 48%)` }} />{item.label || item.dataKey}</span>)}</div></figure>
}

function ContentBlock({ block, index }) {
  const key = block.id || `${block.type}-${index}`
  const value = contentText(block.value ?? block.text)
  if (block.type === 'text' || block.type === 'paragraph') return <p key={key} className={block.role ? `content-${block.role}` : undefined}>{value}</p>
  if (block.type === 'heading') {
    const level = Math.max(2, Math.min(6, Number(block.level) || 3))
    return React.createElement(`h${level}`, { key, className: 'content-heading' }, value)
  }
  if (block.type === 'assertion') return <div className="assertion-reason-content" key={key}><strong>Assertion (A)</strong><p>{value || 'Assertion text is not supplied in the question paper.'}</p></div>
  if (block.type === 'reason') return <div className="assertion-reason-content" key={key}><strong>Reason (R)</strong><p>{value || 'Reason text is not supplied in the question paper.'}</p></div>
  if (block.type === 'math') return <div className="content-math" key={key}><LatexMath value={value} format={block.format} display={block.display || 'block'} /></div>
  if (block.type === 'code') return <pre className="content-code" key={key}><code>{value}</code></pre>
  if (block.type === 'image' || block.type === 'diagram') return <figure className="content-image" key={key}>{(block.assetUrl || block.assetRef || block.src) ? <img src={block.assetUrl || block.assetRef || block.src} alt={block.alt || (block.type === 'diagram' ? 'Question diagram' : 'Question illustration')} /> : <figcaption>{block.alt || 'Image referenced in source but asset is unavailable.'}</figcaption>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>
  if (block.type === 'table') return <RichTable key={key} block={block} />
  if (block.type === 'chart') return <DataChart key={key} block={block} />
  if (block.type === 'list') { const Tag = block.ordered ? 'ol' : 'ul'; return <Tag key={key}>{(block.items || []).map((item, i) => <li key={i}>{contentText(item)}</li>)}</Tag> }
  if (block.type === 'quote') return <blockquote key={key}>{value}</blockquote>
  if (block.type === 'callout') return <aside key={key} className={`content-callout content-callout-${block.tone || 'info'}`}>{value}</aside>
  if (block.type === 'audio' && (block.assetUrl || block.assetRef || block.src)) return <audio key={key} controls preload="metadata" src={block.assetUrl || block.assetRef || block.src}>{block.alt || 'Audio content'}</audio>
  if (block.type === 'video' && (block.assetUrl || block.assetRef || block.src)) return <video key={key} controls preload="metadata" src={block.assetUrl || block.assetRef || block.src} aria-label={block.alt || 'Video content'} />
  if (block.type === 'link' && block.href) return <a key={key} href={block.href} target="_blank" rel="noreferrer">{block.label || value || block.href}</a>
  if (block.type === 'separator') return <hr key={key} />
  if (block.type === 'page-break') return <div key={key} className="content-page-break" aria-hidden="true" />
  if (block.type === 'group') return <div key={key} className={block.className || 'content-group'}>{(block.blocks || []).map((child, i) => <ContentBlock key={child.id || i} block={child} index={i} />)}</div>
  if (block.type === 'file') return <div key={key} className="content-unknown">{block.label || block.fileName || 'Attached source file'}{block.assetUrl && <> — <a href={block.assetUrl} target="_blank" rel="noreferrer">Open attachment</a></>}</div>
  return <div key={key} className="content-unknown" data-source-content-type={block.originalType || block.type}><strong>Source content retained</strong>{block.originalType && <span> (type: {block.originalType})</span>}{value && <p>{value}</p>}{(block.assetUrl || block.assetRef || block.src) && <img src={block.assetUrl || block.assetRef || block.src} alt={block.alt || 'Unrecognized source content'} />}</div>
}

export function ContentBlocks({ content }) {
  const normalized = normalizeRichContent(content)
  const blocks = normalized.blocks || []
  if (!blocks.length) return null
  return <>{blocks.map((block, index) => <ContentBlock key={block.id || `${block.type}-${index}`} block={block} index={index} />)}</>
}

export function QuestionContent({ question }) {
  const content = question.content || {}
  if (Array.isArray(content.blocks) && content.blocks.length) return <ContentBlocks content={content} />
  return <ContentBlocks content={content} />
}
