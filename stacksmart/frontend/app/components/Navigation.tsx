'use client'

import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Settings, LogOut, ChevronDown, Layers, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

export default function Navigation() {
  const { user, isLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showDropdown, setShowDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  // Scroll listener for transparent-to-solid behavior
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Hide nav on auth pages
  if (pathname?.startsWith('/auth')) {
    return null
  }

  const navItems = [
    { href: '/tools', label: 'Tools' },
    { href: '/investments', label: 'Investments' },
  ]

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?'

  const isLanding = pathname === '/'
  const isTransparent = isLanding && !scrolled

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isTransparent
          ? 'bg-transparent border-b border-transparent'
          : 'bg-background/90 backdrop-blur-xl border-b border-border-subtle/60'
      }`}
    >
      <div className="w-full px-5 md:px-8 lg:px-12 h-18 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <Layers size={22} className="text-primary" />
          <span className="text-[1.35rem] font-semibold tracking-tight text-text-primary transition-colors group-hover:text-white">
            StackSmart
          </span>
        </Link>

        {/* Center Nav Items - Desktop only, only when logged in */}
        {user && !isLoading && (
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-5 py-2 text-base font-medium transition-colors rounded-md ${
                  pathname === item.href
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {item.label}
                {pathname === item.href && (
                  <span className="absolute bottom-[-1.05rem] left-5 right-5 h-[2px] bg-gradient-to-r from-primary to-accent-violet rounded-full" />
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Desktop auth / user menu */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <div className="w-7 h-7 rounded-full bg-surface-elevated animate-pulse" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="h-11 px-4 rounded-lg bg-surface border border-border-subtle hover:border-border text-text-secondary hover:text-text-primary transition-colors duration-200 flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent-violet flex items-center justify-center">
                    <span className="text-xs font-semibold text-background leading-none">
                      {userInitial}
                    </span>
                  </div>
                  <span className="text-[15px] hidden sm:inline">{user.email}</span>
                  <ChevronDown size={12} className="text-text-muted ml-0.5" />
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
                  className="btn-gradient px-4 py-1.5 text-sm rounded-lg"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated/60 transition-colors duration-200"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="md:hidden overflow-hidden"
          >
            <div className="bg-surface/95 backdrop-blur-xl border-t border-border-subtle/60 px-5 py-4 flex flex-col gap-1">
              {/* Nav links - only when logged in */}
              {user && !isLoading && (
                <>
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        pathname === item.href
                          ? 'text-text-primary bg-primary-muted'
                          : 'text-text-muted hover:text-text-secondary hover:bg-surface-elevated/40'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-border-subtle my-2" />
                </>
              )}

              {/* Auth area */}
              {isLoading ? (
                <div className="w-7 h-7 rounded-full bg-surface-elevated animate-pulse mx-3" />
              ) : user ? (
                <>
                  <div className="px-3 py-2">
                    <p className="text-xs text-text-muted truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-elevated/40 transition-colors"
                  >
                    <Settings size={14} className="opacity-60" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <LogOut size={14} className="opacity-60" />
                    Log out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-gradient px-4 py-2 text-sm rounded-lg text-center"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
