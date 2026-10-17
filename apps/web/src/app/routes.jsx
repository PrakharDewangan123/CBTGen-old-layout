import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import Navbar from '../components/layout/Navbar'




import { lazy, Suspense, useEffect } from 'react'
import { getExamMode, setExamMode } from '../features/exam/examEngine/examRuntime'

import AuthGuard from './guards/AuthGuard'
import StudentGuard from './guards/StudentGuard'
import AdminGuard from './guards/AdminGuard'


const Home = lazy(() => import('../features/home/pages/Home'))
const FAQ = lazy(() => import('../features/faq/pages/FAQ'))
const Packs = lazy(() => import('../features/billing/pages/Packs'))
const PreviewPapers = lazy(() => import('../features/preview/pages/PreviewPapers'))
const PreviewExamFlow = lazy(() => import('../features/preview/pages/PreviewExamFlow'))
const Login = lazy(() => import('../features/auth/pages/Login'))
const ForgotPassword = lazy(() => import('../features/auth/pages/ForgotPassword'))
const Signup = lazy(() => import('../features/auth/pages/Signup'))
const QuestionPapers = lazy(() => import('../features/questionPapers/pages/QuestionPapers'))
const Account = lazy(() => import('../features/account/pages/Account'))
const TestConfiguration = lazy(() => import('../features/exam/pages/TestConfiguration'))
const ExamLogin = lazy(() => import('../features/exam/pages/ExamLogin'))
const TestInstructions = lazy(() => import('../features/exam/pages/TestInstructions'))
const Examination = lazy(() => import('../features/exam/pages/Examination'))
const ExamResult = lazy(() => import('../features/exam/pages/ExamResult'))
const Score = lazy(() => import('../features/exam/pages/Score'))
const Analysis = lazy(() => import('../features/exam/pages/Analysis'))
const AdminDashboard = lazy(() => import('../features/admin/pages/AdminDashboard'))


function RoutePage({ children }) {
  return (
    <Suspense fallback={<div role="status">Loading page...</div>}>
      {children}
    </Suspense>
  )
}

function PublicLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}


function StudentLayout() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (getExamMode() !== 'active') return

    const isExamRoute = [
      '/exam-login',
      '/test-instructions',
      '/examination',
    ].includes(location.pathname)

    if (isExamRoute) return

    navigate('/exam-login', { replace: true })
  }, [location.pathname, navigate])

  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}


/*
 * ExamSystemLayout intentionally does NOT render
 * the normal CBTGen Navbar.
 *
 * Login, Instructions, Examination and Result are
 * part of the exam-system interface and need to
 * occupy the full viewport like the reference CBT.
 */
function ExamSystemLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const examMode = getExamMode()

  useEffect(() => {
    const activeSession = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('cbtgen_active_session') || 'null')
      } catch {
        return null
      }
    })()

    if (!activeSession?.id && !activeSession?.sessionId) {
      navigate('/question-papers', { replace: true })
      return
    }

    if (examMode === 'paused' || examMode === 'completed') {
      navigate('/question-papers', { replace: true })
      return
    }

    setExamMode('active')

    const lockedUrl = window.location.href
    const lockHistory = () => {
      window.history.pushState({ cbtgenExamLock: true }, '', lockedUrl)
    }

    // Create a same-document history barrier. Browser Back/Forward cannot
    // escape the exam flow while the exam session is active.
    lockHistory()
    const onPopState = () => {
      window.history.replaceState({ cbtgenExamLock: true }, '', lockedUrl)
    }

    window.addEventListener('popstate', onPopState, true)

    const root = document.documentElement
    const body = document.body
    const previousOverflow = body.style.overflow
    const previousUserSelect = body.style.userSelect
    body.style.overflow = 'hidden'
    body.style.userSelect = 'none'

    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement && root.requestFullscreen) {
          await root.requestFullscreen()
        }
      } catch {
        // Fullscreen is permission/browser-policy controlled. The layout
        // remains full viewport even when fullscreen is unavailable.
      }
    }

    requestFullscreen()

    const onFullscreenChange = () => {
      // Do not navigate away if the browser exits fullscreen. A user gesture
      // is required before browsers permit entering fullscreen again.
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      window.removeEventListener('popstate', onPopState, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      body.style.overflow = previousOverflow
      body.style.userSelect = previousUserSelect

      if (document.fullscreenElement === root && root.exitFullscreen) {
        root.exitFullscreen().catch(() => {})
      }
    }
  }, [location.pathname, navigate, examMode])

  return <div className="cbtgen-exam-isolation"><Outlet /></div>
}


export default function AppRoutes() {
  return (
    <Routes>

      {/* =====================================================
          PUBLIC
      ===================================================== */}

      <Route
        path="/preview-exam/:paperId/:stage"
        element={<RoutePage><PreviewExamFlow /></RoutePage>}
      />

      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={<RoutePage><Home /></RoutePage>}
        />

        <Route
          path="/preview-papers"
          element={<RoutePage><PreviewPapers /></RoutePage>}
        />

        <Route
          path="/faq"
          element={<RoutePage><FAQ /></RoutePage>}
        />

        <Route
          path="/plans"
          element={<RoutePage><Packs /></RoutePage>}
        />

      </Route>

      {/* Authentication pages use the same focused, no-navbar layout as Login. */}
      <Route
        path="/forgot-password"
        element={<RoutePage><ForgotPassword /></RoutePage>}
      />

      <Route
        path="/signup"
        element={<RoutePage><Signup /></RoutePage>}
      />

      <Route
        path="/login"
        element={<RoutePage><Login /></RoutePage>}
      />


      {/* =====================================================
          STUDENT — NORMAL CBTGen UI
      ===================================================== */}

      <Route
        element={
          <AuthGuard>
            <StudentGuard>
              <StudentLayout />
            </StudentGuard>
          </AuthGuard>
        }
      >

        <Route
          path="/question-papers"
          element={<RoutePage><QuestionPapers /></RoutePage>}
        />

        <Route
          path="/question-papers/:id/analysis"
          element={<RoutePage><Analysis /></RoutePage>}
        />

        <Route
          path="/question-papers/:id/score"
          element={<RoutePage><Score /></RoutePage>}
        />

        <Route
          path="/account"
          element={<RoutePage><Account /></RoutePage>}
        />

        <Route
          path="/test-configuration"
          element={<RoutePage><TestConfiguration /></RoutePage>}
        />

        <Route
          path="/exam-result"
          element={<RoutePage><ExamResult /></RoutePage>}
        />

      </Route>


      {/* =====================================================
          STUDENT — EXAM SYSTEM UI

          No normal CBTGen Navbar.

          Flow:
          Test Configuration
                ↓
          Exam Login
                ↓
          Test Instructions
                ↓
          Examination
                ↓
          Exam Result
      ===================================================== */}

      <Route
        element={
          <AuthGuard>
            <StudentGuard>
              <ExamSystemLayout />
            </StudentGuard>
          </AuthGuard>
        }
      >

        <Route
          path="/exam-login"
          element={<RoutePage><ExamLogin /></RoutePage>}
        />

        <Route
          path="/test-instructions"
          element={<RoutePage><TestInstructions /></RoutePage>}
        />

        <Route
          path="/examination"
          element={<RoutePage><Examination /></RoutePage>}
        />

      </Route>


      {/* =====================================================
          ADMIN
      ===================================================== */}

      <Route
        path="/admin"
        element={
          <AuthGuard>
            <AdminGuard>
              <RoutePage><AdminDashboard /></RoutePage>
            </AdminGuard>
          </AuthGuard>
        }
      />


      {/* =====================================================
          UNKNOWN ROUTE
      ===================================================== */}

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  )
}
