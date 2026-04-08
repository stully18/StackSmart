'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { resetPassword } from '@/lib/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error instanceof Error ? error.message : 'Failed to send reset email')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <Link
        href="/"
        aria-label="Back to StackSmart home"
        className="fixed top-6 left-6 z-50 flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background group"
      >
        <Layers size={22} className="text-primary" aria-hidden />
        <span className="text-[1.35rem] font-semibold tracking-tight text-text-primary transition-colors group-hover:text-white">
          StackSmart
        </span>
      </Link>

      <div className="glass-card rounded-xl shadow-2xl shadow-black/60 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-2">
            Reset Password
          </h1>
          <p className="text-text-muted">
            {submitted
              ? 'Check your email for a reset link.'
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-surface border-l-4 border-success rounded-lg">
              <p className="text-success text-sm font-medium">
                Reset link sent! Check your inbox (and spam folder).
              </p>
            </div>
            <Link
              href="/auth/login"
              className="block text-sm text-primary hover:text-primary-hover transition-colors mt-4"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-surface border-l-4 border-destructive rounded-lg">
                <p className="text-destructive text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 btn-gradient text-gray-900 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed disabled:bg-none transition-colors active:scale-[0.98]"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
