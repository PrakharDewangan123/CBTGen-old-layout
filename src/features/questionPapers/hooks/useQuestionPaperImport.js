import { useEffect, useRef, useState } from 'react'
import {
  createConversionRecoveryRecord,
  formatConversionCorrectionHandoff,
  loadConversionRecoveryRecord,
  saveConversionRecoveryRecord,
} from '../services/conversionRecovery'
import {
  compareQuestionPaperFile,
  importQuestionPaperFile,
  validateQuestionPaperFile,
} from '../services/questionPaperImportService'

export function useQuestionPaperImport({ onImported } = {}) {
  const fileInputRef = useRef(null)
  const compareFileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [compareFile, setCompareFile] = useState(null)
  const [compareResult, setCompareResult] = useState(null)
  const [recoveryRecord, setRecoveryRecord] = useState(null)
  const [handoffCopied, setHandoffCopied] = useState(false)

  useEffect(() => {
    setRecoveryRecord(loadConversionRecoveryRecord())
  }, [])

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile || null)
    setStatus('idle')
    setResult(null)
    setCompareFile(null)
    setCompareResult(null)
    event.target.value = ''
  }

  const openFilePicker = () => fileInputRef.current?.click()

  const handleValidate = async () => {
    if (!file) return
    setStatus('validating')
    setResult(null)
    setCompareResult(null)

    try {
      const validationResult = await validateQuestionPaperFile(file)
      setResult(validationResult)
      setStatus(validationResult.valid ? 'valid' : 'error')
      const recovery = createConversionRecoveryRecord({ fileName: file.name, result: validationResult })
      setRecoveryRecord(recovery)
      saveConversionRecoveryRecord(recovery)
    } catch (error) {
      console.error('XML validation failed:', error)
      setStatus('error')
      const failedResult = {
        valid: false,
        status: 'REJECTED',
        errors: [{
          severity: 'error',
          code: error?.code || 'VALIDATION_EXCEPTION',
          message: error?.message || 'An unexpected validation error occurred.',
        }],
        warnings: [],
        summary: {},
      }
      setResult(failedResult)
      const recovery = createConversionRecoveryRecord({ fileName: file.name, result: failedResult })
      setRecoveryRecord(recovery)
      saveConversionRecoveryRecord(recovery)
    }
  }

  const copyCorrectionHandoff = async () => {
    const record = result ? createConversionRecoveryRecord({ fileName: file?.name, result }) : recoveryRecord
    if (!record) return false
    const text = formatConversionCorrectionHandoff(record)
    try {
      await navigator.clipboard.writeText(text)
      setHandoffCopied(true)
      window.setTimeout(() => setHandoffCopied(false), 1800)
      return true
    } catch (error) {
      console.error('Unable to copy conversion correction report:', error)
      return false
    }
  }

  const handleAddToLibrary = async () => {
    if (!file || !result?.valid || !result?.summary) return
    setStatus('importing')

    try {
      const importResult = await importQuestionPaperFile(file, result)
      setStatus('imported')
      if (onImported) await onImported(importResult)
    } catch (error) {
      console.error('Failed to import question paper:', error)
      setStatus('import-error')
      setResult((current) => ({
        ...(current || {}),
        valid: false,
        status: 'REJECTED',
        errors: [
          ...(current?.errors || []),
          {
            severity: 'error',
            code: 'IMPORT_FAILED',
            message:
              error?.message ||
              'Unable to add the question paper to your library.',
          },
        ],
        warnings: current?.warnings || [],
        summary: current?.summary || {},
      }))
    }
  }

  const handleCompare = async () => {
    if (!result?.fingerprint || !compareFile) return

    try {
      const comparisonResult = await compareQuestionPaperFile(
        compareFile,
        result.fingerprint
      )
      setCompareResult(comparisonResult)
    } catch (error) {
      setCompareResult({
        error: error?.message || 'Unable to compare the papers.',
      })
    }
  }

  return {
    fileInputRef,
    compareFileInputRef,
    file,
    setFile,
    status,
    result,
    setResult,
    compareFile,
    setCompareFile,
    compareResult,
    recoveryRecord,
    handoffCopied,
    copyCorrectionHandoff,
    setCompareResult,
    handleFileChange,
    openFilePicker,
    handleValidate,
    handleAddToLibrary,
    handleCompare,
  }
}
