
/**
 * Shared examination status controls.
 *
 * These use the same geometry/colors as the examination question-palette
 * badges: green answered, red not answered, grey not visited, purple review,
 * and purple + green indicator for answered/review.
 */
export function StatusBadge({ state, number }) {
  return (
    <span className={`exam-status-badge ${state || 'nv'}`} aria-hidden="true">
      <span className="exam-status-badge-shape">
        <span className="exam-status-badge-number">{number}</span>
      </span>
    </span>
  )
}

export function CollapseArrow({ collapsed, onClick }) {
  return (
    <button
      type="button"
      className={`reference-collapse-arrow ${collapsed ? 'is-collapsed' : ''}`}
      onClick={onClick}
      aria-label={collapsed ? 'Expand test summary' : 'Collapse test summary'}
      title={collapsed ? 'Expand' : 'Collapse'}
    >
      <span>{collapsed ? '‹' : '›'}</span>
    </button>
  )
}
