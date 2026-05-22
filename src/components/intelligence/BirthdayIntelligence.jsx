/**
 * BirthdayIntelligence — Relationship-Based Birthday Workspace
 * Shows birthdays: today, this week, next 30 days, age groups
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Phone, Mail, Calendar, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

const AGE_GROUPS = [
  { id: 'under_18', label: 'Unter 18', min: 0, max: 17 },
  { id: '18_30', label: '18–30', min: 18, max: 30 },
  { id: '30_40', label: '30–40', min: 31, max: 40 },
  { id: '40_50', label: '40–50', min: 41, max: 50 },
  { id: '50_60', label: '50–60', min: 51, max: 60 },
  { id: '60_plus', label: '60+', min: 61, max: 150 },
];

function calculateAge(birthdate) {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getAgeGroup(age) {
  return AGE_GROUPS.find(g => age >= g.min && age <= g.max);
}

function isBirthdayToday(birthdate) {
  if (!birthdate) return false;
  const today = new Date();
  const birth = new Date(birthdate);
  return today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth();
}

function isBirthdayThisWeek(birthdate) {
  if (!birthdate) return false;
  const today = new Date();
  const birth = new Date(birthdate);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  return birthdayThisYear >= today && birthdayThisYear <= weekFromNow;
}

function isBirthdayNext30Days(birthdate) {
  if (!birthdate) return false;
  const today = new Date();
  const birth = new Date(birthdate);
  const monthFromNow = new Date(today);
  monthFromNow.setDate(monthFromNow.getDate() + 30);
  
  const birthdayThisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  return birthdayThisYear >= today && birthdayThisYear <= monthFromNow;
}

export default function BirthdayIntelligence() {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers_birthdays'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors_list'],
    queryFn: () => base44.entities.Advisor.list('-created_date', 100),
    staleTime: 10 * 60 * 1000,
  });

  const primaryCustomers = customers.filter(c => !c.is_family_member && c.birthdate);

  // Categorize birthdays
  const today = primaryCustomers.filter(c => isBirthdayToday(c.birthdate));
  const thisWeek = primaryCustomers.filter(c => isBirthdayThisWeek(c.birthdate) && !isBirthdayToday(c.birthdate));
  const next30Days = primaryCustomers.filter(c => isBirthdayNext30Days(c.birthdate) && !isBirthdayThisWeek(c.birthdate));

  // Age groups
  const ageGrouped = AGE_GROUPS.map(group => ({
    ...group,
    customers: primaryCustomers.filter(c => {
      const age = calculateAge(c.birthdate);
      return age >= group.min && age <= group.max;
    }),
  }));

  const getAdvisorName = (advisorId) => {
    if (!advisorId) return 'Nicht zugewiesen';
    const advisor = advisors.find(a => a.id === advisorId);
    return advisor ? `${advisor.firstname} ${advisor.lastname}` : 'Nicht zugewiesen';
  };

  const BirthdayCard = ({ customer, highlight = false }) => {
    const age = calculateAge(customer.birthdate);
    const ageGroup = getAgeGroup(age);
    const advisorName = getAdvisorName(customer.advisor_id || customer.primary_advisor_id);

    return (
      <div className={cn(
        "surface-0 p-4 transition-all hover:shadow-card-md",
        highlight && "ring-2 ring-[hsl(var(--primary))]"
      )}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-heading font-semibold text-[hsl(var(--text-heading))]">
              {customer.first_name} {customer.last_name}
            </h3>
            {ageGroup && (
              <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">
                {ageGroup.label} · {age} Jahre
              </p>
            )}
          </div>
          {highlight && <Gift className="w-5 h-5 text-[hsl(var(--primary))]" />}
        </div>

        <div className="space-y-2 text-body-sm">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Berater</span>
            <span className="text-[hsl(var(--text-heading))] font-medium">{advisorName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Letzter Kontakt</span>
            <span className="text-[hsl(var(--text-heading))]">
              {customer.updated_date ? new Date(customer.updated_date).toLocaleDateString('de-CH') : 'Nie'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[hsl(var(--border-subtle))]">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
            <Phone className="w-3.5 h-3.5" />
            Anrufen
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
            <Mail className="w-3.5 h-3.5" />
            Mail
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Task
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Today */}
      {today.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))]">Heute Geburtstag</h2>
            <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">{today.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {today.map(c => <BirthdayCard key={c.id} customer={c} highlight />)}
          </div>
        </section>
      )}

      {/* This Week */}
      {thisWeek.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))]">Diese Woche</h2>
            <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">{thisWeek.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {thisWeek.map(c => <BirthdayCard key={c.id} customer={c} />)}
          </div>
        </section>
      )}

      {/* Next 30 Days */}
      {next30Days.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-[hsl(var(--text-muted))]" />
            <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))]">Nächste 30 Tage</h2>
            <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">{next30Days.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {next30Days.map(c => <BirthdayCard key={c.id} customer={c} />)}
          </div>
        </section>
      )}

      {/* Age Groups */}
      <section className="pt-6 border-t border-[hsl(var(--border-subtle))]">
        <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))] mb-6">Altersgruppen</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {ageGrouped.map(group => (
            <div key={group.id} className="surface-0 p-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--text-muted))] mb-2">
                {group.label}
              </p>
              <p className="text-3xl font-bold text-[hsl(var(--primary))]">{group.customers.length}</p>
              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-1">Kunden</p>
            </div>
          ))}
        </div>
      </section>

      {today.length === 0 && thisWeek.length === 0 && next30Days.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[hsl(var(--text-muted))]">Keine anstehenden Geburtstage</p>
        </div>
      )}
    </div>
  );
}