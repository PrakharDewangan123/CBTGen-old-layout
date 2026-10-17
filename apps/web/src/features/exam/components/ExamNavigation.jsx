import { useCallback, useEffect, useRef, useState } from 'react'
import { InfoIcon } from './ExamUi'
export function ScrollArrow({ direction, onClick, className = '' }) {
  return (
    <button type="button" className={'strip-arrow ' + direction + ' ' + className} onClick={onClick} aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}>
      <span aria-hidden="true">{direction === 'left' ? '◀' : '▶'}</span>
    </button>
  )
}

function estimateStripButtonWidth(item, isSection = false) {
  const text = String(isSection ? (item?.name || item?.short || '') : (item?.name || ''))
  // The width is intentionally content-driven.  The real browser font is
  // approximately 7px/character at this size; the remaining space is for
  // padding + the circular info icon.
  const content = text.length * 7
  if (text.length <= 12) return Math.max(105, Math.ceil(content + 42))
  if (text.length <= 24) return Math.max(125, Math.ceil(content + 42))
  return Math.min(230, Math.max(145, Math.ceil(content + 42)))
}

function buildStripRows(items, availableWidth, activeId, isSection = false, gap = 5) {
  // Defensive normalization: strip data can briefly contain an undefined item
  // while the examination paper is being reconciled. Never let one bad entry
  // crash the entire Examination screen.
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!safeItems.length || !availableWidth) return []

  const desired = safeItems.map(item => estimateStripButtonWidth(item, isSection))
  const minButton = 86

  // First determine the smallest row count for which the buttons can all fit.
  // A row may compress long/medium labels, but never below the readable
  // minimum.  This is the important part: we never render overflowing rows.
  let selectedRows = null
  for (let rowCount = 1; rowCount <= safeItems.length; rowCount += 1) {
    const columns = Math.ceil(safeItems.length / rowCount)
    const usable = availableWidth - Math.max(0, columns - 1) * gap
    if (usable / columns < minButton) continue

    const rows = []
    for (let i = 0; i < safeItems.length; i += columns) rows.push(safeItems.slice(i, i + columns))
    selectedRows = rows
    break
  }

  if (!selectedRows) selectedRows = safeItems.map(item => [item])

  // Put the active row at the bottom, preserving the order of every other
  // item. This is the funnel behavior used by the CBT strip.
  const activeIndex = selectedRows.findIndex(row => row.some(item => item.id === activeId))
  if (activeIndex > -1 && activeIndex !== selectedRows.length - 1) {
    selectedRows = [
      ...selectedRows.slice(0, activeIndex),
      ...selectedRows.slice(activeIndex + 1),
      selectedRows[activeIndex],
    ]
  }

  return selectedRows.map(row => {
    const rawTotal = row.reduce((sum, item) => sum + desired[safeItems.indexOf(item)], 0)
    const totalGap = Math.max(0, row.length - 1) * gap
    const availableForButtons = Math.max(0, availableWidth - totalGap)

    // Natural/content width when it fits. Otherwise compress proportionally,
    // which causes the text span to ellipsize instead of overlapping neighbors.
    const scale = rawTotal > availableForButtons ? availableForButtons / rawTotal : 1
    return row.map(item => ({
      item,
      width: Math.max(minButton, Math.floor(desired[safeItems.indexOf(item)] * scale)),
    }))
  })
}

function buildMobileStripRow(items, isSection = false) {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean)
  return [safeItems.map(item => {
    const desired = estimateStripButtonWidth(item, isSection)
    return {
      item,
      // Portrait/mobile is one continuous ordered strip. Keep each control
      // compact enough to show several at once while allowing horizontal
      // scrolling for the remaining controls.
      width: Math.max(76, Math.min(132, Math.ceil(desired * 0.66))),
    }
  })]
}

function useFunnelRows(items, activeId, containerRef, isSection = false, gap = 5) {
  const [rows, setRows] = useState([])

  const recalc = useCallback(() => {
    const width = containerRef.current?.clientWidth || 0
    if (!width) return

    // Desktop/tablet-landscape keeps the approved funnel-row calculation.
    // Portrait/mobile must stay one ordered horizontal sequence. The desktop
    // active-row-to-bottom rule was the cause of Section 1 / the active
    // subject being moved to the end of the strip with a large visual gap.
    const isPortraitOrMobile = window.innerWidth < 1024
    setRows(
      isPortraitOrMobile
        ? buildMobileStripRow(items, isSection)
        : buildStripRows(items, width, activeId, isSection, gap),
    )
  }, [containerRef, items, activeId, isSection, gap])

  useEffect(() => {
    recalc()
    const node = containerRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(recalc)
    observer.observe(node)
    window.addEventListener('resize', recalc)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [recalc, containerRef])

  // Portrait/mobile must keep the currently selected subject/section visible
  // when it is outside the viewport, but must NOT recenter it. Re-centering
  // changes the physical position of the selected button after every click,
  // which can make a candidate lose track of which subject/section is active.
  // `inline: 'nearest'` scrolls only as much as necessary and otherwise leaves
  // the strip exactly where the candidate was looking.
  // This branch never runs on desktop/tablet-landscape, so those layouts are untouched.
  useEffect(() => {
    if (window.innerWidth >= 1024 || !rows.length) return undefined
    const frame = window.requestAnimationFrame(() => {
      const selected = containerRef.current?.querySelector('.selected')
      selected?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [rows, activeId, containerRef])

  return { rows, recalc }
}

export function SubjectButtons({ countsBySubject, subjects, activeSubjectName, onSelectSubject, onCalculator }) {
  const scrollRef = useRef(null)
  const activeSubject = subjects.find(subject => subject.name === activeSubjectName) || subjects[0]
  const { rows } = useFunnelRows(subjects, activeSubject?.id, scrollRef, false, 5)
  const scroll = amount => scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })

  return (
    <div className="subject-row">
      <ScrollArrow direction="left" onClick={() => scroll(-180)} className="subject-arrow-left" />
      <div ref={scrollRef} className="subject-buttons" role="tablist" aria-label="Subjects">
        <div className="funnel-rows">
          {rows.map((row, rowIndex) => (
            <div className="button-row" key={'subject-row-' + rowIndex}>
              {row.filter(Boolean).map(({ item: subject, width }) => (
                <button
                  key={subject.id}
                  className={'subject-button ' + (activeSubject?.id === subject.id ? 'selected' : '')}
                  style={{ width }}
                  data-tooltip={subject.name}
                  title={subject.name}
                  type="button"
                  onClick={() => subject.firstSectionId && onSelectSubject(subject.firstSectionId)}
                >
                  <span>{subject.name}</span>
                  <span className="nav-name-tooltip" aria-hidden="true">{subject.name}</span>
                  <InfoIcon counts={countsBySubject[subject.id] || { a: 0, na: 0, nv: 0, r: 0, ar: 0 }} />
                  {activeSubject?.id === subject.id && <span className="subject-funnel" aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ScrollArrow direction="right" onClick={() => scroll(180)} className="subject-arrow-right" />
      <button className="calculator" aria-label="Calculator" type="button" onClick={onCalculator}>
        <span className="calculator-icon" aria-hidden="true">
          <span className="calc-display" />
          <span className="calc-keys">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</span>
        </span>
      </button>
    </div>
  )
}
export function SectionButtons({ sections, activeSection, countsBySection, onSelect }) {
  const scrollRef = useRef(null)
  const { rows } = useFunnelRows(sections, activeSection, scrollRef, true, 5)
  const scroll = amount => scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' })

  return (
    <div className="tabs">
      <ScrollArrow direction="left" onClick={() => scroll(-180)} className="section-arrow-left" />
      <div ref={scrollRef} className="section-buttons">
        <div className="funnel-rows">
          {rows.map((row, rowIndex) => (
            <div className="button-row" key={'section-row-' + rowIndex}>
              {row.filter(Boolean).map(({ item: section, width }) => (
                <button key={section.id} className={'section-tab ' + (activeSection === section.id ? 'selected' : '')} style={{ width }} data-tooltip={section.name} title={section.name} onClick={() => onSelect(section.id)}>
                  <span>{section.short}</span><span className="nav-name-tooltip" aria-hidden="true">{section.name}</span> <InfoIcon counts={countsBySection[section.id] || { a: 0, na: 0, nv: 0, r: 0, ar: 0 }} />
                  {activeSection === section.id && <span className="section-funnel" aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ScrollArrow direction="right" onClick={() => scroll(180)} className="section-arrow-right" />
    </div>
  )
}
