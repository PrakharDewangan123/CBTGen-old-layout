import {
  canRandomizeOptions,
} from './questionTypes'

/**
 * CBTGen Randomization Engine
 *
 * IMPORTANT:
 * This operates on the normalized paper model.
 *
 * It NEVER:
 * - changes source question IDs
 * - changes original question numbers
 * - changes correct-option identities
 * - changes section membership
 * - changes marks
 * - changes the QP fingerprint
 * - changes source XML
 *
 * It creates a separate session presentation layer.
 */

/* ─────────────────────────────────────────────
   RANDOM HELPERS
───────────────────────────────────────────── */

/**
 * Fisher-Yates shuffle.
 *
 * Returns a NEW array.
 * The original array is never mutated.
 */
function shuffleArray(
  array,
  random = Math.random
) {
  const result = [...array]

  for (
    let i = result.length - 1;
    i > 0;
    i -= 1
  ) {
    const j = Math.floor(
      random() * (i + 1)
    )

    ;[
      result[i],
      result[j],
    ] = [
      result[j],
      result[i],
    ]
  }

  return result
}

/**
 * Creates a small deterministic seed from a string.
 *
 * Useful when a session needs reproducible
 * randomization.
 */
function hashSeed(value) {
  let hash = 2166136261

  const text = String(value)

  for (
    let i = 0;
    i < text.length;
    i += 1
  ) {
    hash ^= text.charCodeAt(i)
    hash =
      Math.imul(
        hash,
        16777619
      )
  }

  return hash >>> 0
}

/**
 * Seeded pseudo-random generator.
 *
 * This is for reproducible presentation order,
 * NOT for security or cryptography.
 */
function createSeededRandom(
  seed
) {
  let state =
    hashSeed(seed)

  return function random() {
    state += 0x6D2B79F5

    let t = state

    t =
      Math.imul(
        t ^ (t >>> 15),
        t | 1
      )

    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61
      )

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    )
  }
}

/* ─────────────────────────────────────────────
   OPTION LABELS
───────────────────────────────────────────── */

/**
 * Generates presentation labels.
 *
 * Labels are NEVER used for correctness.
 *
 * Example:
 *
 * source option IDs:
 * opt-001
 * opt-002
 * opt-003
 * opt-004
 *
 * session labels:
 * A
 * B
 * C
 * D
 */
function createOptionLabel(
  index
) {
  let value = index
  let label = ''

  do {
    label =
      String.fromCharCode(
        65 + (value % 26)
      ) + label

    value =
      Math.floor(
        value / 26
      ) - 1
  } while (
    value >= 0
  )

  return label
}

/* ─────────────────────────────────────────────
   OPTION RANDOMIZATION
───────────────────────────────────────────── */

/**
 * Creates randomized presentation options.
 *
 * The option's original `id` remains untouched.
 *
 * Correctness therefore continues to work through:
 *
 *     correctOptionIds
 *             ↓
 *       option.id
 *
 * NOT:
 *
 *     A / B / C / D
 */
function randomizeQuestionOptions(
  question,
  random
) {
  if (
    !canRandomizeOptions(
      question.type
    )
  ) {
    return {
      options:
        question.response
          ?.options || [],

      randomized: false,
    }
  }

  const sourceOptions =
    question.response
      ?.options || []

  if (
    sourceOptions.length <= 1
  ) {
    return {
      options:
        sourceOptions.map(
          (option, index) => ({
            ...option,

            sessionIndex:
              index,

            displayLabel:
              createOptionLabel(
                index
              ),
          })
        ),

      randomized: false,
    }
  }

  const shuffled =
    shuffleArray(
      sourceOptions,
      random
    )

  const options =
    shuffled.map(
      (option, index) => ({
        ...option,

        /*
         * Immutable source identity.
         */
        sourceOptionId:
          option.id,

        /*
         * Session presentation identity.
         */
        sessionIndex:
          index,

        /*
         * Display-only label.
         */
        displayLabel:
          createOptionLabel(
            index
          ),
      })
    )

  return {
    options,
    randomized: true,
  }
}

/* ─────────────────────────────────────────────
   QUESTION RANDOMIZATION
───────────────────────────────────────────── */

/**
 * Randomizes questions inside each section.
 *
 * This preserves section membership.
 *
 * Example:
 *
 * Section A:
 *   Q1 Q2 Q3 Q4
 *
 * becomes:
 *
 *   Q3 Q1 Q4 Q2
 *
 * Section B is randomized independently.
 */
function randomizeQuestionsBySection(
  paper,
  random
) {
  const randomized = []

  for (
    const section of paper.sections
  ) {
    const sectionQuestions =
      paper.questions.filter(
        (question) =>
          question.sectionRef ===
          section.id
      )

    const shuffled =
      shuffleArray(
        sectionQuestions,
        random
      )

    randomized.push(
      ...shuffled
    )
  }

  /*
   * Safety fallback:
   *
   * If a question references a section
   * that wasn't represented in `paper.sections`,
   * don't silently lose it.
   */
  const knownIds =
    new Set(
      randomized.map(
        (question) =>
          question.sourceQuestionId
      )
    )

  const orphaned =
    paper.questions.filter(
      (question) =>
        !knownIds.has(
          question.sourceQuestionId
        )
    )

  if (
    orphaned.length > 0
  ) {
    randomized.push(
      ...shuffleArray(
        orphaned,
        random
      )
    )
  }

  return randomized
}

/* ─────────────────────────────────────────────
   SESSION QUESTION
───────────────────────────────────────────── */

function createSessionQuestion(
  question,
  sessionNumber,
  random
) {
  const optionResult =
    randomizeQuestionOptions(
      question,
      random
    )

  return {
    /*
     * ─────────────────────────────────────
     * SOURCE IDENTITY
     * ─────────────────────────────────────
     */

    sourceQuestionId:
      question.sourceQuestionId,

    originalNumber:
      question.originalNumber,

    sectionRef:
      question.sectionRef,

    type:
      question.type,

    family:
      question.family,

    responseMode:
      question.responseMode,

    /*
     * ─────────────────────────────────────
     * SESSION PRESENTATION
     * ─────────────────────────────────────
     */

    sessionNumber,

    /*
     * ─────────────────────────────────────
     * CONTENT
     * ─────────────────────────────────────
     */

    content:
      structuredClone(
        question.content
      ),

    /*
     * ─────────────────────────────────────
     * RESPONSE
     * ─────────────────────────────────────
     */

    response: {
      options:
        structuredClone(
          optionResult.options
        ),

      match:
        structuredClone(
          question.response?.match ||
          null
        ),
    },

    /*
     * ─────────────────────────────────────
     * ANSWER
     *
     * This is retained for the session engine,
     * but the UI must NEVER expose it.
     * It is still referenced by source option ID,
     * never by display label.
     * ─────────────────────────────────────
     */

    answer: {
      correctOptionIds:
        [
          ...(
            question.answer
              ?.correctOptionIds ||
            []
          ),
        ],

      value:
        question.answer?.value ??
        null,

      range:
        structuredClone(
          question.answer?.range ||
          null
        ),

      tolerance:
        question.answer?.tolerance ??
        null,

      mappings:
        structuredClone(
          question.answer?.mappings ||
          []
        ),
    },

    /*
     * ─────────────────────────────────────
     * MARKING
     * ─────────────────────────────────────
     */

    marking:
      structuredClone(
        question.marking
      ),

    /*
     * ─────────────────────────────────────
     * RANDOMIZATION METADATA
     * ─────────────────────────────────────
     */

    randomization: {
      questionRandomized:
        true,

      optionsRandomized:
        optionResult.randomized,
    },
  }
}

/* ─────────────────────────────────────────────
   EXAMINATION PRESENTATION RANDOMIZATION
───────────────────────────────────────────── */

const EXAM_RANDOM_OPTION_TYPES = new Set([
  'MCQ',
  'MSQ',
  'TRUE_FALSE',
  'YES_NO',
  'IMAGE_CHOICE',
  'IMAGE_MULTI_CHOICE',
  'DROPDOWN',
])

const EXAM_RANDOM_ITEM_TYPES = new Set([
  'ORDERING',
  'RANKING',
])

/**
 * Randomizes the presentation of a normalized paper for the examination UI.
 *
 * This is the single presentation-randomization entry point used by the
 * Examination page. Source question IDs, source numbering, section membership,
 * option IDs, marking and QP identity are preserved.
 */
export function randomizePaper(paper, seedValue) {
  const random = createSeededRandom(seedValue)
  const sourceQuestions = Array.isArray(paper?.questions)
    ? paper.questions
    : []
  const sourceSections = Array.isArray(paper?.sections)
    ? paper.sections
    : []

  const bySection = new Map()
  sourceQuestions.forEach((question) => {
    const key = question.sectionRef || '__default__'
    if (!bySection.has(key)) bySection.set(key, [])
    bySection.get(key).push(question)
  })

  const randomizedQuestions = []
  const orderedSections = sourceSections.length
    ? sourceSections.map((section) => section.id)
    : [...bySection.keys()]

  orderedSections.forEach((sectionId) => {
    const sectionQuestions = bySection.get(sectionId) || []
    const randomized = shuffleArray(sectionQuestions, random).map((question) => {
      let next = { ...question }

      if (
        EXAM_RANDOM_OPTION_TYPES.has(question.type) &&
        question.response?.options?.length > 1
      ) {
        next = {
          ...next,
          response: {
            ...next.response,
            options: shuffleArray(next.response.options, random),
          },
        }
      }

      if (question.type === 'MATCH' || question.type === 'MATCH_MULTIPLE') {
        const match = question.response?.match
        if (match?.rightItems?.length > 1) {
          next = {
            ...next,
            response: {
              ...next.response,
              match: {
                ...match,
                rightItems: shuffleArray(match.rightItems, random),
              },
            },
          }
        }
      }

      if (EXAM_RANDOM_ITEM_TYPES.has(question.type)) {
        const items = question.response?.items
        if (Array.isArray(items) && items.length > 1) {
          next = {
            ...next,
            response: {
              ...next.response,
              items: shuffleArray(items, random),
            },
          }
        }
      }

      return next
    })

    randomizedQuestions.push(...randomized)
  })

  bySection.forEach((questions, key) => {
    if (!orderedSections.includes(key)) {
      randomizedQuestions.push(...shuffleArray(questions, random))
    }
  })

  return randomizedQuestions.map((question, index) => ({
    ...question,
    sessionNumber: index + 1,
  }))
}

/* ─────────────────────────────────────────────
   SESSION CREATION
───────────────────────────────────────────── */

/**
 * Creates a randomized CBTGen practice session.
 *
 * Example:
 *
 * const session =
 *   createExamSession(paper)
 *
 * Default:
 *
 * randomizeQuestions = true
 * randomizeOptions = true
 */
export function createExamSession(
  paper,
  {
    randomizeQuestions = true,
    randomizeOptions = true,
    seed = null,
    sessionId = null,
  } = {}
) {
  if (
    !paper ||
    !Array.isArray(
      paper.questions
    )
  ) {
    throw new Error(
      'A valid normalized CBTGen paper is required.'
    )
  }

  /*
   * A supplied seed makes the session
   * reproducible.
   *
   * Without a seed we use Math.random().
   */
  const random =
    seed !== null &&
    seed !== undefined
      ? createSeededRandom(seed)
      : Math.random

  /*
   * Question order.
   */
  const orderedQuestions =
    randomizeQuestions
      ? randomizeQuestionsBySection(
          paper,
          random
        )
      : [...paper.questions]

  /*
   * If option randomization is disabled,
   * we still need a valid random function.
   *
   * `createSessionQuestion` currently decides
   * option randomization from the question type.
   *
   * Therefore temporarily preserve the original
   * order when the caller explicitly disables it.
   */
  const sessionQuestions =
    orderedQuestions.map(
      (
        question,
        index
      ) => {
        const sessionQuestion =
          createSessionQuestion(
            question,
            index + 1,
            random
          )

        if (
          !randomizeOptions
        ) {
          sessionQuestion.response.options =
            (
              question.response
                ?.options || []
            ).map(
              (
                option,
                optionIndex
              ) => ({
                ...structuredClone(
                  option
                ),

                sourceOptionId:
                  option.id,

                sessionIndex:
                  optionIndex,

                displayLabel:
                  createOptionLabel(
                    optionIndex
                  ),
              })
            )

          sessionQuestion.randomization =
            {
              ...sessionQuestion.randomization,

              optionsRandomized:
                false,
            }
        }

        return sessionQuestion
      }
    )

  /*
   * Session-level section metadata.
   */
  const sections =
    paper.sections.map(
      (section) => ({
        ...structuredClone(
          section
        ),

        sessionQuestionIds:
          sessionQuestions
            .filter(
              (question) =>
                question.sectionRef ===
                section.id
            )
            .map(
              (question) =>
                question.sourceQuestionId
            ),
      })
    )

  return {
    /*
     * Session identity.
     *
     * This is NOT the QP identity.
     */
    sessionId:
      sessionId ||
      generateSessionId(),

    /*
     * Source-paper metadata.
     */
    paper: {
      version:
        paper.version,

      exam:
        structuredClone(
          paper.exam
        ),
    },

    sections,

    /*
     * Randomized presentation.
     */
    questions:
      sessionQuestions,

    /*
     * Randomization settings.
     */
    settings: {
      randomizeQuestions,
      randomizeOptions,

      seed:
        seed !== null &&
        seed !== undefined
          ? String(seed)
          : null,
    },

    /*
     * Candidate response state starts empty.
     *
     * This belongs to the session,
     * NOT to source XML.
     */
    responses:
      createEmptyResponses(
        sessionQuestions
      ),
  }
}

/* ─────────────────────────────────────────────
   RESPONSE STATE
───────────────────────────────────────────── */

/**
 * Creates the candidate's initial response state.
 *
 * This is completely separate from source XML.
 */
function createEmptyResponses(
  questions
) {
  return Object.fromEntries(
    questions.map(
      (question) => [
        question.sourceQuestionId,
        {
          sourceQuestionId:
            question.sourceQuestionId,

          sessionNumber:
            question.sessionNumber,

          status:
            'NOT_VISITED',

          response:
            null,

          markedForReview:
            false,

          visited:
            false,

          answered:
            false,
        },
      ]
    )
  )
}

/* ─────────────────────────────────────────────
   SESSION ID
───────────────────────────────────────────── */

function generateSessionId() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return (
    'session-' +
    Date.now().toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  )
}

/* ─────────────────────────────────────────────
   LOOKUP HELPERS
───────────────────────────────────────────── */

export function getSessionQuestion(
  session,
  sessionNumber
) {
  return (
    session?.questions?.find(
      (question) =>
        question.sessionNumber ===
        sessionNumber
    ) || null
  )
}

export function getSessionQuestionBySourceId(
  session,
  sourceQuestionId
) {
  return (
    session?.questions?.find(
      (question) =>
        question.sourceQuestionId ===
        sourceQuestionId
    ) || null
  )
}

export function getSessionSectionQuestions(
  session,
  sectionId
) {
  return (
    session?.questions?.filter(
      (question) =>
        question.sectionRef ===
        sectionId
    ) || []
  )
}

/* ─────────────────────────────────────────────
   OPTION LOOKUP
───────────────────────────────────────────── */

/**
 * Finds an option by its immutable source ID.
 *
 * NEVER look up an answer using A/B/C/D.
 */
export function getSessionOptionById(
  question,
  sourceOptionId
) {
  return (
    question?.response?.options?.find(
      (option) =>
        option.sourceOptionId ===
          sourceOptionId ||
        option.id ===
          sourceOptionId
    ) || null
  )
}

/**
 * Converts a source option ID into the
 * currently displayed label.
 *
 * Example:
 *
 * opt-003 → B
 */
export function getDisplayedOptionLabel(
  question,
  sourceOptionId
) {
  return (
    getSessionOptionById(
      question,
      sourceOptionId
    )?.displayLabel ||
    null
  )
}

/* ─────────────────────────────────────────────
   DEBUG / VERIFICATION
───────────────────────────────────────────── */

/**
 * Returns a compact representation useful
 * during development.
 */
export function getRandomizationSummary(
  session
) {
  return {
    sessionId:
      session?.sessionId || null,

    questions:
      session?.questions?.map(
        (question) => ({
          sessionNumber:
            question.sessionNumber,

          originalNumber:
            question.originalNumber,

          sourceQuestionId:
            question.sourceQuestionId,

          sectionRef:
            question.sectionRef,

          options:
            question.response?.options?.map(
              (option) => ({
                sourceOptionId:
                  option.sourceOptionId,

                displayLabel:
                  option.displayLabel,
              })
            ) || [],
        })
      ) || [],
  }
}