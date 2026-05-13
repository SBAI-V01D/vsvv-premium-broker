export default function EmailLink({ email, className = '' }) {
  if (!email) return null
  
  return (
    <a 
      href={`mailto:${email}`}
      className={`text-primary hover:underline ${className}`}
    >
      {email}
    </a>
  )
}