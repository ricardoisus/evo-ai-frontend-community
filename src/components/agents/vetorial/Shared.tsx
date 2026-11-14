import { AlertCircle, AlertTriangle, Bot } from 'lucide-react';
import { Button } from '@evoapi/design-system';
import { Link } from 'react-router-dom';
import { healthLabel, modeLabel, type ManagedAgent } from '@/services/agents/vetorialService';
import './vetorial.css';
export function Notice({
  children,
  danger = false,
  retry,
  disabled = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
  retry?: () => void;
  disabled?: boolean;
}) {
  const Icon = danger ? AlertCircle : AlertTriangle;
  return (
    <div
      className={`va-banner${danger ? ' va-banner-danger' : ''}`}
      role={danger ? 'alert' : 'status'}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
      {retry && (
        <Button variant="ghost" disabled={disabled} onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function Status({ value, label }: { value: string; label: string }) {
  return (
    <span className="va-status" data-state={value}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
export function LoadState({
  error,
  empty,
  retry,
}: {
  error?: string;
  empty?: string;
  retry?: () => void;
}) {
  return error || empty ? (
    <div className="va-empty" role={error ? 'alert' : 'status'}>
      {error ? <AlertCircle /> : <Bot />}
      <h2>{error ? 'Não foi possível carregar' : empty}</h2>
      <p>{error || 'Os dados aparecerão aqui quando estiverem disponíveis.'}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  ) : (
    <div className="va-skeleton" aria-label="Carregando" role="status">
      <div className="va-skeleton-kpis" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="va-skeleton-table" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            {Array.from({ length: 5 }, (_, j) => (
              <span key={j} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
export function ManagedAgents({ agents }: { agents: ManagedAgent[] }) {
  return agents.length ? (
    <section className="va-managed" aria-label="Agentes gerenciados">
      <h2>Agentes Vetorial</h2>
      <div className="va-agent-grid">
        {agents.map(agent => (
          <Link className="va-agent-card" key={agent.id} to={`/agents/vetorial/${agent.id}`}>
            <div className="va-row">
              <Bot />
              <strong>{agent.name}</strong>
            </div>
            <p>
              {agent.role === 'analista' ? 'Análise interna do pipeline' : 'Atendimento e agenda'}
            </p>
            <div className="va-row">
              <Status value={agent.mode} label={modeLabel[agent.mode]} />
              <Status value={agent.health} label={healthLabel[agent.health]} />
            </div>
            <p>
              {agent.model} · Prompt {agent.prompt_version}
            </p>
            <small>
              Versão publicada {agent.desired_version} · Em uso{' '}
              {agent.applied_version ?? 'aguardando aplicação'}
            </small>
          </Link>
        ))}
      </div>
    </section>
  ) : null;
}
