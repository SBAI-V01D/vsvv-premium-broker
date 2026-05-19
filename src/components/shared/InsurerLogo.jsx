/**
 * InsurerLogo — zeigt das Logo einer Versicherungsgesellschaft.
 * Fallback: farbiger Initialen-Avatar.
 */
import React, { useState } from 'react';
import { getInsurerLogo, getInsurerInitials } from '@/lib/insurerLogos';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-slate-100 text-slate-700',
];

function getColorIndex(name) {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xfffffff;
  return hash % AVATAR_COLORS.length;
}

export default function InsurerLogo({ name, size = 'md', className = '' }) {
  const [error, setError] = useState(false);
  const logoUrl = getInsurerLogo(name);
  const initials = getInsurerInitials(name);
  const colorCls = AVATAR_COLORS[getColorIndex(name)];

  const sizeMap = {
    xs:  { box: 'w-5 h-5',  text: 'text-[8px]',  img: 20 },
    sm:  { box: 'w-6 h-6',  text: 'text-[9px]',  img: 24 },
    md:  { box: 'w-8 h-8',  text: 'text-[10px]', img: 32 },
    lg:  { box: 'w-10 h-10',text: 'text-xs',     img: 40 },
    xl:  { box: 'w-12 h-12',text: 'text-sm',     img: 48 },
  };
  const s = sizeMap[size] || sizeMap.md;

  if (logoUrl && !error) {
    return (
      <div className={`${s.box} rounded-lg overflow-hidden flex items-center justify-center bg-white border border-border/60 shrink-0 ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          width={s.img}
          height={s.img}
          className="object-contain w-full h-full p-0.5"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${s.box} rounded-lg flex items-center justify-center font-bold shrink-0 ${colorCls} ${className}`}>
      <span className={s.text}>{initials}</span>
    </div>
  );
}