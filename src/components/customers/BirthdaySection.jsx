import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Gift, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';



const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

function calculateAge(birthdate) {
  const birthDate = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDateCH(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function getDaysUntilBirthday(birthdate, referenceDate = new Date()) {
  const today = new Date(referenceDate);
  const birthDate = new Date(birthdate);
  const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  
  if (nextBirthday < today) {
    nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
  }
  
  const diffTime = nextBirthday - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function BirthdaySection({ customers }) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const birthdaysByTimeframe = useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    
    const result = {
      today: [],
      thisWeek: [],
      thisMonth: [],
      nextMonth: [],
    };

    customers.forEach(customer => {
      if (!customer.birthdate) return;
      
      const age = calculateAge(customer.birthdate);
      const daysUntil = getDaysUntilBirthday(customer.birthdate);
      const birthDate = new Date(customer.birthdate);
      
      const person = {
        customer,
        age,
        birthdate: customer.birthdate,
        formattedDate: formatDateCH(customer.birthdate),
        daysUntil,
      };

      if (daysUntil === 0) {
        result.today.push(person);
      } else if (daysUntil <= 7) {
        result.thisWeek.push(person);
      }
      
      if (birthDate.getMonth() === thisMonth) {
        result.thisMonth.push(person);
      }
      
      const nextMonth = (thisMonth + 1) % 12;
      if (birthDate.getMonth() === nextMonth) {
        result.nextMonth.push(person);
      }
    });

    return result;
  }, [customers]);

  const birthdaysInSelectedMonth = useMemo(() => {
    let filtered = customers
      .filter(c => {
        if (!c.birthdate) return false;
        const birthDate = new Date(c.birthdate);
        return birthDate.getMonth() === currentMonth;
      })
      .map(c => ({
        customer: c,
        age: calculateAge(c.birthdate),
        birthdate: c.birthdate,
        formattedDate: formatDateCH(c.birthdate),
      }));

    return filtered.sort((a, b) => {
      const dateA = new Date(a.birthdate).getDate();
      const dateB = new Date(b.birthdate).getDate();
      return dateA - dateB;
    });
  }, [customers, currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1));
  };

  const renderTimeframeCard = (title, persons, Icon) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[hsl(var(--border-subtle))]/40">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-6 h-6 rounded-md bg-[hsl(var(--primary))/0.1] flex items-center justify-center">
          <Icon className="w-3 h-3 text-[hsl(var(--primary))]" />
        </div>
        <h3 className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">{title}</h3>
        {persons.length > 0 && (
          <span className="ml-auto text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
            {persons.length}
          </span>
        )}
      </div>

      {persons.length === 0 ? (
        <p className="text-[9px] text-[hsl(var(--text-muted))] py-1.5">Keine Geburtstage</p>
      ) : (
        <div className="space-y-1">
          {persons.slice(0, 5).map(({ customer, age, formattedDate, daysUntil }) => (
            <Link
              key={customer.id}
              to={`/kunden/${customer.id}`}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[hsl(var(--surface-2))]/50 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))/0.15] flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-[hsl(var(--primary))]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[hsl(var(--text-heading))] truncate group-hover:text-[hsl(var(--primary))]">
                  {customer.company_name || `${customer.first_name} ${customer.last_name}`}
                </p>
                <p className="text-[9px] text-[hsl(var(--text-muted))]">
                  {formattedDate} · {age} J.
                  {daysUntil === 0 && <span className="ml-1 text-[hsl(var(--primary))] font-medium">· HEUTE</span>}
                  {daysUntil > 0 && daysUntil <= 7 && <span className="ml-1 text-[hsl(var(--warning))]">· in {daysUntil} T.</span>}
                </p>
              </div>
            </Link>
          ))}
          {persons.length > 5 && (
            <p className="text-[9px] text-[hsl(var(--text-muted))] text-center pt-0.5">
              +{persons.length - 5}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--primary))]">Geburtstage</h2>
          <p className="text-[9px] text-[hsl(var(--text-muted))] mt-0.5">
            Operative Übersicht
          </p>
        </div>
      </div>

      {/* Timeframe Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {renderTimeframeCard('Heute', birthdaysByTimeframe.today, Gift)}
        {renderTimeframeCard('Diese Woche', birthdaysByTimeframe.thisWeek, Gift)}
        {renderTimeframeCard('Dieser Monat', birthdaysByTimeframe.thisMonth, Gift)}
        {renderTimeframeCard('Nächster Monat', birthdaysByTimeframe.nextMonth, Gift)}
      </div>
    </div>
  );
}