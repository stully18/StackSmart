import type { Metadata } from 'next'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { FinancialProvider } from './context/FinancialContext'
import { AuthProvider } from './context/AuthContext'
import Navigation from './components/Navigation'
import { Analytics } from '@vercel/analytics/react'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

export const metadata: Metadata = {
  title: {
    default: 'StackSmart — Build Wealth With Clarity',
    template: '%s — StackSmart',
  },
  description:
    'Free financial tools for college students and early-career professionals. Optimize debt, maximize your 401(k), plan a Roth IRA, and build an investment portfolio.',
  openGraph: {
    type: 'website',
    siteName: 'StackSmart',
    title: 'StackSmart — Build Wealth With Clarity',
    description:
      'Free financial tools for college students and early-career professionals. Optimize debt, maximize your 401(k), plan a Roth IRA, and build an investment portfolio.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StackSmart — Build Wealth With Clarity',
    description:
      'Free financial tools for college students and early-career professionals.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${instrumentSerif.variable}`}>
      <body className={`${dmSans.className} bg-background min-h-screen`}>
        <AuthProvider>
          <FinancialProvider>
            <Navigation />
            {children}
            <Analytics />
          </FinancialProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
