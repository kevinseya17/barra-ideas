'use client';
import React from 'react';

// ── Btn ───────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'brand' | 'indigo' | 'yellow' | 'red' | 'ghost' | 'slate' | 'emerald';

const variantMap: Record<BtnVariant, string> = {
  primary:  'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
  brand: 'bg-gradient-to-r from-[#00d2ff] to-[#ff0099] text-white shadow-[0_0_20px_rgba(0,210,255,0.4)] hover:shadow-[0_0_30px_rgba(0,210,255,0.6)] hover:scale-[1.02] border-none',
  indigo:   'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100',
  emerald:  'bg-emerald-600 text-white hover:bg-emerald-700',
  yellow:   'bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-sm',
  red:      'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  ghost:    'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-[#00d2ff] dark:hover:text-[#00d2ff]',
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
export function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`glass-card rounded-[2.5rem] shadow-sm transition-all duration-300 neon-border ${onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-cyan-500/10' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────
export const Label: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = 'mb-2 ml-1' }) => (
  <p className={`text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] ${className}`}>{children}</p>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeColor = 'brand' | 'indigo' | 'yellow' | 'blue' | 'red' | 'violet' | 'slate' | 'orange' | 'cyan' | 'emerald' | 'magenta';
const badgeMap: Record<BadgeColor, string> = {
  brand:   'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  yellow:  'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  blue:    'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  red:     'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
  violet:  'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20',
  slate:   'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10',
  orange:  'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
  cyan:    'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
  magenta: 'bg-magenta-50 text-[#ff0099] border-magenta-100 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20',
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
      {icon && <span className="text-[#00d2ff] shrink-0">{icon}</span>}
      <Label className="">{label}</Label>
    </div>
    {children}
    {error && <p className="text-rose-500 text-[11px] font-bold mt-1.5 ml-1 animate-in fade-in slide-in-from-top-1">{error}</p>}
  </div>
);

// ── Input base classes ────────────────────────────────────────────────────────
export const inputCls =
  'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium placeholder:text-slate-300 focus:outline-none focus:border-[#00d2ff] focus:ring-4 focus:ring-cyan-500/10 transition-all shadow-sm';

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
    {step && <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#ff0099]">{step}</p>}
    <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
      {icon && <span className="text-[#00d2ff]">{icon}</span>}
      {title}
    </h2>
    {sub && (
      <div className="flex items-center gap-3 mt-4">
        <div className="w-1 h-6 bg-gradient-to-b from-[#00d2ff] to-[#ff0099] rounded-full" />
        <p className="text-slate-500 font-medium text-sm leading-relaxed">{sub}</p>
      </div>
    )}
  </div>
);

// ── categoría color ───────────────────────────────────────────────────────────
export const catColor: Record<string, BadgeColor> = {
  licor: 'magenta', cerveza: 'yellow', gaseosa: 'blue',
  agua: 'brand', snack: 'orange', otro: 'slate',
};
