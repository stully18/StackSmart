'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { updatePassword } from '@/lib/auth'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await updatePassword(newPassword)
      if (error) {
        setError(error instanceof Error ? error.message : 'Failed to update password')
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/auth/login'), 2000)
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
            Set New Password
          </h1>
          <p className="text-text-muted">Choose a strong password for your account.</p>
        </div>

        {success ? (
          <div className="p-4 bg-surface border-l-4 border-success rounded-lg text-center">
            <p className="text-success text-sm font-medium">
              Password updated! Redirecting to sign in...
            </p>
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
                <label htmlFor="newPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 btn-gradient text-gray-900 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed disabled:bg-none transition-colors active:scale-[0.98] mt-2"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
