import React from 'react'
import { optionLabel, textFromContent } from '../examEngine/examUtils'
import { ContentBlocks } from '../components/ContentRenderer'

export function ResponseBlock({ children }) {
  return (
    <div className="response-block">
      <strong>Response</strong>
      {children}
    </div>
  )
}

export function ChoiceResponse({ question, value, onChange, multi = false, withResponseBlock = true }) {
  const options = question.response?.options || []
  const selected = Array.isArray(value) ? value : value == null ? [] : [value]

  const choices = (
    <>
      {options.map((option, index) => {
        const checked = selected.includes(option.id)
        const images = Array.isArray(option.content?.images) ? option.content.images : []
        return (
          <label className={'option ' + (checked ? 'checked' : '')} key={option.id}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              checked={checked}
              onChange={() => {
                if (multi) {
                  const next = checked ? selected.filter(id => id !== option.id) : [...selected, option.id]
                  onChange(next)
                } else {
                  onChange(option.id)
                }
              }}
            />
            <div className="option-content">
              {optionLabel(option, index)}.
              {Array.isArray(option.content?.blocks) && option.content.blocks.length ? (
                <ContentBlocks content={option.content} />
              ) : (
                <>
                  &nbsp;{textFromContent(option.content)}
                  {images.map((image, imageIndex) => (
                    <img
                      key={`${option.id}-image-${imageIndex}`}
                      src={image.assetUrl || image.assetRef}
                      alt={image.alt || 'Option illustration'}
                      className="content-image"
                    />
                  ))}
                </>
              )}
            </div>
          </label>
        )
      })}
    </>
  )

  return withResponseBlock ? <ResponseBlock>{choices}</ResponseBlock> : choices
}

export function NumericResponse({ value, onChange, placeholder = 'Enter your answer', showKeypad = false }) {
  const inputRef = React.useRef(null)
  const currentValue = String(value ?? '')

  const pressKey = key => {
    const input = inputRef.current
    const start = input?.selectionStart ?? currentValue.length
    const end = input?.selectionEnd ?? start

    if (/^[0-9]$/.test(key)) {
      const next = currentValue.slice(0, start) + key + currentValue.slice(end)
      onChange(next)
      window.requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(start + 1, start + 1)
      })
      return
    }

    if (key === '.' && !currentValue.includes('.')) {
      const next = currentValue.slice(0, start) + '.' + currentValue.slice(end)
      onChange(next)
      window.requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(start + 1, start + 1)
      })
      return
    }

    if (key === '-' && start === 0 && !currentValue.includes('-')) {
      const next = '-' + currentValue
      onChange(next)
      window.requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(1, 1)
      })
      return
    }

    if (key === '⌫') {
      if (start !== end) {
        const next = currentValue.slice(0, start) + currentValue.slice(end)
        onChange(next)
        window.requestAnimationFrame(() => {
          input?.focus()
          input?.setSelectionRange(start, start)
        })
      } else if (start > 0) {
        const next = currentValue.slice(0, start - 1) + currentValue.slice(start)
        onChange(next)
        window.requestAnimationFrame(() => {
          input?.focus()
          input?.setSelectionRange(start - 1, start - 1)
        })
      }
      return
    }

    if (key === '←') {
      const next = Math.max(0, start - 1)
      input?.focus()
      input?.setSelectionRange(next, next)
      return
    }

    if (key === '→') {
      const next = Math.min(currentValue.length, end + 1)
      input?.focus()
      input?.setSelectionRange(next, next)
      return
    }

    if (key === 'Clear All') {
      onChange('')
      window.requestAnimationFrame(() => {
        input?.focus()
        input?.setSelectionRange(0, 0)
      })
    }
  }

  return (
    <ResponseBlock>
      <div className={showKeypad ? 'numeric-response-with-keypad' : undefined}>
        <input
          ref={inputRef}
          className="text-response numeric-response-display"
          type="text"
          inputMode="none"
          readOnly={showKeypad}
          value={currentValue}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Numerical answer"
        />
        {showKeypad && (
          <div className="numeric-keypad" aria-label="Numerical answer keypad">
            <button type="button" className="numeric-keypad-wide" onClick={() => pressKey('⌫')}>Backspace</button>
            <button type="button" onClick={() => pressKey('7')}>7</button>
            <button type="button" onClick={() => pressKey('8')}>8</button>
            <button type="button" onClick={() => pressKey('9')}>9</button>
            <button type="button" onClick={() => pressKey('4')}>4</button>
            <button type="button" onClick={() => pressKey('5')}>5</button>
            <button type="button" onClick={() => pressKey('6')}>6</button>
            <button type="button" onClick={() => pressKey('1')}>1</button>
            <button type="button" onClick={() => pressKey('2')}>2</button>
            <button type="button" onClick={() => pressKey('3')}>3</button>
            <button type="button" onClick={() => pressKey('0')}>0</button>
            <button type="button" onClick={() => pressKey('.')}>.</button>
            <button type="button" onClick={() => pressKey('-')}>-</button>
            <button type="button" onClick={() => pressKey('←')}>←</button>
            <button type="button" onClick={() => pressKey('→')}>→</button>
            <button type="button" className="numeric-keypad-wide" onClick={() => pressKey('Clear All')}>Clear All</button>
          </div>
        )}
      </div>
    </ResponseBlock>
  )
}

export function TextResponse({ value, onChange, multiline = false }) {
  return (
    <ResponseBlock>
      {multiline ? (
        <textarea className="text-response" rows={6} value={value ?? ''} onChange={event => onChange(event.target.value)} />
      ) : (
        <input className="text-response" type="text" value={value ?? ''} onChange={event => onChange(event.target.value)} />
      )}
    </ResponseBlock>
  )
}
