import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FiEye, FiEyeOff, FiLoader } from 'react-icons/fi'
import Modal from '../components/ui/Modal'
import { DEMO_LOGINS } from '../data/seed'
import { resetPlatformStore } from '../store/platformStore'
import {
  canAccessAdminPanel,
  completePasswordReset,
  getAuthUser,
  isAuthenticated,
  loginWithDummy,
  loginWithDummyOtp,
  sendDemoOtp,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from '../utils/auth'
import { btnPrimary, btnSecondary, fieldClass, labelClass } from '../utils/ui'

const MODES = [
  { id: 'password', label: 'Email / Phone' },
  { id: 'otp', label: 'OTP' },
]

const FORGOT_STEPS = {
  identifier: 1,
  otp: 2,
  password: 3,
}

const emptyForgot = () => ({
  step: FORGOT_STEPS.identifier,
  identifier: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
  showNew: false,
  showConfirm: false,
  status: { type: '', message: '' },
})

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgot, setForgot] = useState(emptyForgot)
  const [forgotLoading, setForgotLoading] = useState(false)

  if (isAuthenticated() && canAccessAdminPanel(getAuthUser())) {
    return <Navigate to={location.state?.from || '/'} replace />
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setInfo('')
    setOtp('')
    setOtpSent(false)
  }

  const fillDemo = (demo) => {
    setEmail(demo.email)
    setPassword(demo.password)
    setMode('password')
    setError('')
    setInfo('')
  }

  const handlePasswordSubmit = (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !password) {
      setError('Email or phone and password are required.')
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

  const sendOtp = () => {
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Enter your email or phone to receive an OTP.')
      return
    }
    setIsLoading(true)
    try {
      const result = sendDemoOtp(email)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOtpSent(true)
      setInfo(result.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpSubmit = (event) => {
    event.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Email or phone is required.')
      return
    }
    if (!otpSent) {
      sendOtp()
      return
    }
    if (!otp.trim()) {
      setError('Enter the OTP code.')
      return
    }
    setIsLoading(true)
    try {
      const result = loginWithDummyOtp(email, otp)
      if (!result.ok) {
        setError(result.error)
        return
      }
      navigate(location.state?.from || '/', { replace: true })
    } finally {
      setIsLoading(false)
    }
  }

  const setForgotStatus = (status) => setForgot((prev) => ({ ...prev, status }))

  const closeForgot = () => {
    setForgotOpen(false)
    setForgot(emptyForgot())
    setForgotLoading(false)
  }

  const openForgot = () => {
    setForgot({ ...emptyForgot(), identifier: email })
    setForgotOpen(true)
  }

  const submitForgot = (event) => {
    event.preventDefault()
    setForgotStatus({ type: '', message: '' })
    setForgotLoading(true)
    try {
      if (forgot.step === FORGOT_STEPS.identifier) {
        if (!forgot.identifier.trim()) {
          setForgotStatus({ type: 'error', message: 'Email or phone is required.' })
          return
        }
        const result = sendPasswordResetOtp(forgot.identifier)
        if (!result.ok) {
          setForgotStatus({ type: 'error', message: result.error })
          return
        }
        setForgot((prev) => ({
          ...prev,
          step: FORGOT_STEPS.otp,
          status: { type: 'success', message: result.message },
        }))
        return
      }

      if (forgot.step === FORGOT_STEPS.otp) {
        if (!forgot.otp.trim()) {
          setForgotStatus({ type: 'error', message: 'Enter the 6-digit OTP.' })
          return
        }
        const result = verifyPasswordResetOtp(forgot.identifier, forgot.otp)
        if (!result.ok) {
          setForgotStatus({ type: 'error', message: result.error })
          return
        }
        setForgot((prev) => ({
          ...prev,
          step: FORGOT_STEPS.password,
          status: { type: 'success', message: 'OTP verified. Set a new password.' },
        }))
        return
      }

      const result = completePasswordReset(
        forgot.identifier,
        forgot.otp,
        forgot.newPassword,
        forgot.confirmPassword
      )
      if (!result.ok) {
        setForgotStatus({ type: 'error', message: result.error })
        return
      }
      setEmail(result.email)
      setPassword('')
      setMode('password')
      setInfo(result.message)
      setError('')
      closeForgot()
    } finally {
      setForgotLoading(false)
    }
  }

  const forgotPrimaryLabel =
    forgot.step === FORGOT_STEPS.identifier
      ? 'Send OTP'
      : forgot.step === FORGOT_STEPS.otp
        ? 'Verify OTP'
        : 'Update password'

  const forgotTitle =
    forgot.step === FORGOT_STEPS.identifier
      ? 'Forgot password'
      : forgot.step === FORGOT_STEPS.otp
        ? 'Verify OTP'
        : 'Set new password'

  const [demoKey, setDemoKey] = useState(DEMO_LOGINS[0]?.email || '')

  const applySelectedDemo = () => {
    const demo = DEMO_LOGINS.find((d) => d.email === demoKey)
    if (demo) fillDemo(demo)
  }

  return (
    <div className="sc-login-bg flex h-dvh max-h-dvh items-center justify-center overflow-y-auto px-4 py-6 sm:py-10">
      <div className="sc-page-enter w-full max-w-md space-y-3">
        <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Ohm Admin</h1>

          <div
            className="mt-5 flex rounded-lg border border-stone-200 bg-stone-50 p-1"
            role="tablist"
            aria-label="Sign-in method"
          >
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors duration-150 ${
                  mode === m.id
                    ? 'bg-brand-600 text-white'
                    : 'text-stone-600 hover:bg-white hover:text-stone-900'
                }`}
                onClick={() => switchMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'password' ? (
            <form className="mt-5 space-y-4" onSubmit={handlePasswordSubmit}>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email or phone
                </label>
                <input
                  id="email"
                  type="text"
                  autoComplete="username"
                  className={fieldClass}
                  placeholder="Email or phone number"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className={labelClass} htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                    onClick={openForgot}
                  >
                    Forgot password?
                  </button>
                </div>
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-700"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {info ? (
                <p className="sc-fade-in rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p
                  className="sc-fade-in rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  role="alert"
                >
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
          ) : (
            <form className="mt-5 space-y-4" onSubmit={handleOtpSubmit}>
              <div>
                <label className={labelClass} htmlFor="otp-identifier">
                  Email or phone
                </label>
                <input
                  id="otp-identifier"
                  type="text"
                  autoComplete="username"
                  className={fieldClass}
                  placeholder="Email or phone number"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setOtpSent(false)
                    setInfo('')
                  }}
                />
              </div>
              {otpSent ? (
                <div>
                  <label className={labelClass} htmlFor="otp-code">
                    OTP code
                  </label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="6-digit code"
                    className={fieldClass}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-brand-700 hover:underline"
                    onClick={sendOtp}
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                </div>
              ) : null}

              {info ? (
                <p className="sc-fade-in rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  {info}
                </p>
              ) : null}
              {error ? (
                <p
                  className="sc-fade-in rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button type="submit" className={`${btnPrimary} w-full`} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" aria-hidden />
                    {otpSent ? 'Verifying…' : 'Sending…'}
                  </>
                ) : otpSent ? (
                  'Verify & sign in'
                ) : (
                  'Send OTP'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Demo account</p>
          <div className="mt-2 flex gap-2">
            <select
              id="demo-account"
              aria-label="Choose demo account"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white px-3 py-2 text-sm text-stone-800 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              value={demoKey}
              onChange={(e) => {
                setDemoKey(e.target.value)
                const demo = DEMO_LOGINS.find((d) => d.email === e.target.value)
                if (demo) fillDemo(demo)
              }}
            >
              {DEMO_LOGINS.map((demo) => (
                <option key={demo.email} value={demo.email}>
                  {demo.label} — {demo.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              onClick={applySelectedDemo}
            >
              Use
            </button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            onClick={() => {
              resetPlatformStore()
              setError('')
              setInfo('')
            }}
          >
            Reset demo data
          </button>
        </div>
      </div>

      <Modal
        open={forgotOpen}
        title={forgotTitle}
        onClose={closeForgot}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={closeForgot}>
              Cancel
            </button>
            {forgot.step === FORGOT_STEPS.otp ? (
              <button
                type="button"
                className={btnSecondary}
                disabled={forgotLoading}
                onClick={() => {
                  const result = sendPasswordResetOtp(forgot.identifier)
                  setForgotStatus(
                    result.ok
                      ? { type: 'success', message: result.message }
                      : { type: 'error', message: result.error }
                  )
                }}
              >
                Resend OTP
              </button>
            ) : null}
            <button
              type="submit"
              form="forgot-password-form"
              className={btnPrimary}
              disabled={forgotLoading}
            >
              {forgotLoading ? 'Please wait…' : forgotPrimaryLabel}
            </button>
          </div>
        }
      >
        <form id="forgot-password-form" className="space-y-3" onSubmit={submitForgot}>
          <p className="text-xs font-medium text-slate-500">
            Step {forgot.step} of 3
          </p>

          {forgot.step === FORGOT_STEPS.identifier ? (
            <>
              <p className="text-sm text-slate-600">
                Enter your account email or phone. We will send a 6-digit OTP (demo code shown on
                screen).
              </p>
              <div>
                <label htmlFor="forgot-identifier" className={labelClass}>
                  Email or phone
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  autoComplete="username"
                  className={fieldClass}
                  placeholder="Email or phone number"
                  value={forgot.identifier}
                  onChange={(e) =>
                    setForgot((prev) => ({
                      ...prev,
                      identifier: e.target.value,
                      status: { type: '', message: '' },
                    }))
                  }
                  required
                />
              </div>
            </>
          ) : null}

          {forgot.step === FORGOT_STEPS.otp ? (
            <>
              <p className="text-sm text-slate-600">
                Enter the 6-digit code sent to your email or phone.
              </p>
              <div>
                <label htmlFor="forgot-otp" className={labelClass}>
                  OTP code
                </label>
                <input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  className={fieldClass}
                  value={forgot.otp}
                  onChange={(e) =>
                    setForgot((prev) => ({
                      ...prev,
                      otp: e.target.value.replace(/\D/g, '').slice(0, 6),
                      status: { type: '', message: '' },
                    }))
                  }
                  required
                />
              </div>
            </>
          ) : null}

          {forgot.step === FORGOT_STEPS.password ? (
            <>
              <p className="text-sm text-slate-600">
                Create a new password, then sign in with it on the login form.
              </p>
              <div>
                <label htmlFor="forgot-new-password" className={labelClass}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="forgot-new-password"
                    type={forgot.showNew ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${fieldClass} pr-10`}
                    value={forgot.newPassword}
                    onChange={(e) =>
                      setForgot((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                        status: { type: '', message: '' },
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                    onClick={() => setForgot((prev) => ({ ...prev, showNew: !prev.showNew }))}
                    aria-label={forgot.showNew ? 'Hide password' : 'Show password'}
                  >
                    {forgot.showNew ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="forgot-confirm-password" className={labelClass}>
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="forgot-confirm-password"
                    type={forgot.showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className={`${fieldClass} pr-10`}
                    value={forgot.confirmPassword}
                    onChange={(e) =>
                      setForgot((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                        status: { type: '', message: '' },
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                    onClick={() =>
                      setForgot((prev) => ({ ...prev, showConfirm: !prev.showConfirm }))
                    }
                    aria-label={forgot.showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {forgot.showConfirm ? (
                      <FiEyeOff className="h-4 w-4" />
                    ) : (
                      <FiEye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {forgot.status.message ? (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                forgot.status.type === 'success'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-rose-100 bg-rose-50 text-rose-700'
              }`}
              role="status"
            >
              {forgot.status.message}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  )
}

export default Login
