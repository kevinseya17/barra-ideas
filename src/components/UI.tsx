'use client';
import React from 'react';

// ── Btn ───────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'indigo' | 'yellow' | 'red' | 'ghost' | 'slate' | 'emerald';

const variantMap: Record<BtnVariant, string> = {
  primary:  'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
  indigo:   'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100',
  emerald:  'bg-emerald-600 text-white hover:bg-emerald-700',
  yellow:   'bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-sm',
  red:      'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  ghost:    'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600',
  slate:    'bg-slate-100 text-slate-700 hover:bg-slate-200',
};

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  full?: boolean;
}

export const Btn: React.FC<BtnProps> = ({
  variant = 'primary', size = 'md', icon, full, children, className = '', ...props
}) => {
  const sizes = { 
    sm: 'px-3.5 py-2 text-xs font-bold', 
    md: 'px-6 py-2.5 text-sm font-bold', 
    lg: 'px-8 py-3.5 text-base font-bold' 
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${full ? 'w-full' : ''} ${sizes[size]} ${variantMap[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

// ── Card ──────────────────────────────────────────────────────────────────────
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children, className = ''
}) => (
  <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] ${className}`}>
    {children}
  </div>
);

// ── Label ─────────────────────────────────────────────────────────────────────
export const Label: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = 'mb-2 ml-1' }) => (
  <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ${className}`}>{children}</p>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeColor = 'indigo' | 'yellow' | 'blue' | 'red' | 'violet' | 'slate' | 'orange' | 'cyan' | 'emerald';
const badgeMap: Record<BadgeColor, string> = {
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  yellow:  'bg-amber-50 text-amber-700 border-amber-100',
  blue:    'bg-blue-50 text-blue-700 border-blue-100',
  red:     'bg-rose-50 text-rose-600 border-rose-100',
  violet:  'bg-violet-50 text-violet-700 border-violet-100',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
  orange:  'bg-orange-50 text-orange-700 border-orange-100',
  cyan:    'bg-cyan-50 text-cyan-700 border-cyan-100',
};

export const Badge: React.FC<{ children: React.ReactNode; color?: BadgeColor }> = ({
  children, color = 'slate'
}) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeMap[color]}`}>
    {children}
  </span>
);

// ── Field ─────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
  icon?: React.ReactNode;
}
export const Field: React.FC<FieldProps> = ({ label, children, error, icon }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-1.5 mb-1.5 ml-1">
      {icon && <span className="text-indigo-400 shrink-0">{icon}</span>}
      <Label className="">{label}</Label>
    </div>
    {children}
    {error && <p className="text-rose-500 text-[11px] font-bold mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
  </div>
);

// ── Input base classes ────────────────────────────────────────────────────────
export const inputCls =
  'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm';

// ── Stat card ─────────────────────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}
export const Stat: React.FC<StatProps> = ({ label, value, sub, color = 'text-slate-900', icon }) => (
  <Card className="p-6">
    <div className="flex items-start justify-between gap-2 mb-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      {icon && <div className="p-2 bg-slate-50 rounded-lg text-slate-400">{icon}</div>}
    </div>
    <p className={`text-3xl font-bold tracking-tight leading-none ${color}`}>{value}</p>
    {sub && <p className="text-[11px] font-medium text-slate-400 mt-2">{sub}</p>}
  </Card>
);

export const SectionHeader: React.FC<{ title: string; sub?: string; step?: string; icon?: React.ReactNode }> = ({
  title, sub, step, icon
}) => (
  <div className="mb-10 mt-14">
    {step && <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 text-indigo-600">{step}</p>}
    <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
      {icon && <span className="text-slate-400">{icon}</span>}
      {title}
    </h2>
    {sub && (
      <div className="flex items-center gap-3 mt-4">
        <div className="w-1 h-6 bg-indigo-500/20 rounded-full" />
        <p className="text-slate-500 font-medium text-sm leading-relaxed">{sub}</p>
      </div>
    )}
  </div>
);

// ── categoría color ───────────────────────────────────────────────────────────
export const catColor: Record<string, BadgeColor> = {
  licor: 'violet', cerveza: 'yellow', gaseosa: 'blue',
  agua: 'cyan', snack: 'orange', otro: 'slate',
};
