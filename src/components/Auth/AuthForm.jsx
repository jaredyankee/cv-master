import { useState } from 'react'
import { authClient } from '../../auth'
import './AuthForm.css'

/**
 * Email + password sign-in / sign-up against Neon Auth.
 * On success the session store updates and App re-renders; no callback needed.
 */
export default function AuthForm() {
    const [mode, setMode]         = useState('signin')   // 'signin' | 'signup'
    const [name, setName]         = useState('')
    const [email, setEmail]       = useState('')
    const [password, setPassword] = useState('')
    const [error, setError]       = useState(null)
    const [busy, setBusy]         = useState(false)

    const isSignup  = mode === 'signup'
    const canSubmit = email.trim() && password.length >= 8 && (!isSignup || name.trim()) && !busy

    async function handleSubmit(e) {
        e.preventDefault()
        if (!canSubmit) return
        setBusy(true)
        setError(null)
        try {
            const result = isSignup
                ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
                : await authClient.signIn.email({ email: email.trim(), password })
            if (result?.error) {
                setError(result.error.message || 'Something went wrong. Please try again.')
            }
        } catch (err) {
            setError(err?.message || 'Could not reach the sign-in service.')
        } finally {
            setBusy(false)
        }
    }

    function switchMode() {
        setMode(isSignup ? 'signin' : 'signup')
        setError(null)
    }

    return (
        <div className="auth">
            <header className="auth-header">
                <h1 className="auth-title">CV Master</h1>
                <p className="auth-tagline">
                    {isSignup ? 'Create an account to get started.' : 'Sign in to continue.'}
                </p>
            </header>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {isSignup && (
                    <div className="auth-field">
                        <label htmlFor="auth-name" className="auth-label">Name</label>
                        <input
                            id="auth-name"
                            className="auth-input"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoComplete="name"
                            disabled={busy}
                        />
                    </div>
                )}

                <div className="auth-field">
                    <label htmlFor="auth-email" className="auth-label">Email</label>
                    <input
                        id="auth-email"
                        type="email"
                        className="auth-input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={busy}
                    />
                </div>

                <div className="auth-field">
                    <label htmlFor="auth-password" className="auth-label">Password</label>
                    <input
                        id="auth-password"
                        type="password"
                        className="auth-input"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        disabled={busy}
                    />
                    {isSignup && <span className="auth-hint">At least 8 characters.</span>}
                </div>

                {error && <p className="auth-error" role="alert">{error}</p>}

                <button type="submit" className="btn btn-primary auth-submit" disabled={!canSubmit}>
                    {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
                </button>

                <p className="auth-switch">
                    {isSignup ? 'Already have an account?' : 'New here?'}{' '}
                    <button type="button" className="auth-switch-btn" onClick={switchMode} disabled={busy}>
                        {isSignup ? 'Sign in' : 'Create one'}
                    </button>
                </p>
            </form>
        </div>
    )
}
