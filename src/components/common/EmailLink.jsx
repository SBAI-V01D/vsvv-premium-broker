export default function EmailLink({ email, className = '', subject = '', body = '' }) {
  if (!email) return null
  
  // Build mailto link — email must NOT be encoded, only subject and body
  let href = `mailto:${email}`
  if (subject) href += `?subject=${encodeURIComponent(subject)}`
  if (body) {
    const sep = subject ? '&' : '?'
    href += `${sep}body=${encodeURIComponent(body)}`
  }
  
  console.log('EmailLink Debug:', { email, href })
  
  return (
    <a href={href} className={`text-primary hover:underline ${className}`}>
      {email}
    </a>
  )
}