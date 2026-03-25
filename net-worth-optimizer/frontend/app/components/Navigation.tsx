'use client'

import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Settings, LogOut, ChevronDown, Layers } from 'lucide-react'

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
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border-subtle/60">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Layers size={18} className="text-primary" />
          <span className="text-[1.15rem] font-semibold tracking-tight text-text-primary transition-colors group-hover:text-white">
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
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {item.label}
                {pathname === item.href && (
                  <span className="absolute bottom-[-0.9rem] left-3.5 right-3.5 h-[2px] bg-gradient-to-r from-primary to-accent-violet rounded-full" />
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Right Side - Auth Status */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-7 h-7 rounded-full bg-surface-elevated animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="h-9 px-3 rounded-lg bg-surface border border-border-subtle hover:border-border text-text-secondary hover:text-text-primary transition-all flex items-center gap-2.5"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white leading-none">{userInitial}</span>
                </div>
                <span className="text-[13px] hidden sm:inline">{user.email}</span>
                <ChevronDown size={10} className="text-text-muted ml-0.5" />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-1.5 w-52 bg-surface border border-border-subtle rounded-xl shadow-2xl shadow-black/60 py-1 z-50">
                  <div className="px-3 py-2 border-b border-border-subtle mb-1">
                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60 transition-colors"
                    onClick={() => setShowDropdown(false)}
                  >
                    <Settings size={14} className="opacity-60" />
                    Settings
                  </Link>
                  <div className="border-t border-border-subtle my-1" />
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-secondary hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <LogOut size={14} className="opacity-60" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="px-3.5 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="px-3.5 py-1.5 btn-gradient text-sm rounded-lg"
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
