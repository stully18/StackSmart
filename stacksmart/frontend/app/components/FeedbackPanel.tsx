'use client'

import { FormEvent, useState } from 'react'
import { CheckCircle2, MessageSquare, Send, XCircle } from 'lucide-react'
import { useAuth } from '@/app/context/AuthContext'

interface FeedbackPanelProps {
  source: string
}

const FORMSPARK_ENDPOINT = process.env.NEXT_PUBLIC_FORMSPARK_FEEDBACK_ENDPOINT

export default function FeedbackPanel({ source }: FeedbackPanelProps) {
  const { user } = useAuth()
  const [reaction, setReaction] = useState('useful')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const sendFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!FORMSPARK_ENDPOINT || !note.trim()) return

    setIsSubmitting(true)
    setStatus('idle')

    try {
      const response = await fetch(FORMSPARK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          source,
          reaction,
          message: note.trim(),
          page_url: window.location.href,
          user_id: user?.id ?? null,
          user_email: user?.email ?? null,
          submitted_at: new Date().toISOString(),
          _email: {
            subject: `StackSmart beta feedback: ${source}`,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Formspark returned ${response.status}`)
      }

      setNote('')
      setReaction('useful')
      setStatus('success')
    } catch (error) {
      console.error('[FeedbackPanel] Feedback submission failed:', error)
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
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

        <form onSubmit={sendFeedback} className="grid w-full gap-3 lg:max-w-md">
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
            required
            minLength={8}
            className="w-full resize-none rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-sm text-text-primary placeholder-text-muted/70 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={isSubmitting || !FORMSPARK_ENDPOINT}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={16} />
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </button>
          {status === 'success' && (
            <p className="flex items-center gap-2 text-xs font-medium text-primary">
              <CheckCircle2 size={14} />
              Feedback sent. Thanks for helping improve this beta.
            </p>
          )}
          {status === 'error' && (
            <p className="flex items-center gap-2 text-xs font-medium text-red-400">
              <XCircle size={14} />
              Feedback did not send. Please try again in a minute.
            </p>
          )}
          {!FORMSPARK_ENDPOINT && (
            <p className="flex items-center gap-2 text-xs text-text-muted">
              <XCircle size={14} />
              Feedback is not configured yet. Add NEXT_PUBLIC_FORMSPARK_FEEDBACK_ENDPOINT.
            </p>
          )}
          <p className="text-xs text-text-muted">
            Avoid sharing account numbers or other sensitive financial details.
          </p>
        </form>
      </div>
    </div>
  )
}
