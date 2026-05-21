/**
 * CustomerCard — Premium Broker-Card Design
 * Linker Akzentstreifen · Initialen-Avatar · Progressive Disclosure
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Building2, ChevronDown, ChevronUp, Phone, Mail,
  AlertTriangle, Clock, Edit, Trash2, ArrowRight, Shield,
  TrendingUp, Calendar
} from 'lucide-react';
import ActionMenu from '@/components/shared/ActionMenu';
import { FAMILY_ROLE_LABELS, label } from '@/lib/labels';

const HEALTH = {
  green:  { accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Gesund' },
  yellow: { accent: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-400',   label: 'Aufmerksamkeit' },
  red:    { accent: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500',     label: 'Kritisch' },
};

function getHealth(c) {
  if (c.status === 'inactive' || c.mandate_status === 'invalid' || c.mandate_status === 'expired') return 'red';
  if (c.mandate_status === 'pending' || c.status === 'prospect') return 'yellow';
  return 'green';
}

function initials(c) {
  if (c.customer_type === 'business' && c.company_name) {
    return c.company_name.slice(0, 2).toUpperCase();
  }
  const f = (c.first_name || '').charAt(0).toUpperCase();
  const l = (c.last_name || '').charAt(0).toUpperCase();
  return `${f}${l}` || '?';
}

export default function CustomerCard({ customer, familyMembers = [], contractCount = 0, taskCount = 0, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const health = getHealth(customer);
  const h = HEALTH[health];
  const isCompany = customer.customer_type === 'business';

  const displayName = isCompany
    ? (customer.company_name || `${customer.last_name} ${customer.first_name}`)
    : `${customer.last_name} ${customer.first_name}`;

  const avatarBg = isCompany ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden hover:shadow-card-md transition-all group">
      <div className="flex">
        {/* Left accent bar */}
        <div className={`w-1 shrink-0 ${h.accent} rounded-l-xl`} />

        <div className="flex-1 px-4 py-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${avatarBg}`}>
              {initials(customer)}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    to={`/kunden/${customer.id}`}
                    className="text-[15px] font-bold text-foreground hover:text-primary leading-tight block"
                  >
                    {displayName}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {customer.customer_number && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {customer.customer_number}
                      </span>
                    )}
                    {isCompany && (
                      <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded font-medium">
                        Unternehmen
                      </span>
                    )}
                  </div>
                </div>

                {/* Health badge */}
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 flex items-center gap-1 ${h.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${h.dot}`} />
                  {h.label}
                </span>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-3 h-3" />{customer.email}
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="w-3 h-3" />{customer.phone}
                  </a>
                )}
                {customer.city && <span className="text-[11px] text-muted-foreground">{customer.city}</span>}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {contractCount > 0 && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                <Shield className="w-3 h-3 text-blue-500" />
                <span className="text-[11px] font-semibold text-blue-800">{contractCount} Police{contractCount !== 1 ? 'n' : ''}</span>
              </div>
            )}
            {customer.total_premium > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-800">CHF {customer.total_premium.toLocaleString('de-CH')}</span>
              </div>
            )}
            {taskCount > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3 h-3 text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-800">{taskCount} Task{taskCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {familyMembers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <User className="w-3 h-3 text-slate-500" />
                <span className="text-[11px] text-slate-700">{familyMembers.length} Fam.</span>
              </div>
            )}
            {customer.mandate_status === 'pending' && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-800">Mandat ausstehend</span>
              </div>
            )}
            {(customer.mandate_status === 'invalid' || customer.mandate_status === 'expired') && (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span className="text-[11px] font-semibold text-red-800">Mandat ungültig</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Link
                to={`/kunden/${customer.id}`}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Öffnen
              </Link>
              <button
                onClick={() => navigate(`/kunden/${customer.id}/360`)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3" /> 360°
              </button>
              {familyMembers.length > 0 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Familie
                </button>
              )}
            </div>
            <ActionMenu items={[
              { label: 'Bearbeiten', icon: Edit, onClick: () => onEdit(customer) },
              { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => onDelete(customer.id) },
            ]} />
          </div>
        </div>
      </div>

      {/* Family members */}
      {expanded && familyMembers.length > 0 && (
        <div className="bg-muted/30 border-t border-border/60 divide-y divide-border/40">
          {familyMembers.map(member => (
            <div key={member.id} className="px-5 py-2.5 pl-16 flex items-center justify-between gap-3">
              <Link to={`/kunden/${member.id}`} className="flex-1 min-w-0 group/m">
                <p className="text-sm font-medium group-hover/m:text-primary">{member.last_name} {member.first_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {label(FAMILY_ROLE_LABELS, member.family_role)} · {member.email}
                </p>
              </Link>
              <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                Familienmitglied
              </span>
              <ActionMenu items={[
                { label: 'Bearbeiten', icon: Edit, onClick: () => onEdit(member) },
                { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => onDelete(member.id) },
              ]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}