/**
 * CBTGen Question Type Registry
 *
 * `type` describes the semantic model of a question.
 * `responseMode` describes how the candidate interacts with it.
 *
 * This file is the single source of truth for:
 * - supported question types
 * - question families
 * - response modes
 * - option randomization capability
 * - automatic grading capability
 *
 * Source XML uses these values.
 * Validation, normalization, randomization and rendering
 * consume these definitions.
 */

export const QUESTION_TYPES = Object.freeze({
  // ─────────────────────────────────────────────
  // CHOICE
  // ─────────────────────────────────────────────

  MCQ: {
    family: 'CHOICE',
    responseMode: 'single-choice',
    randomizableOptions: true,
    autoGradable: true,
  },

  MSQ: {
    family: 'CHOICE',
    responseMode: 'multiple-select',
    randomizableOptions: true,
    autoGradable: true,
  },

  ASSERTION_REASON: {
    family: 'CHOICE',
    responseMode: 'single-choice',
    randomizableOptions: true,
    autoGradable: true,
  },

  TRUE_FALSE: {
    family: 'CHOICE',
    responseMode: 'single-choice',
    randomizableOptions: false,
    autoGradable: true,
  },

  YES_NO: {
    family: 'CHOICE',
    responseMode: 'single-choice',
    randomizableOptions: false,
    autoGradable: true,
  },

  // ─────────────────────────────────────────────
  // NUMERIC
  // ─────────────────────────────────────────────

  NAT: {
    family: 'NUMERIC',
    responseMode: 'numeric',
    randomizableOptions: false,
    autoGradable: true,
  },

  NUMERIC_RANGE: {
    family: 'NUMERIC',
    responseMode: 'numeric',
    randomizableOptions: false,
    autoGradable: true,
  },

  SLIDER: {
    family: 'NUMERIC',
    responseMode: 'slider',
    randomizableOptions: false,
    autoGradable: true,
  },

  // ─────────────────────────────────────────────
  // TEXT
  // ─────────────────────────────────────────────

  TEXT_SHORT: {
    family: 'TEXT',
    responseMode: 'text',
    randomizableOptions: false,
    autoGradable: false,
  },

  TEXT_LONG: {
    family: 'TEXT',
    responseMode: 'text',
    randomizableOptions: false,
    autoGradable: false,
  },

  FILL_BLANK: {
    family: 'TEXT',
    responseMode: 'text',
    randomizableOptions: false,
    autoGradable: false,
  },

  ESSAY: {
    family: 'TEXT',
    responseMode: 'text',
    randomizableOptions: false,
    autoGradable: false,
  },

  SUBJECTIVE: {
    family: 'TEXT',
    responseMode: 'text',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // SELECTION / MAPPING
  // ─────────────────────────────────────────────

  DROPDOWN: {
    family: 'SELECTION',
    responseMode: 'single-choice',
    randomizableOptions: true,
    autoGradable: true,
  },

  MATCH: {
    family: 'SELECTION',
    responseMode: 'mapping',
    randomizableOptions: false,
    autoGradable: true,
  },

  MATCH_MULTIPLE: {
    family: 'SELECTION',
    responseMode: 'mapping',
    randomizableOptions: false,
    autoGradable: true,
  },

  ORDERING: {
    family: 'SELECTION',
    responseMode: 'ordering',
    randomizableOptions: false,
    autoGradable: true,
  },

  RANKING: {
    family: 'SELECTION',
    responseMode: 'ranking',
    randomizableOptions: false,
    autoGradable: true,
  },

  // ─────────────────────────────────────────────
  // VISUAL
  // ─────────────────────────────────────────────

  IMAGE_CHOICE: {
    family: 'VISUAL',
    responseMode: 'single-choice',
    randomizableOptions: true,
    autoGradable: true,
  },

  IMAGE_MULTI_CHOICE: {
    family: 'VISUAL',
    responseMode: 'multiple-select',
    randomizableOptions: true,
    autoGradable: true,
  },

  HOTSPOT: {
    family: 'VISUAL',
    responseMode: 'hotspot',
    randomizableOptions: false,
    autoGradable: true,
  },

  HOTSPOT_MULTI: {
    family: 'VISUAL',
    responseMode: 'hotspot-multi',
    randomizableOptions: false,
    autoGradable: true,
  },

  DRAG_DROP: {
    family: 'VISUAL',
    responseMode: 'drag-drop',
    randomizableOptions: false,
    autoGradable: true,
  },

  ANNOTATION: {
    family: 'VISUAL',
    responseMode: 'annotation',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // MATRIX
  // ─────────────────────────────────────────────

  MATRIX_SINGLE: {
    family: 'MATRIX',
    responseMode: 'matrix-single',
    randomizableOptions: false,
    autoGradable: true,
  },

  MATRIX_MULTI: {
    family: 'MATRIX',
    responseMode: 'matrix-multi',
    randomizableOptions: false,
    autoGradable: true,
  },

  MATRIX_TEXT: {
    family: 'MATRIX',
    responseMode: 'matrix-text',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // STIMULUS / GROUP
  // ─────────────────────────────────────────────

  PASSAGE: {
    family: 'STIMULUS',
    responseMode: 'group',
    randomizableOptions: false,
    autoGradable: false,
  },

  CASE_STUDY: {
    family: 'STIMULUS',
    responseMode: 'group',
    randomizableOptions: false,
    autoGradable: false,
  },

  GROUPED_QUESTIONS: {
    family: 'STIMULUS',
    responseMode: 'group',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // TECHNICAL
  // ─────────────────────────────────────────────

  CODE_OUTPUT: {
    family: 'TECHNICAL',
    responseMode: 'code-output',
    randomizableOptions: false,
    autoGradable: true,
  },

  CODE_TRACE: {
    family: 'TECHNICAL',
    responseMode: 'code-trace',
    randomizableOptions: false,
    autoGradable: true,
  },

  CODE_COMPLETION: {
    family: 'TECHNICAL',
    responseMode: 'code-completion',
    randomizableOptions: false,
    autoGradable: true,
  },

  CODE_EDITOR: {
    family: 'TECHNICAL',
    responseMode: 'code',
    randomizableOptions: false,
    autoGradable: false,
  },

  EQUATION_INPUT: {
    family: 'TECHNICAL',
    responseMode: 'equation',
    randomizableOptions: false,
    autoGradable: true,
  },

  GRAPH_RESPONSE: {
    family: 'TECHNICAL',
    responseMode: 'graph',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // MEDIA
  // ─────────────────────────────────────────────

  AUDIO_RESPONSE: {
    family: 'MEDIA',
    responseMode: 'audio',
    randomizableOptions: false,
    autoGradable: false,
  },

  AUDIO_RECORDING: {
    family: 'MEDIA',
    responseMode: 'audio-recording',
    randomizableOptions: false,
    autoGradable: false,
  },

  VIDEO_RESPONSE: {
    family: 'MEDIA',
    responseMode: 'video',
    randomizableOptions: false,
    autoGradable: false,
  },

  // ─────────────────────────────────────────────
  // FILE / CREATIVE
  // ─────────────────────────────────────────────

  FILE_UPLOAD: {
    family: 'FILE',
    responseMode: 'file',
    randomizableOptions: false,
    autoGradable: false,
  },

  DRAWING: {
    family: 'CREATIVE',
    responseMode: 'drawing',
    randomizableOptions: false,
    autoGradable: false,
  },

  ANNOTATION_DRAWING: {
    family: 'CREATIVE',
    responseMode: 'annotation',
    randomizableOptions: false,
    autoGradable: false,
  },
})

/**
 * Returns true when CBTGen recognizes the supplied type.
 */
export function isSupportedQuestionType(type) {
  return Boolean(
    type && QUESTION_TYPES[type]
  )
}

/**
 * Returns the complete definition for a type.
 */
export function getQuestionType(type) {
  return QUESTION_TYPES[type] || null
}

/**
 * Returns the broad question family.
 */
export function getQuestionFamily(type) {
  return (
    QUESTION_TYPES[type]?.family ||
    null
  )
}

/**
 * Returns the canonical response mode.
 */
export function getResponseMode(type) {
  return (
    QUESTION_TYPES[type]?.responseMode ||
    null
  )
}

/**
 * Returns whether answer options can safely be randomized.
 */
export function canRandomizeOptions(type) {
  return (
    QUESTION_TYPES[type]
      ?.randomizableOptions === true
  )
}

/**
 * Returns whether CBTGen can automatically grade the type.
 */
export function isAutoGradable(type) {
  return (
    QUESTION_TYPES[type]
      ?.autoGradable === true
  )
}

/**
 * Returns every registered question type.
 */
export function getSupportedQuestionTypes() {
  return Object.keys(QUESTION_TYPES)
}

/**
 * Returns every response mode used by the registry.
 */
export function getSupportedResponseModes() {
  return [
    ...new Set(
      Object.values(QUESTION_TYPES).map(
        (definition) =>
          definition.responseMode
      )
    ),
  ]
}

export default QUESTION_TYPES