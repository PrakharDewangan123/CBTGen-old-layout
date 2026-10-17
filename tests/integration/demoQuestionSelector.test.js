import {
  getDemoRendererSignature,
  selectDiverseDemoQuestions,
} from '../../src/lib/cbtgen/demoQuestionSelector.js'

function question(id, subjectRef, sectionRef, type, extra = {}) {
  return {
    sourceQuestionId: id,
    subjectRef,
    subjectName: subjectRef,
    sectionRef,
    type,
    responseMode: type === 'NAT' ? 'numeric' : 'single-choice',
    content: { blocks: [{ type: 'text', value: `Question ${id}` }], images: [], media: [] },
    response: { options: [], rawMode: '' },
    marking: { positive: 4, negative: 1 },
    ...extra,
  }
}

const physicsMcq = question('p1', 'Physics', 'P1', 'MCQ')
const physicsNumerical = question('p2', 'Physics', 'P1', 'NAT')
const physicsSection2Mcq = question('p3', 'Physics', 'P2', 'MCQ')
const physicsAssertion = question('p4', 'Physics', 'P2', 'ASSERTION_REASON')
const chemistryMcq = question('c1', 'Chemistry', 'C1', 'MCQ')
const chemistryMatch = question('c2', 'Chemistry', 'C1', 'MATCH')
const mathsNumerical = question('m1', 'Maths', 'M1', 'NAT')
const mathsMatrix = question('m2', 'Maths', 'M1', 'MATRIX_TEXT')

const result = selectDiverseDemoQuestions({
  questions: [
    physicsMcq,
    physicsNumerical,
    physicsSection2Mcq,
    physicsAssertion,
    chemistryMcq,
    chemistryMatch,
    mathsNumerical,
    mathsMatrix,
  ],
})

const selectedIds = result.questions.map(item => item.sourceQuestionId)
for (const id of ['p1', 'p2', 'p4', 'c2', 'm2']) {
  if (!selectedIds.includes(id)) throw new Error(`Expected diversity selector to keep ${id}; selected ${selectedIds.join(', ')}`)
}
for (const id of ['p3', 'c1', 'm1']) {
  if (selectedIds.includes(id)) throw new Error(`Expected repeated type to be skipped for ${id}`)
}

// Question objects are passed through unchanged: source metadata and assets
// are not reconstructed or replaced by the selector.
if (result.questions.find(item => item.sourceQuestionId === 'p1') !== physicsMcq) {
  throw new Error('Selector must preserve the original question object.')
}
if (result.questions.find(item => item.sourceQuestionId === 'p1').marking.positive !== 4) {
  throw new Error('Selector must preserve source marking metadata.')
}

const mcqText = question('v1', 'Physics', 'P1', 'MCQ')
const mcqImage = question('v2', 'Physics', 'P1', 'MCQ', {
  content: { blocks: [{ type: 'text', value: 'Image question' }, { type: 'image', src: 'assets/figure.png' }], images: [{ id: 'figure', src: 'assets/figure.png' }], media: [] },
})
if (getDemoRendererSignature(mcqText) === getDemoRendererSignature(mcqImage)) {
  throw new Error('A question with a different visual renderer variation should have a distinct signature.')
}

const unsupported = question('u1', 'Physics', 'P1', 'UNSUPPORTED_TYPE')
const unsupportedResult = selectDiverseDemoQuestions({ questions: [unsupported] })
if (unsupportedResult.questions.length !== 0 || unsupportedResult.report.unsupported.length !== 1) {
  throw new Error('Unsupported question types must be reported and never silently substituted.')
}

const capped = selectDiverseDemoQuestions({
  questions: [
    question('a1', 'A', 'A1', 'MCQ'),
    question('a2', 'A', 'A2', 'MSQ'),
    question('a3', 'A', 'A3', 'NAT'),
    question('a4', 'A', 'A4', 'MATCH'),
    question('b1', 'B', 'B1', 'MCQ'),
    question('c1', 'C', 'C1', 'MCQ'),
    question('d1', 'D', 'D1', 'MCQ'),
  ],
  maxSubjects: 3,
  maxSectionsPerSubject: 3,
})
if (capped.questions.some(item => item.subjectRef === 'D')) {
  throw new Error('Selector must enforce the three-subject limit.')
}
if (!capped.report.omittedByLimits.length) {
  throw new Error('Selector must report questions omitted due to selection limits.')
}

console.log('✓ Diversity-first demo selector tests passed')
console.log('  Type history is global across subjects/sections; renderer variation is tracked separately.')
console.log('  Original question objects, marking metadata and asset references are preserved.')
console.log('  Unsupported types are reported; subject/section limits are enforced.')

// Production selection must use subject/section metadata from the imported
// paper, not a hardcoded subject catalog or known section IDs.
const dynamicSource = [
  question('x1', 'Biology & Earth Systems', 'Module-A', 'MCQ'),
  question('x2', 'Biology & Earth Systems', 'Module-A', 'MCQ', {
    content: { blocks: [{ type: 'text', value: 'A different MCQ renderer' }, { type: 'image', src: 'assets/diagram.svg' }], images: [{ id: 'diagram', src: 'assets/diagram.svg' }], media: [] },
  }),
  question('x3', 'Biology & Earth Systems', 'Module-B', 'MSQ'),
  question('x4', 'Civic Design', 'Topic-77', 'NAT'),
  question('x5', 'Civic Design', 'Topic-77', 'MATCH'),
  question('x6', 'A newly named subject', 'Part-Z', 'TRUE_FALSE'),
]
const dynamicResult = selectDiverseDemoQuestions({ questions: dynamicSource })
const dynamicIds = dynamicResult.questions.map(item => item.sourceQuestionId)
for (const id of ['x1', 'x3', 'x4', 'x5', 'x6']) {
  if (!dynamicIds.includes(id)) throw new Error(`Dynamic source metadata/type priority failed for ${id}; selected ${dynamicIds.join(', ')}`)
}
if (dynamicIds.indexOf('x3') > dynamicIds.indexOf('x2')) {
  throw new Error('A new question type must be prioritized before a repeated type with a new renderer variation.')
}
if (dynamicResult.questions.some(item => !['Biology & Earth Systems', 'Civic Design', 'A newly named subject'].includes(item.subjectRef))) {
  throw new Error('Selector must preserve dynamically imported subject labels without replacing them.')
}
console.log('  Dynamic imported subject/section labels are honored; new types take priority over repeat-type renderer variants.')
