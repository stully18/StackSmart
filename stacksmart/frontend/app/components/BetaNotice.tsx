import { ShieldCheck } from 'lucide-react'

interface BetaNoticeProps {
  title?: string
  message?: string
}

export default function BetaNotice({
  title = 'Trustworthy beta',
  message = 'StackSmart is an educational planning tool. Use it to compare options and prepare questions, not as personalized financial, tax, or legal advice.',
}: BetaNoticeProps) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="font-semibold text-text-primary">{title}</p>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{message}</p>
        </div>
      </div>
    </div>
  )
}
