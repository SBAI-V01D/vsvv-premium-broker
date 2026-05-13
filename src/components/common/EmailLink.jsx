export default function EmailLink({ email, className = '', subject = '', body = '' }) {
  if (!email) {
    console.warn('EmailLink: Keine Email vorhanden')
    return null
  }
  
  // Build mailto link — email must NOT be encoded, only subject and body
  let href = `mailto:${email}`
  if (subject) href += `?subject=${encodeURIComponent(subject)}`
  if (body) {
    const sep = subject ? '&' : '?'
    href += `${sep}body=${encodeURIComponent(body)}`
  }
  
  const handleClick = (e) => {
    console.log('EmailLink clicked:', { email, href })
    // mailto Links öffnen den Standard-Mail-Client
    window.location.href = href
  }
  
  return (
    <a 
      href={href} 
      onClick={handleClick}
      className={`text-primary hover:underline cursor-pointer ${className}`}
    >
      {email}
    </a>
  )
}