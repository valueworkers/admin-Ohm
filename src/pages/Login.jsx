import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiLoader } from 'react-icons/fi'
import { DEMO_LOGINS } from '../data/seed'
import { resetPlatformStore } from '../store/platformStore'
import {
  canAccessAdminPanel,
  getAuthUser,
  isAuthenticated,
  loginWithDummy,
} from '../utils/auth'
import { btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (isAuthenticated() && canAccessAdminPanel(getAuthUser())) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  const fillDemo = (demo) => {
    setEmail(demo.email)
    setPassword(demo.password)
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    setIsLoading(true)
    try {
      const result = loginWithDummy(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      navigate(location.state?.from || '/', { replace: true })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">
            Senior Care Platform
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Super Admin sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Platform console only. Onboard tenants, set permissions, and inspect org data.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${fieldClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-700"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className={`${btnPrimary} w-full`} disabled={isLoading}>
              {isLoading ? (
                <>
                  <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Demo account</p>
          <ul className="mt-2 space-y-2">
            {DEMO_LOGINS.map((demo) => (
              <li key={demo.email}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
                  onClick={() => fillDemo(demo)}
                >
                  <span>
                    <span className="block font-medium text-white">{demo.label}</span>
                    <span className="text-xs text-white/50">{demo.email}</span>
                  </span>
                  <span className="text-xs text-sky-300">Use</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${btnSecondary} mt-3 w-full border-white/20 bg-transparent text-white hover:bg-white/10`}
            onClick={() => {
              resetPlatformStore()
              setError('')
            }}
          >
            Reset demo data
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
