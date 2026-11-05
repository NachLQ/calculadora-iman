export const euros = (n) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' €';

export const URGENCIAS = {
  urgente: 'Urgente',
  proximo_mes: 'Próximo mes',
  tres_meses: 'Próximos 3 meses',
  explorando: 'Explorando'
};

export const ESTADOS = {
  nuevo: { label: 'Nuevo', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300' },
  contactado: { label: 'Contactado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  presupuesto: { label: 'Presupuesto enviado', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300' },
  cerrado: { label: 'Cerrado', cls: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300' },
  descartado: { label: 'Descartado', cls: 'bg-paper-card text-paper-dim dark:bg-ink-card dark:text-ink-dim' }
};

export function Badge({ children, cls = 'bg-paper-card text-paper-muted dark:bg-ink-card dark:text-ink-muted' }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{children}</span>;
}

export function Card({ children, className = '' }) {
  return <div className={`vach-card bg-paper-surface dark:bg-ink-surface rounded-xl  border border-paper-card dark:border-ink-card ${className}`}>{children}</div>;
}

export function Input(props) {
  return <input {...props} className={`w-full px-3 py-2 border border-paper-card dark:border-ink-card bg-paper-surface dark:bg-ink-surface text-paper-text dark:text-ink-text placeholder:text-paper-dim dark:placeholder:text-ink-dim rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${props.className || ''}`} />;
}

export function Label({ children }) {
  return <label className="block text-xs font-semibold text-paper-muted dark:text-ink-muted mb-1">{children}</label>;
}

export function Button({ children, variant = 'primary', ...props }) {
  const styles = {
    primary: 'bg-marca-600 hover:bg-marca-700 text-white',
    ghost: 'bg-paper-surface dark:bg-ink-surface border border-paper-card dark:border-ink-card hover:bg-paper-card dark:hover:bg-ink-card text-paper-text dark:text-ink-text',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:text-red-400 dark:border-red-800/40'
  };
  return (
    <button {...props} className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${styles[variant]} ${props.className || ''}`}>
      {children}
    </button>
  );
}
