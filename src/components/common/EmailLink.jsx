import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function EmailLink({ email, className = '' }) {
  const [copied, setCopied] = useState(false)

  if (!email) return null

  const handleCopy = (e) => {
    e.preventDefault()
    navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="inline-flex items-center gap-1 group">
      <a 
        href={`mailto:${email}`}
        className={`text-primary hover:underline ${className}`}
      >
        {email}
      </a>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
        title="Email kopieren"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}