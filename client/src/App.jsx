import { useState } from 'react';
import Calculadoras from './views/Calculadoras.jsx';
import Constructor from './views/Constructor.jsx';
import Leads from './views/Leads.jsx';
import Estadisticas from './views/Estadisticas.jsx';
import { useTheme } from './theme.js';

const TABS = [
  { id: 'calculadoras', label: 'Calculadoras', icon: "" },
  { id: 'leads', label: 'Bandeja de leads', icon: "" },
  { id: 'estadisticas', label: 'Estadísticas', icon: "" }
];

export default function App() {
  const [tab, setTab] = useState('calculadoras');
  const [editId, setEditId] = useState(null); // id de calculadora en el constructor
  const { theme, toggle } = useTheme();

  const abrirConstructor = (id) => setEditId(id);
  const cerrarConstructor = () => setEditId(null);

  return (
    <div className="vach-shell min-h-screen bg-paper-bg dark:bg-ink-bg">
      <header className="vach-header bg-paper-surface dark:bg-ink-surface border-b border-paper-card dark:border-ink-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-display font-semibold text-lg flex items-center gap-2 text-paper-text dark:text-ink-text">
            <span></span> Calculadora imán
          </div>
          <div className="flex items-center gap-2">
            {!editId && (
              <nav className="flex gap-1">
                {TABS.map((t) => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-marca-600 text-white' : 'text-paper-muted dark:text-ink-muted hover:bg-paper-card dark:hover:bg-ink-card'}`}>
                    <span className="mr-1">{t.icon}</span>{t.label}
                  </button>
                ))}
              </nav>
            )}
            <button onClick={toggle} className="p-1.5 rounded-full text-paper-dim dark:text-ink-dim hover:text-marca-600 dark:hover:text-accent-light" aria-label="Cambiar tema">
              {theme === 'dark' ? "Claro" : "Oscuro"}
            </button>
          </div>
        </div>
      </header>

      <main className="vach-main max-w-6xl mx-auto px-4 py-6">
        {editId ? (
          <Constructor id={editId} onClose={cerrarConstructor} />
        ) : tab === 'calculadoras' ? (
          <Calculadoras onEditar={abrirConstructor} />
        ) : tab === 'leads' ? (
          <Leads />
        ) : (
          <Estadisticas />
        )}
      </main>
    </div>
  );
}
