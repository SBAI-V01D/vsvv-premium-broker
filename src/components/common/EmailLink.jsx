export default function EmailLink({ email, className = '', subject = '', body = '' }) {
  if (!email) return null
  
  // Build mailto link with encoded subject and body
  let href = `mailto:${encodeURIComponent(email)}`
  if (subject) href += `?subject=${encodeURIComponent(subject)}`
  if (body) {
    const sep = subject ? '&' : '?'
    href += `${sep}body=${encodeURIComponent(body)}`
  }
  
  return (
    <a href={href} className={`text-primary hover:underline ${className}`}>
      {email}
    </a>
  )
}