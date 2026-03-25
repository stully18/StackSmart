'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all password fields' })
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage({ type: 'success', text: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to change password' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-text-primary mb-6">Change Password</h2>

      {message && (
        <div className={`mb-4 p-4 rounded-lg border-l-4 ${
          message.type === 'success'
            ? 'bg-surface border-success text-success'
            : 'bg-surface border-destructive text-destructive'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 bg-surface-elevated/60 border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            placeholder="••••••••"
            disabled={isLoading}
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleChangePassword}
          disabled={isLoading}
          className="w-full py-2 btn-gradient text-white font-semibold rounded-lg transition-colors disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed disabled:bg-none mt-6 active:scale-[0.98]"
        >
          {isLoading ? 'Updating...' : 'Change Password'}
        </button>
      </div>
    </div>
  )
}
