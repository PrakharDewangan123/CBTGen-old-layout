import MCQ from './MCQ'
import MSQ from './MSQ'
import AssertionReason from './AssertionReason'
import NAT from './NAT'
import TrueFalse from './TrueFalse'
import YesNo from './YesNo'
import NumericRange from './NumericRange'
import Dropdown from './Dropdown'
import Match from './Match'
import Ordering from './Ordering'
import Ranking from './Ranking'
import TextInput from './TextInput'
import UnsupportedQuestionType from './UnsupportedQuestionType'
import { QUESTION_TYPES } from '../../../lib/cbtgen/questionTypes'

export const QUESTION_TYPE_RENDERERS = Object.freeze({
  MCQ,
  MSQ,
  ASSERTION_REASON: AssertionReason,
  IMAGE_CHOICE: MCQ,
  IMAGE_MULTI_CHOICE: MSQ,
  NAT,
  TRUE_FALSE: TrueFalse,
  YES_NO: YesNo,
  NUMERIC_RANGE: NumericRange,
  SLIDER: NumericRange,
  EQUATION_INPUT: NumericRange,
  DROPDOWN: Dropdown,
  MATCH: Match,
  MATCH_MULTIPLE: Match,
  ORDERING: Ordering,
  RANKING: Ranking,
  TEXT_SHORT: TextInput,
  TEXT_LONG: TextInput,
  FILL_BLANK: TextInput,
  ESSAY: TextInput,
  SUBJECTIVE: TextInput,
  MATRIX_TEXT: TextInput,
})

export function getQuestionTypeRenderer(type) {
  return QUESTION_TYPE_RENDERERS[type] || UnsupportedQuestionType
}

export function isQuestionTypeRendererImplemented(type) {
  return !!QUESTION_TYPE_RENDERERS[type]
}

export function getUnimplementedQuestionTypes() {
  return Object.keys(QUESTION_TYPES).filter(type => !isQuestionTypeRendererImplemented(type))
}

export default QUESTION_TYPE_RENDERERS
