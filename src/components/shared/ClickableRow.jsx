import React from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * ClickableRow - Eine universelle Komponente für alle clickable Rows
 * Ermöglicht Navigation zu verwandten Entitäten mit One-Click-Access
 * 
 * Usage:
 * <ClickableRow onClickCustomer={() => navigate(`/kunden/${customer_id}`)} className="...">
 *   <div>Content</div>
 * </ClickableRow>
 */
export default function ClickableRow({ 
  onClickCustomer, 
  onClickPolicy, 
  onClickTask,
  onClick,
  children, 
  className = '', 
  highlightColor = 'hover:bg-muted/50',
  cursor = 'cursor-pointer'
}) {
  const navigate = useNavigate()

  const handleClick = (e) => {
    // Wenn auf einen Button oder Link geklickt wurde, nicht navigieren
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.closest('button')) {
      return
    }
    onClick?.()
  }

  return (
    <div
      onClick={handleClick}
      className={`
        ${cursor} 
        ${highlightColor} 
        transition-colors 
        group
        ${className}
      `}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleClick(e)
      }}
    >
      {children}
    </div>
  )
}