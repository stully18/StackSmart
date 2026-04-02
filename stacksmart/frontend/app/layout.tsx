import type { Metadata } from 'next'
import { DM_Sans, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { FinancialProvider } from './context/FinancialContext'
import { AuthProvider } from './context/AuthContext'
import Navigation from './components/Navigation'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
})

export const metadata: Metadata = {
  title: 'StackSmart',
  description: 'Smart financial tools built for college students and new grads',
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
          </FinancialProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
