import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateAvatar from './CandidateAvatar'

// Exit a broken/unrecoverable exam attempt without leaving the exam-mode route guard active.
// This only clears transient session state; imported papers in IndexedDB are untouched.
function clearBrokenExamSession() {
  const keys = [
    'cbtgen_exam_mode',
    'cbtgen_exam_runtime',
    'cbtgen_active_session',
    'cbtgen_exam_state',
    'cbtgen_test_configuration',
    'cbtgen_exam_login',
    'cbtgen_test_started_at',
    'cbtgen_active_usage',
  ]
  keys.forEach((key) => sessionStorage.removeItem(key))
}

export { CandidateAvatar }

export function InfoAction({ icon, mobileIcon, label, onClick }) {
  return (
    <button className="info-action" aria-label={label} onClick={onClick}>
      <span className="info-action-desktop-icon" aria-hidden="true">{icon}</span>
      <span className="info-action-mobile-icon" aria-hidden="true">{mobileIcon || icon}</span>
      <span className="info-action-label">{label}</span>
    </button>
  )
}

export function InfoIcon({ counts }) {
  const iconRef = useRef(null)
  const closeTimerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const updatePosition = () => {
    const rect = iconRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(330, Math.max(260, window.innerWidth - 20))
    const left = Math.min(
      Math.max(8, rect.left - 3),
      Math.max(8, window.innerWidth - width - 8),
    )
    const top = Math.min(
      rect.bottom + 7,
      Math.max(8, window.innerHeight - 220),
    )
    setPosition({ left, top: Math.max(8, top) })
  }

  const openPopup = event => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    clearCloseTimer()
    updatePosition()
    setOpen(true)
  }

  const closePopupSoon = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 140)
  }

  useEffect(() => () => clearCloseTimer(), [])

  useEffect(() => {
    if (!open) return undefined
    const reposition = () => updatePosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  return (
    <span
      ref={iconRef}
      className="info-icon"
      tabIndex={0}
      aria-label="Show attempt details"
      role="button"
      onPointerDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onMouseEnter={openPopup}
      onMouseLeave={closePopupSoon}
      onFocus={openPopup}
      onBlur={closePopupSoon}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        clearCloseTimer()
        if (open) setOpen(false)
        else openPopup(event)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          clearCloseTimer()
          if (open) setOpen(false)
          else openPopup(event)
        }
      }}
    >
      i
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="info-popup info-popup-portal"
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closePopupSoon}
          onPointerDown={event => event.stopPropagation()}
        >
          <strong>Attempt details</strong>
          <span><Badge cls="a" n={counts.a} /> Answered</span>
          <span><Badge cls="na" n={counts.na} /> Not Answered</span>
          <span><Badge cls="nv" n={counts.nv} /> Not Visited</span>
          <span><Badge cls="r" n={counts.r} /> Marked for Review</span>
          <span><Badge cls="ar" n={counts.ar} /> Answered &amp; Marked for Review</span>
        </div>,
        document.body,
      )}
    </span>
  )
}

export function InfoPopup({ counts }) {
  return (
    <span className="info-popup" role="tooltip">
      <strong>Attempt details</strong>
      <span><Badge cls="a" n={counts.a} /> Answered</span>
      <span><Badge cls="na" n={counts.na} /> Not Answered</span>
      <span><Badge cls="nv" n={counts.nv} /> Not Visited</span>
      <span><Badge cls="r" n={counts.r} /> Marked for Review</span>
      <span><Badge cls="ar" n={counts.ar} /> Answered &amp; Marked for Review</span>
    </span>
  )
}

export function Badge({ cls, n }) {
  return <span className={'badge ' + cls}><span className="badge-value">{n}</span></span>
}

export function Legend({ cls, n, t }) {
  return <div><Badge cls={cls} n={n} /><small>{t}</small></div>
}

export function InfoModal({ title, children, onClose }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <h3>{title}</h3>
        {children}
        <div><button className="primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

export function CalculatorModal({ value, setValue, memory, setMemory, onClose }) {
  const press = key => {
    if (/^[0-9.]$/.test(key)) {
      setValue(current => current === '0' ? key : current + key)
      return
    }
    if (['+', '-', '*', '/'].includes(key)) {
      setValue(current => current + key)
      return
    }
    if (key === 'C') setValue('0')
    else if (key === '⌫') setValue(current => current.length > 1 ? current.slice(0, -1) : '0')
    else if (key === '=') {
      try {
        if (!/^[0-9+\-*/().\s]+$/.test(value)) throw new Error('Invalid')
        const result = Function(`"use strict"; return (${value})`)()
        if (!Number.isFinite(result)) throw new Error('Invalid')
        setValue(String(result))
      } catch { setValue('Error') }
    }
  }

  return (
    <div className="modal-bg">
      <div className="modal calculator-modal">
        <h3>Calculator</h3>
        <input className="text-response" value={value} readOnly />
        <div className="calc-grid">
          {['MC','MR','M+','M-','C','⌫','/','*','7','8','9','-','4','5','6','+','1','2','3','(', '0','.','=',')'].map(key => (
            <button key={key} onClick={() => {
              if (key === 'MC') setMemory(null)
              else if (key === 'MR') setValue(memory ?? '0')
              else if (key === 'M+') setMemory(value)
              else if (key === 'M-') setMemory(null)
              else press(key)
            }}>{key}</button>
          ))}
        </div>
        <div><button className="primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}

export function LoadingScreen() {
  return <div className="cbt-exam-root exam-state-screen"><strong>Loading examination…</strong><span>Preparing the question paper and session.</span></div>
}

export function ErrorScreen({ message }) {
  const navigate = useNavigate()
  return (
    <div className="cbt-exam-root exam-state-screen">
      <strong>Unable to open examination</strong>
      <span>{message}</span>
      <button type="button" onClick={() => { clearBrokenExamSession(); navigate('/question-papers', { replace: true }) }}>Back to Question Papers</button>
    </div>
  )
}

export function SubmissionScreen({ questionCount, qpId }) {
  const navigate = useNavigate()
  return (
    <div className="cbt-exam-root exam-state-screen">
      <strong>Examination submitted</strong>
      <span>Your {questionCount}-question session has been recorded locally.</span>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => navigate(qpId ? `/question-papers/${qpId}/score` : '/exam-result')}>View Score</button>
        <button type="button" onClick={() => { clearBrokenExamSession(); navigate('/question-papers', { replace: true }) }}>Back to Question Papers</button>
      </div>
    </div>
  )
}
