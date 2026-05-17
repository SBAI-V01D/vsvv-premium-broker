import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Einheitliches Aktions-Dropdown für Tabellenzeilen.
 *
 * Props:
 *  - items: Array<{
 *      label: string,
 *      icon?: LucideIcon,
 *      onClick: () => void,
 *      variant?: 'default' | 'destructive',
 *      separator?: boolean  (fügt Trennlinie VOR diesem Element ein)
 *    }>
 *  - align: 'start' | 'end' (default 'end')
 */
export default function ActionMenu({ items = [], align = 'end' }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            {item.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={item.onClick}
              className={cn(item.variant === 'destructive' && 'text-destructive focus:text-destructive')}
            >
              {item.icon && <item.icon className="w-4 h-4 mr-2" />}
              {item.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}