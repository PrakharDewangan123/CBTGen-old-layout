import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import '../styles/ExamLogin.css'

function ExamLogin() {
  const navigate = useNavigate()

  const [candidate, setCandidate] = useState({
    name: 'CBTGen Student',
    examName: 'CBT Examination',
    systemName: 'C001',
    candidateId: '11111',
  })

  const [password, setPassword] = useState('12345678')
  const [activeField, setActiveField] = useState('candidateId')
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [nativeInputEnabled, setNativeInputEnabled] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)')
    const updateInputMode = () => setNativeInputEnabled(mediaQuery.matches)

    updateInputMode()
    mediaQuery.addEventListener?.('change', updateInputMode)

    return () => mediaQuery.removeEventListener?.('change', updateInputMode)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadExamIdentity() {
      try {
        const rawSession = sessionStorage.getItem('cbtgen_active_session')
        const session = rawSession ? JSON.parse(rawSession) : null

        const [userResult, qpResult] = await Promise.all([
          cbtgenApi.auth.getCurrentUser().catch(() => null),
          session?.qpId
            ? cbtgenApi.questionPapers.get(session.qpId).catch(() => null)
            : null,
        ])

        if (cancelled) return

        let storedExamUser = null
        try {
          const rawExamUser = sessionStorage.getItem('cbtgen_exam_user')
          storedExamUser = rawExamUser ? JSON.parse(rawExamUser) : null
        } catch {
          storedExamUser = null
        }

        const user = userResult?.user || userResult || storedExamUser || null
        const qp = qpResult?.questionPaper || null

        setCandidate((current) => ({
          ...current,
          name: user?.name || user?.candidateName || current.name,
          candidateId:
            user?.candidateId ||
            storedExamUser?.candidateId ||
            current.candidateId,
          examName: qp?.name || current.examName,
        }))

        if (userResult) {
          sessionStorage.setItem(
            'cbtgen_exam_user',
            JSON.stringify(userResult?.user || userResult),
          )
        }

        if (qp) {
          sessionStorage.setItem(
            'cbtgen_active_qp_meta',
            JSON.stringify(qp),
          )
        }
      } catch (error) {
        console.error('Unable to load exam identity:', error)
      }
    }

    loadExamIdentity()

    return () => {
      cancelled = true
    }
  }, [])

  const maskedPassword = useMemo(
    () => '•'.repeat(Math.max(1, password.length)),
    [password.length],
  )

  function updateActiveField(value) {
    if (activeField === 'password') {
      setPassword(value)
      return
    }

    setCandidate((current) => ({
      ...current,
      candidateId: value,
    }))
  }

  function getActiveValue() {
    return activeField === 'password'
      ? password
      : candidate.candidateId
  }

  function handleKeyboardKey(key) {
    const currentValue = getActiveValue()

    if (key === 'BACKSPACE') {
      updateActiveField(currentValue.slice(0, -1))
      return
    }

    if (key === 'CLEAR') {
      updateActiveField('')
      return
    }

    if (key === 'SPACE') {
      updateActiveField(`${currentValue} `)
      return
    }

    if (key === 'ENTER') {
      setKeyboardOpen(false)
      return
    }

    if (key === 'TAB' || key === 'CAPS' || key === 'SHIFT' || key === 'CTRL' || key === 'ALT' || key === 'CMD') {
      return
    }

    updateActiveField(`${currentValue}${key}`)
  }

  function signIn(event) {
    event.preventDefault()

    const loggedInAt = new Date().toISOString()

    sessionStorage.setItem(
      'cbtgen_exam_login',
      JSON.stringify({
        loggedIn: true,
        candidateId: candidate.candidateId,
        candidateName: candidate.name,
        examName: candidate.examName,
        loggedInAt,
      }),
    )

    navigate('/test-instructions')
  }

  function focusField(field) {
    setActiveField(field)
    setKeyboardOpen(true)
  }

  return (
    <div className="exam-login-page">
      <div className="exam-login-shell">
        <header className="exam-login-header">
          <img src="/cbtgen-monogram-dark.png" alt="" aria-hidden="true" className="exam-brand-mark" />
          <span>CBTGen</span>
        </header>

        <section className="exam-candidate-band">
          <div className="candidate-system-details">
            <div className="candidate-label">System Name :</div>
            <div className="candidate-system-code">{candidate.systemName}</div>
            <div className="candidate-warning">
              Kindly contact the invigilator if there are any discrepancies in the
              Name and Photograph displayed on the screen or if the photograph is
              not yours
            </div>
          </div>

          <div className="candidate-name-details">
            <div className="candidate-label candidate-label-right">
              Candidate Name :
            </div>

            <div className="candidate-name-value">
              {candidate.name}
            </div>

            <div className="candidate-exam-block">
              <div className="candidate-label candidate-exam-label">Exam :</div>
              <div className="candidate-exam-value">
                {candidate.examName}
              </div>
            </div>
          </div>

          <div className="candidate-avatar-panel">
            <CandidateAvatar className="exam-login-avatar" />
          </div>
        </section>

        <main className="exam-login-main">
          <div className="exam-login-stage">
            <section className="exam-login-card">
              <div className="exam-login-card-header">Login</div>

              <form onSubmit={signIn}>
                <LoginField
                  icon={<UserIcon />}
                  value={candidate.candidateId}
                  ariaLabel="Candidate ID"
                  type="text"
                  active={activeField === 'candidateId'}
                  nativeInputEnabled={nativeInputEnabled}
                  onChange={(event) => {
                    setCandidate((current) => ({
                      ...current,
                      candidateId: event.target.value,
                    }))
                  }}
                  onFocus={() => focusField('candidateId')}
                  onKeyboard={() => {
                    setActiveField('candidateId')
                    if (nativeInputEnabled) {
                      return
                    }
                    setKeyboardOpen((value) => !value)
                  }}
                />

                <LoginField
                  icon={<LockIcon />}
                  value={nativeInputEnabled ? password : maskedPassword}
                  ariaLabel="Password"
                  type={nativeInputEnabled ? 'password' : 'text'}
                  active={activeField === 'password'}
                  nativeInputEnabled={nativeInputEnabled}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => focusField('password')}
                  onKeyboard={() => {
                    setActiveField('password')
                    if (nativeInputEnabled) {
                      return
                    }
                    setKeyboardOpen((value) => !value)
                  }}
                />

                <button type="submit" className="exam-sign-in-button">
                  Sign In
                </button>
              </form>
            </section>

            {keyboardOpen && (
              <VirtualKeyboard
                onKey={handleKeyboardKey}
                onClose={() => setKeyboardOpen(false)}
              />
            )}
          </div>
        </main>

        <footer className="exam-login-footer">CBTGen</footer>
      </div>
    </div>
  )
}

function LoginField({
  icon,
  value,
  ariaLabel,
  type,
  active,
  nativeInputEnabled,
  onChange,
  onFocus,
  onKeyboard,
}) {
  const inputRef = useRef(null)
  return (
    <div className={`exam-login-field ${active ? 'is-active' : ''}`}>
      <span className="exam-login-field-icon">{icon}</span>

      <input
        ref={inputRef}
        type={type}
        value={value}
        aria-label={ariaLabel}
        readOnly={!nativeInputEnabled}
        onChange={onChange}
        onFocus={onFocus}
        onClick={onFocus}
      />

      <button
        type="button"
        className="exam-login-keyboard"
        aria-label={`Open virtual keyboard for ${ariaLabel}`}
        onClick={() => {
          if (nativeInputEnabled) {
            inputRef.current?.focus()
            return
          }
          onKeyboard()
        }}
      >
        <KeyboardIcon />
      </button>
    </div>
  )
}

function VirtualKeyboard({ onKey, onClose }) {
  const rows = [
    [
      { label: 'Esc', key: 'ESC', className: 'key-esc' },
      { label: '`', key: '`' },
      { label: '1', key: '1' },
      { label: '2', key: '2' },
      { label: '3', key: '3' },
      { label: '4', key: '4' },
      { label: '5', key: '5' },
      { label: '6', key: '6' },
      { label: '7', key: '7' },
      { label: '8', key: '8' },
      { label: '9', key: '9' },
      { label: '0', key: '0' },
      { label: '-', key: '-' },
      { label: '=', key: '=' },
      { label: 'Delete', key: 'BACKSPACE', className: 'key-delete' },
    ],
    [
      { label: 'Tab', key: 'TAB', className: 'key-tab' },
      ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => ({ label: key, key })),
      { label: '[', key: '[' },
      { label: ']', key: ']' },
      { label: '\\', key: '\\' },
    ],
    [
      { label: 'Caps', key: 'CAPS', className: 'key-caps' },
      ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => ({ label: key, key })),
      { label: ';', key: ';' },
      { label: "'", key: "'" },
      { label: 'Return', key: 'ENTER', className: 'key-return' },
    ],
    [
      { label: 'Shift', key: 'SHIFT', className: 'key-shift' },
      ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => ({ label: key, key })),
      { label: ',', key: ',' },
      { label: '.', key: '.' },
      { label: '/', key: '/' },
      { label: 'Shift', key: 'SHIFT', className: 'key-shift' },
    ],
    [
      { label: 'Ctrl', key: 'CTRL', className: 'key-modifier' },
      { label: 'Alt', key: 'ALT', className: 'key-modifier' },
      { label: '⌘', key: 'CMD', className: 'key-modifier' },
      { label: 'Space', key: 'SPACE', className: 'key-space' },
      { label: '⌘', key: 'CMD', className: 'key-modifier' },
      { label: 'Alt', key: 'ALT', className: 'key-modifier' },
      { label: '←', key: 'ARROW_LEFT', className: 'key-arrow' },
      { label: '↑', key: 'ARROW_UP', className: 'key-arrow' },
      { label: '↓', key: 'ARROW_DOWN', className: 'key-arrow' },
      { label: '→', key: 'ARROW_RIGHT', className: 'key-arrow' },
    ],
  ]

  return (
    <div
      className="exam-virtual-keyboard"
      role="dialog"
      aria-label="Virtual keyboard"
    >
      <div className="exam-virtual-keyboard-header">
        <strong>Keyboard</strong>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close virtual keyboard"
        >
          ×
        </button>
      </div>

      <div className="exam-virtual-keyboard-body">
        {rows.map((row, rowIndex) => (
          <div className="exam-keyboard-row" key={rowIndex}>
            {row.map((item, index) => (
              <button
                type="button"
                key={`${item.key}-${index}`}
                className={item.className || ''}
                onClick={() => onKey(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}

        <div className="exam-keyboard-extra-row">
          <button type="button" onClick={() => onKey('CLEAR')}>
            Clear
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5.5 20c.5-4.1 2.8-6.2 6.5-6.2s6 2.1 6.5 6.2" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="10" rx="1.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect x="1" y="2" width="28" height="16" rx="1.5" />
      <path d="M5 6h2M10 6h2M15 6h2M20 6h2M25 6h1M5 10h2M10 10h2M15 10h2M20 10h2M25 10h1M5 14h12M19 14h6" />
    </svg>
  )
}

function CandidateAvatar({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 140"
      role="img"
      aria-label="Default candidate avatar"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="loginAvatarHair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dce5eb" />
          <stop offset="0.38" stopColor="#60788e" />
          <stop offset="1" stopColor="#172d43" />
        </linearGradient>
        <radialGradient id="loginAvatarSkin" cx="50%" cy="38%" r="65%">
          <stop offset="0" stopColor="#f7fafb" />
          <stop offset="0.68" stopColor="#d7e0e5" />
          <stop offset="1" stopColor="#9aabb7" />
        </radialGradient>
        <linearGradient id="loginAvatarClothes" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9eff2" />
          <stop offset="1" stopColor="#879aa8" />
        </linearGradient>
      </defs>

      <ellipse cx="60" cy="47" rx="30" ry="37" fill="url(#loginAvatarSkin)" stroke="#718695" strokeWidth="1.2" />
      <path d="M31 48 C26 29 30 14 44 8 C57 2 75 7 84 18 C90 26 91 39 86 51 L80 40 C74 29 65 23 55 23 C45 23 37 30 32 41 Z" fill="url(#loginAvatarHair)" stroke="#31495d" strokeWidth="1.2" />
      <path d="M33 38 C39 25 49 19 60 19 C71 19 79 25 84 36 C77 29 69 26 60 26 C50 26 41 30 33 38 Z" fill="#8296a5" opacity=".45" />
      <ellipse cx="49" cy="48" rx="2" ry="1.4" fill="#667987" />
      <ellipse cx="71" cy="48" rx="2" ry="1.4" fill="#667987" />
      <path d="M55 62 Q60 65 65 62" fill="none" stroke="#81919b" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M48 78 L48 91 Q60 99 72 91 L72 78 Z" fill="url(#loginAvatarSkin)" stroke="#8396a3" strokeWidth="1" />
      <path d="M48 87 C31 90 17 101 12 119 L8 140 L112 140 L108 119 C103 101 89 90 72 87 C69 94 65 98 60 98 C55 98 51 94 48 87 Z" fill="url(#loginAvatarClothes)" stroke="#718594" strokeWidth="1.2" />
      <path d="M48 88 L60 101 L72 88" fill="#f5f8fa" stroke="#9aaab4" strokeWidth="1" />
      <path d="M60 100 L53 140 L67 140 Z" fill="#c5d0d7" opacity=".75" />
    </svg>
  )
}

export default ExamLogin
