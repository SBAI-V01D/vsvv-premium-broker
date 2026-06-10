/**
 * BreadcrumbBar — Automatisches Breadcrumb-System
 * Generiert Breadcrumbs aus der aktuellen URL-Struktur.
 * Unterstützt dynamische Routen (Kunden-ID → Kundename).
 */
import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROUTE_LABELS = {
  'kunden':                    'Kunden',
  'neukunden':                 'Neukunden',
  'vertraege':                 'Verträge',
  'antraege':                  'Anträge',
  'aufgaben':                  'Aufgaben',
  'dokumente':                 'Dokumente',
  'leads':                     'Leads',
  'verkaufschancen':           'Verkaufschancen',
  'vertragsablaeufe':          'Vertragsabläufe',
  'provisionen-courtagen':     'Provisionen & Courtagen',
  'berater-organisation':      'Berater & Organisation',
  'reporting':                 'Reporting',
  'beratungsdossier':          'Beratungsdossiers',
  '360':                       '360° Akte',
  'admin':                     'Admin',
  'enterprise-control-center': 'Enterprise Überwachung',
  'team-zugriffsrechte':       'Team & Zugriffsrechte',
  'ai-review':                 'KI Analyse',
  'partner':                   'Partner',
  'ceo-cockpit':               'CEO Cockpit',
  'finanz-dashboard':          'Finanzdashboard',
  'advanced-dashboard':        'Auswertungen',
  'coverage-intelligence':     'Deckungsanalyse',
  'execution-mode':            'Tagesplanung',
  'sales-autopilot':           'Sales Autopilot',
  'system-logs':               'System Logs',
  'admin-logs':                'Admin Logs',
  'enterprise-audit':          'Enterprise Audit',
  'system-check':              'System Check',
  'insurance-learning':        'Versicherungs-Lernzentrum',
  'dokument-extraktor':        'Dokument-Extraktor',
  'email-templates':           'E-Mail-Vorlagen',
  'email-kampagnen':           'E-Mail-Kampagnen',
  'status-verwaltung':         'Status-Verwaltung',
}

function looksLikeId(segment) {
  return segment.length > 12 && /^[a-zA-Z0-9_-]+$/.test(segment)
}

export default function BreadcrumbBar() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  // Find customer ID from /kunden/:id or /kunden/:customerId/360
  const kundenIdx = segments.indexOf('kunden')
  const customerId =
    kundenIdx >= 0 && segments[kundenIdx + 1] && looksLikeId(segments[kundenIdx + 1])
      ? segments[kundenIdx + 1]
      : null

  // Find partner ID from /partner/:id
  const partnerIdx = segments.indexOf('partner')
  const partnerId =
    partnerIdx >= 0 && segments[partnerIdx + 1] && looksLikeId(segments[partnerIdx + 1])
      ? segments[partnerIdx + 1]
      : null

  const { data: customer } = useQuery({
    queryKey: ['breadcrumb_customer', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }),
    select: d => d?.[0],
    enabled: !!customerId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: partner } = useQuery({
    queryKey: ['breadcrumb_partner', partnerId],
    queryFn: () => base44.entities.Partner.filter({ id: partnerId }),
    select: d => d?.[0],
    enabled: !!partnerId,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const items = useMemo(() => {
    const crumbs = [{ label: 'Dashboard', path: '/', icon: true }]
    let currentPath = ''

    segments.forEach((segment, idx) => {
      currentPath += '/' + segment

      if (looksLikeId(segment)) {
        const parent = segments[idx - 1]
        if (parent === 'kunden' && customer) {
          const name = customer.company_name ||
            `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
          // Link to detail view (Stammdaten)
          crumbs.push({ label: name, path: currentPath + '/detail' })
        } else if (parent === 'partner' && partner) {
          crumbs.push({ label: partner.name || 'Partner', path: currentPath })
        } else {
          crumbs.push({ label: '…', path: currentPath })
        }
      } else {
        const label = ROUTE_LABELS[segment]
        if (label) {
          crumbs.push({ label, path: currentPath })
        }
      }
    })

    return crumbs
  }, [segments, customer, partner])

  // Hide when we're on Dashboard or portal routes
  if (items.length <= 1 || location.pathname.startsWith('/portal')) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-5 sm:px-6 lg:px-8 py-2 border-b border-blue-100/40 bg-white/60 backdrop-blur-sm text-[11.5px] text-muted-foreground overflow-x-auto scrollbar-none"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-1 hover:text-primary transition-colors whitespace-nowrap font-medium',
                  item.icon && 'text-primary'
                )}
              >
                {item.icon && <Home className="w-3.5 h-3.5" />}
                {item.icon && <span>Dashboard</span>}
                {!item.icon && item.label}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}