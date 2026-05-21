/**
 * CustomerCard — Moderne Kunden-Karte für das Command Center
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Building2, ChevronDown, ChevronUp, Phone, Mail,
  FileText, AlertTriangle, CheckCircle2, Clock, Edit, Trash2,
  ArrowRight, Shield
} from 'lucide-react';
import ActionMenu from '@/components/shared/ActionMenu';
import { FAMILY_ROLE_LABELS, label } from '@/lib/labels';

const HEALTH_CFG = {
  green:  { label: 'Gesund',       bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  yellow: { label: 'Aufmerksamkeit', bg: 'bg-amber-50', border: 'border-amber-200',   dot: 'bg-amber-500',   text: 'text-amber-700' },
  red:    { label: 'Kritisch',      bg: 'bg-red-50',    border: 'border-red-200',     dot: 'bg-red-500',     text: 'text-red-700' },
};

function getHealthColor(customer) {
  if (customer.status === 'inactive') return 'red';
  if (customer.mandate_status === 'invalid' || customer.mandate_status === 'expired') return 'red';
  if (customer.mandate_status === 'pending' || customer.status === 'prospect') return 'yellow';
  return 'green';
}

export default function CustomerCard({ customer, familyMembers = [], contractCount = 0, taskCount = 0, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const health = getHealthColor(customer);
  const cfg = HEALTH_CFG[health];
  const isCompany = customer.customer_type === 'business';
  const displayName = isCompany
    ? (customer.company_name || `${customer.last_name} ${customer.first_name}`)
    : `${customer.last_name} ${customer.first_name}`;

  return (
    <div className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-card-md ${cfg.border}`}>
      {/* Main card */}
      <div className={`px-4 py-3.5 ${cfg.bg}`}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCompany ? 'bg-violet-100' : 'bg-blue-100'}`}>
            {isCompany
              ? <Building2 className="w-4 h-4 text-violet-600" />
              : <User className="w-4 h-4 text-blue-600" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={`/kunden/${customer.id}`}
                  className="text-sm font-bold text-foreground hover:text-primary truncate block leading-tight"
                >
                  {displayName}
                </Link>
                {customer.customer_number && (
                  <span className="text-[10px] font-mono text-muted-foreground">{customer.customer_number}</span>
                )}
              </div>

              {/* Health badge */}
              <div className={`flex items-center gap-1.5 shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            </div>

            {/* Contact row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="w-3 h-3" /> {customer.email}
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="w-3 h-3" /> {customer.phone}
                </a>
              )}
              {customer.city && (
                <span className="text-[11px] text-muted-foreground">{customer.city}</span>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {contractCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-slate-600 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                  <Shield className="w-2.5 h-2.5 text-blue-500" /> {contractCount} Police{contractCount !== 1 ? 'n' : ''}
                </span>
              )}
              {customer.total_premium > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  CHF {customer.total_premium.toLocaleString('de-CH')}
                </span>
              )}
              {taskCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Clock className="w-2.5 h-2.5" /> {taskCount} Task{taskCount !== 1 ? 's' : ''}
                </span>
              )}
              {familyMembers.length > 0 && (
                <span className="text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {familyMembers.length} Fam.
                </span>
              )}
              {customer.mandate_status === 'pending' && (
                <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <AlertTriangle className="w-2.5 h-2.5" /> Mandat offen
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/[0.06]">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/kunden/${customer.id}`}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/80 border border-black/10 text-foreground hover:bg-white transition-colors"
            >
              Öffnen
            </Link>
            <button
              onClick={() => navigate(`/kunden/${customer.id}/360`)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/80 border border-black/10 text-foreground hover:bg-white transition-colors flex items-center gap-1"
            >
              <ArrowRight className="w-2.5 h-2.5" /> 360°
            </button>
            {familyMembers.length > 0 && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/80 border border-black/10 text-muted-foreground hover:bg-white transition-colors flex items-center gap-1"
              >
                {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
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

      {/* Family members */}
      {expanded && familyMembers.length > 0 && (
        <div className="bg-muted/30 border-t border-border/60 divide-y divide-border/40">
          {familyMembers.map(member => (
            <div key={member.id} className="px-4 py-2.5 pl-14 flex items-center justify-between gap-3">
              <Link to={`/kunden/${member.id}`} className="flex-1 min-w-0 group">
                <p className="text-sm font-medium group-hover:text-primary">{member.last_name} {member.first_name}</p>
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