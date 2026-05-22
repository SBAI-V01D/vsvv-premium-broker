/**
 * CustomerCard — Relationship Intelligence Card
 * Premium Financial Platform Aesthetic: whitespace · typography · monochrome
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Edit, Trash2, Phone, Mail, FileText, TrendingUp, Upload, User } from 'lucide-react';
import ActionMenu from '@/components/shared/ActionMenu';
import { FAMILY_ROLE_LABELS, label } from '@/lib/labels';
import HealthScoreRing, { calculateHealthScore } from '@/components/customers/HealthScoreRing';
import { cn } from '@/lib/utils';

function getStatus(c) {
  if (c.status === 'inactive' || ['invalid', 'expired'].includes(c.mandate_status)) return 'critical';
  if (c.mandate_status === 'pending' || c.status === 'prospect') return 'attention';
  return 'active';
}

function initials(c) {
  if (c.customer_type === 'business' && c.company_name) return c.company_name.slice(0, 2).toUpperCase();
  const f = (c.first_name || '').charAt(0);
  const l = (c.last_name || '').charAt(0);
  return `${f}${l}`.toUpperCase() || '—';
}

export default function CustomerCard({
  customer,
  familyMembers = [],
  contractCount = 0,
  taskCount = 0,
  matchedFamilyIds = new Set(),
  onEdit,
  onDelete,
  allContracts = [],
  allTasks = [],
  allDocuments = [],
}) {
  const hasFamilyMatch = familyMembers.some(m => matchedFamilyIds.has(m.id));
  const navigate = useNavigate();
  const status = getStatus(customer);
  const isCompany = customer.customer_type === 'business';
  
  // Calculate HealthScore
  const customerContracts = (allContracts || []).filter(c => c.customer_id === customer.id || c.primary_customer_id === customer.id)
  const customerTasks = (allTasks || []).filter(t => t.customer_id === customer.id)
  const customerDocs = (allDocuments || []).filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
  const healthScore = calculateHealthScore(customer, customerContracts, customerTasks, customerDocs)

  const displayName = isCompany
    ? (customer.company_name || `${customer.last_name} ${customer.first_name}`)
    : `${customer.last_name} ${customer.first_name}`;

  const hasMetrics = contractCount > 0 || customer.total_premium > 0 || taskCount > 0 || familyMembers.length > 0 || status !== 'active';

  return (
    <div className={`bg-card rounded-2xl transition-all hover:shadow-card-md ${
      status === 'critical' ? 'border border-red-200 shadow-sm' : 'border border-border/60 shadow-xs'
    }`}>
      <div className="px-6 py-5">

        {/* Top row: avatar + name + status + health score */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-semibold text-sm tracking-wide bg-slate-100 text-slate-600">
            {initials(customer)}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Link to={`/kunden/${customer.id}`} className="text-[15px] font-semibold text-slate-900 hover:text-primary leading-tight block truncate">
                  {displayName}
                </Link>
                <p className="text-[12px] text-slate-400 mt-0.5 truncate">
                  {customer.customer_number && <span className="font-mono mr-2">{customer.customer_number}</span>}
                  {customer.email}
                  {customer.city && <span className="ml-2">· {customer.city}</span>}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 mt-0.5">
                {/* Health Score Ring */}
                <HealthScoreRing score={healthScore} size="sm" showLabel={false} />
                
                {/* Status Badges */}
                {status === 'critical' && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                    Kritisch
                  </span>
                )}
                {status === 'attention' && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">
                    Prüfen
                  </span>
                )}
                
                <ActionMenu items={[
                  { label: 'Bearbeiten', icon: Edit, onClick: () => onEdit(customer) },
                  { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => onDelete(customer.id) },
                ]} />
              </div>
            </div>
          </div>
        </div>

        {/* Metrics + actions row */}
        {hasMetrics ? (
          <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5 flex-wrap flex-1">
              {contractCount > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Policen</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{contractCount}</p>
                </div>
              )}
              {customer.total_premium > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Jahresprämie</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">CHF {customer.total_premium.toLocaleString('de-CH')}</p>
                </div>
              )}
              {familyMembers.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Haushalt</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{familyMembers.length + 1} Personen</p>
                </div>
              )}
              {taskCount > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">Offene Tasks</p>
                  <p className="text-sm font-semibold text-amber-600 mt-0.5">{taskCount}</p>
                </div>
              )}
              {status === 'critical' && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <p className="text-[12px] text-red-600">
                    {customer.mandate_status === 'invalid' ? 'Mandat ungültig' :
                     customer.mandate_status === 'expired' ? 'Mandat abgelaufen' : 'Inaktiv'}
                  </p>
                </div>
              )}
              {status === 'attention' && customer.mandate_status === 'pending' && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[12px] text-amber-600">Mandat ausstehend</p>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 border-r border-border/40 pr-3">
                <button className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Anrufen">
                  <Phone className="w-4 h-4" />
                </button>
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="E-Mail">
                    <Mail className="w-4 h-4" />
                  </a>
                )}
                <Link to={`/beratungsdossier?customer_id=${customer.id}`} className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Dossier">
                  <FileText className="w-4 h-4" />
                </Link>
                <Link to={`/verkaufschancen?customer_id=${customer.id}`} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Verkaufschance">
                  <TrendingUp className="w-4 h-4" />
                </Link>
              </div>
              
              <div className="flex items-center gap-2">
                <Link to={`/kunden/${customer.id}`} className="text-[12px] font-medium text-primary hover:underline">
                  Profil öffnen →
                </Link>
                <button onClick={() => navigate(`/kunden/${customer.id}/360`)}
                  className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors">
                  360°
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <Link to={`/kunden/${customer.id}`} className="text-[12px] font-medium text-primary hover:underline">
              Profil öffnen →
            </Link>
            <span className="text-slate-200">|</span>
            <button onClick={() => navigate(`/kunden/${customer.id}/360`)}
              className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors">
              360°
            </button>
          </div>
        )}
      </div>

      {/* Family members — always visible */}
      {familyMembers.length > 0 && (
        <div className="border-t border-border/40 divide-y divide-border/30 bg-slate-50/50">
          {familyMembers.map(member => (
            <div key={member.id} className={`px-6 py-3 flex items-center justify-between gap-3 ${matchedFamilyIds.has(member.id) ? 'bg-primary/5' : ''}`}>
              <Link to={`/kunden/${member.id}`} className="flex-1 min-w-0 group/m">
                <p className={`text-[13px] font-medium group-hover/m:text-primary ${matchedFamilyIds.has(member.id) ? 'text-primary' : 'text-slate-700'}`}>
                  {member.last_name} {member.first_name}
                  {matchedFamilyIds.has(member.id) && (
                    <span className="ml-2 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">Suchtreffer</span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400">
                  {label(FAMILY_ROLE_LABELS, member.family_role)} · {member.email}
                  {member.birthdate && ` · *${member.birthdate.slice(0, 4)}`}
                </p>
              </Link>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium shrink-0">Haushalt</span>
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