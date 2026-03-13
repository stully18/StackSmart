'use client'

import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

export default function Navigation() {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showDropdown, setShowDropdown] = useState(false)

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  // Hide nav on auth pages
  if (pathname?.startsWith('/auth')) {
    return null
  }

  const navItems = [
    { href: '/tools', label: 'Tools' },
    { href: '/investments', label: 'Investments' }
  ]

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?'

  return (
    <nav className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-[1.15rem] font-semibold tracking-tight text-zinc-50 transition-colors group-hover:text-white">
            StackSmart
          </span>
        </Link>

        {/* Center Nav Items - Only visible when logged in */}
        {user && !isLoading && (
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-1.5 text-sm font-medium transition-colors rounded-md ${
                  pathname === item.href
                    ? 'text-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item.label}
                {pathname === item.href && (
                  <span className="absolute bottom-[-0.9rem] left-3.5 right-3.5 h-[2px] bg-blue-500 rounded-full" />
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Right Side - Auth Status */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-7 h-7 rounded-full bg-zinc-800 animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 transition-all flex items-center gap-2.5"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white leading-none">{userInitial}</span>
                </div>
                <span className="text-[13px] hidden sm:inline">{user.email}</span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-zinc-600 ml-0.5">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-1.5 w-52 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl shadow-black/40 py-1 z-50">
                  <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Settings
                  </Link>
                  <div className="border-t border-zinc-800 my-1" />
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="px-3.5 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white text-sm font-medium rounded-lg transition-all"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
