'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'

type PasswordStrength = 'weak' | 'good' | 'strong'

export default function SignUpForm() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Calculate password strength
  const getPasswordStrength = (pwd: string): PasswordStrength => {
    if (!pwd) return 'weak'

    const hasUpperCase = /[A-Z]/.test(pwd)
    const hasLowerCase = /[a-z]/.test(pwd)
    const hasNumbers = /[0-9]/.test(pwd)
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    const isLongEnough = pwd.length >= 12

    // Weak: less than 12 chars OR missing uppercase/lowercase OR missing numbers
    if (pwd.length < 12 || !hasUpperCase || !hasLowerCase || !hasNumbers) {
      return 'weak'
    }

    // Strong: 12+ chars AND all criteria met
    if (isLongEnough && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar) {
      return 'strong'
    }

    // Good: 12+ chars AND has uppercase/lowercase AND has numbers OR special chars
    if (isLongEnough && hasUpperCase && hasLowerCase && (hasNumbers || hasSpecialChar)) {
      return 'good'
    }

    return 'weak'
  }

  const passwordStrength = getPasswordStrength(password)

  // Get strength bar color
  const getStrengthColor = (): string => {
    switch (passwordStrength) {
      case 'weak':
        return 'bg-red-500'
      case 'good':
        return 'bg-amber-500'
      case 'strong':
        return 'bg-green-500'
    }
  }

  // Get strength text and color
  const getStrengthLabel = (): [string, string] => {
    switch (passwordStrength) {
      case 'weak':
        return ['Weak', 'text-red-400']
      case 'good':
        return ['Good', 'text-amber-400']
      case 'strong':
        return ['Strong', 'text-green-400']
    }
  }

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Validate all form fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      if (!validateForm()) {
        setIsLoading(false)
        return
      }

      const result = await signUp({
        email,
        password,
        fullName
      })

      if (result.error) {
        setErrors({
          submit: result.error instanceof Error ? result.error.message : 'Failed to create account'
        })
        setIsLoading(false)
        return
      }

      if (result.user) {
        router.push('/')
      }
    } catch (err) {
      setErrors({
        submit: 'An unexpected error occurred'
      })
      setIsLoading(false)
    }
  }

  const [strength, strengthLabel] = getStrengthLabel()
  const strengthWidth =
    passwordStrength === 'weak' ? 'w-1/3' : passwordStrength === 'good' ? 'w-2/3' : 'w-full'

  return (
    <div className="w-full max-w-md">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/40 p-8">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 mb-2">
            StackSmart
          </h1>
          <p className="text-zinc-500">Create your account</p>
        </div>

        {/* Submit Error Message */}
        {errors.submit && (
          <div className="mb-6 p-4 bg-zinc-900 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-400 text-sm font-medium">{errors.submit}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name Input */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-zinc-400 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              disabled={isLoading}
            />
            {errors.fullName && (
              <p className="text-red-400 text-sm mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}

            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-zinc-500">Password strength:</span>
                  <span className={`text-xs font-semibold ${strengthLabel}`}>{strength}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full ${getStrengthColor()} transition-all duration-300 ${strengthWidth}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-400 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="mt-6 text-center">
          <p className="text-zinc-500">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
