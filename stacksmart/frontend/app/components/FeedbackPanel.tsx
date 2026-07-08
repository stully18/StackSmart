'use client'

import { useState } from 'react'
import { Mail, MessageSquare, Send } from 'lucide-react'

interface FeedbackPanelProps {
  source: string
}

const SUPPORT_EMAIL = 'support@stacksmart.dev'

export default function FeedbackPanel({ source }: FeedbackPanelProps) {
  const [reaction, setReaction] = useState('useful')
  const [note, setNote] = useState('')

  const sendFeedback = () => {
    const subject = encodeURIComponent(`StackSmart beta feedback: ${source}`)
    const body = encodeURIComponent(
      [
        `Flow: ${source}`,
        `Reaction: ${reaction}`,
        '',
        'What I was trying to decide:',
        note.trim() || '[add context here]',
        '',
        'What felt confusing or missing:',
        '',
      ].join('\n')
    )

    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <MessageSquare size={18} />
            <h3 className="text-lg font-semibold text-text-primary">Help shape the beta</h3>
          </div>
          <p className="text-sm leading-6 text-text-secondary">
            Send quick feedback about what decision you were trying to make and where the result did or did not help.
          </p>
        </div>

        <div className="grid w-full gap-3 lg:max-w-md">
          <select
            value={reaction}
            onChange={(event) => setReaction(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm text-text-primary focus:border-primary focus:ring-1 focus:ring-primary/20"
            aria-label="Feedback reaction"
          >
            <option value="useful">Useful result</option>
            <option value="confusing">Confusing result</option>
            <option value="missing-context">Missing context</option>
            <option value="bug">Something broke</option>
          </select>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Example: I was deciding whether to pay off a 7% loan or increase my 401(k)."
            className="w-full resize-none rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={sendFeedback}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-primary-hover active:scale-[0.98]"
          >
            <Send size={16} />
            Send Feedback
          </button>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <Mail size={14} />
            Opens an email to {SUPPORT_EMAIL}; no financial details are stored by this form.
          </p>
        </div>
      </div>
    </div>
  )
}
