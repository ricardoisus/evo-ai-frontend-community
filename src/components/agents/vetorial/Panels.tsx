import { useEffect, useState } from 'react';
import { Button } from '@evoapi/design-system';
import { Activity } from 'lucide-react';
import {
  errorMessage,
  read,
  write,
  type Metrics,
  type Revision,
  type TestSession,
} from '@/services/agents/vetorialService';
import { LoadState, Status } from './Shared';
const money = (micro: number | null) =>
  micro === null
    ? 'Indisponível'
    : new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 4,
      }).format(micro / 1000000);
export function MetricsPanel({ id }: { id: string }) {
  const [source, setSource] = useState('live');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<Metrics>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError('');
    read<Metrics>(id, '/metrics', {
      source,
      ...(from && to ? { from: `${from}T00:00:00-03:00`, to: `${to}T23:59:59-03:00` } : {}),
    })
      .then(value => {
        if (active) setData(value);
      })
      .catch(e => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id, source, from, to, retry]);
  return (
    <section className="va-panel">
      <h2>Métricas e execuções</h2>
      <p>Resultados do conjunto de agentes · America/Sao_Paulo</p>
      <div className="va-row">
        <label>
          Origem
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="live">Atendimento</option>
            <option value="test">Testes</option>
          </select>
        </label>
        <label>
          De
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" min={from} value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </div>
      {!data ? (
        <LoadState error={error} retry={() => setRetry(x => x + 1)} />
      ) : (
        <>
          <div className="va-kpis">
            {[
              ['Conversas atendidas', data.measurement_started_at ? data.conversations : '—'],
              ['Reuniões confirmadas', data.measurement_started_at ? data.appointments : '—'],
              [
                'Custo estimado do mês',
                (data.month_usage_unknown ?? data.usage_unknown) ||
                !(data.month_usage_known ?? data.usage_known)
                  ? 'Indisponível'
                  : money(data.month_cost_micro_usd),
              ],
              [
                'Latência p50 / p95',
                data.latency?.n
                  ? `${data.latency.p50_ms} / ${data.latency.p95_ms} ms`
                  : 'Sem medição',
              ],
              ['Erros', data.measurement_started_at ? data.errors : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <Activity size={16} aria-hidden="true" />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p>
            <small>
              {data.measurement_started_at
                ? `Medição iniciada em ${new Date(data.measurement_started_at).toLocaleDateString('pt-BR')}`
                : 'Sem dados no período'}{' '}
              · {data.usage_known} usos conhecidos · {data.usage_unknown} indisponíveis · Amostra de
              latência: {data.latency?.n ?? 0}
            </small>
          </p>
          <p>
            <small>
              Latência do primeiro envio confirmado. Custo estimado em USD; uso sem tarifa permanece
              indisponível.
            </small>
          </p>
          {data.recent_executions?.length ? (
            <div className="va-scroll">
              <table className="va-table">
                <thead>
                  <tr>
                    {['Papel', 'Estado', 'Versão', 'Data', 'Custo'].map(x => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_executions.map((x, i) => (
                    <tr key={i}>
                      <td>{x.role === 'analista' ? 'Análise interna' : 'Atendimento'}</td>
                      <td>
                        {{
                          completed: 'Concluída',
                          failed: 'Falhou',
                          uncertain: 'Incerta',
                          discarded: 'Descartada',
                          succeeded: 'Concluída',
                        }[x.status] || 'Registrada'}
                      </td>
                      <td>{x.revision}</td>
                      <td>{new Date(x.occurred_at).toLocaleString('pt-BR')}</td>
                      <td>{money(x.cost_micro_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LoadState empty="Nenhuma execução no período" />
          )}
        </>
      )}
    </section>
  );
}
export function IntegrationsPanel({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, string>>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError('');
    read<Record<string, string>>(id, '/integrations')
      .then(x => {
        if (active) setData(x);
      })
      .catch(e => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  return (
    <section className="va-panel">
      <div className="va-row va-between">
        <h2>Integrações</h2>
        <Button variant="outline" onClick={() => setRetry(x => x + 1)}>
          Verificar conexão
        </Button>
      </div>
      <p>Estado da última verificação do serviço. A verificação não executa o agente.</p>
      {!data ? (
        <LoadState error={error} retry={() => setRetry(x => x + 1)} />
      ) : (
        Object.entries(data).map(([key, value]) => (
          <div className="va-panel va-row va-between" key={key}>
            <span>
              {{
                openai: 'OpenAI · geração de respostas',
                groq: 'Groq · transcrição de áudio',
                calendly: 'Calendly · disponibilidade',
                google_gateway: 'Google Calendar · agendamentos',
                evolution: 'WhatsApp · canal de atendimento',
              }[key] || 'Integração'}
            </span>
            <Status
              value={value}
              label={
                { configured: 'Configurada', absent: 'Não configurada', error: 'Erro de conexão' }[
                  value
                ] || 'Sem verificação'
              }
            />
          </div>
        ))
      )}
    </section>
  );
}
export function TestPanel({ id, revisions }: { id: string; revisions: Revision[] }) {
  const [revision, setRevision] = useState(revisions[0]?.id || '');
  const [budget, setBudget] = useState('0.05');
  const [purpose, setPurpose] = useState('');
  const [criteria, setCriteria] = useState('');
  const [sample, setSample] = useState(3);
  const [session, setSession] = useState<TestSession>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [intent, setIntent] = useState<{ key: string; body: string } | undefined>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`vetorial-intent-v1:${id}`) || 'null') || undefined;
    } catch {
      return undefined;
    }
  });
  const storageKey = `vetorial-test-v1:${id}`;
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    let active = true;
    setBusy(true);
    read<TestSession>(id, `/test_sessions/${saved}`)
      .then(x => {
        if (active) setSession(x);
      })
      .catch(e => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, storageKey]);
  async function act(action: 'start' | 'turn' | 'close' | 'refresh') {
    setBusy(true);
    setError('');
    try {
      let result: TestSession;
      if (action === 'refresh')
        result = await read(
          id,
          `/test_sessions/${session?.id || sessionStorage.getItem(storageKey)}`,
        );
      else {
        const body =
          action === 'start'
            ? {
                revision_id: revision,
                budget_usd: budget,
                purpose,
                criteria,
                sample_count: sample,
                max_turns: 5,
              }
            : action === 'turn'
              ? { text }
              : {};
        const fingerprint = JSON.stringify(body);
        const key = intent?.body === fingerprint ? intent.key : crypto.randomUUID();
        setIntent({ key, body: fingerprint });
        sessionStorage.setItem(
          `vetorial-intent-v1:${id}`,
          JSON.stringify({ key, body: fingerprint }),
        );
        result = await write(
          id,
          action === 'start'
            ? '/test_sessions'
            : `/test_sessions/${session!.id}/${action === 'turn' ? 'messages' : 'close'}`,
          body,
          undefined,
          key,
        );
        setIntent(undefined);
        sessionStorage.removeItem(`vetorial-intent-v1:${id}`);
      }
      setSession(result);
      sessionStorage.setItem(storageKey, result.id);
      if (action === 'turn') setText('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="va-panel">
      <h2>Testar agente</h2>
      <p>
        Simulação sem API · ferramentas e agenda simuladas · gasto de inferência US$ 0. Nenhuma
        mensagem é enviada ao WhatsApp.
      </p>
      {error && (
        <p role="alert" className="va-error">
          {error}
        </p>
      )}
      {!session ? (
        <>
          <div className="va-two">
            <label>
              Versão
              <select value={revision} onChange={e => setRevision(e.target.value)}>
                {revisions.map(r => (
                  <option key={r.id} value={r.id}>
                    Versão {r.revision} · {r.status === 'draft' ? 'Rascunho' : 'Publicada'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Teto da sessão (USD)
              <input
                type="number"
                min="0.000001"
                max="0.50"
                step="0.01"
                value={budget}
                onChange={e => setBudget(e.target.value)}
              />
            </label>
            <label>
              Propósito
              <input value={purpose} maxLength={1000} onChange={e => setPurpose(e.target.value)} />
            </label>
            <label>
              Critério de aprovação
              <input
                value={criteria}
                maxLength={1000}
                onChange={e => setCriteria(e.target.value)}
              />
            </label>
            <label>
              Cenários na amostra
              <input
                type="number"
                min={3}
                max={5}
                value={sample}
                onChange={e => setSample(Number(e.target.value))}
              />
            </label>
          </div>
          <p>
            Limites compartilhados: US$ 0,50 por operador e frente; US$ 1,00 por dia. A reserva é
            verificada antes de cada turno.
          </p>
          <Button
            disabled={
              busy ||
              !purpose.trim() ||
              !criteria.trim() ||
              !revision ||
              Number(budget) <= 0 ||
              Number(budget) > 0.5 ||
              sample < 3 ||
              sample > 5
            }
            onClick={() => act('start')}
          >
            {busy ? 'Iniciando…' : 'Iniciar teste'}
          </Button>
        </>
      ) : (
        <>
          <div className="va-row va-between">
            <Status
              value={session.state}
              label={session.state === 'open' ? 'Sessão aberta' : 'Sessão encerrada'}
            />
            <Button variant="outline" disabled={busy} onClick={() => act('refresh')}>
              Atualizar sessão
            </Button>
            <Button
              variant="outline"
              disabled={busy || session.state !== 'open'}
              onClick={() => act('close')}
            >
              Terminar sessão
            </Button>
          </div>
          <p>
            Gasto:{' '}
            {money(
              typeof session.budget.spent_micro_usd === 'number'
                ? session.budget.spent_micro_usd
                : null,
            )}{' '}
            · Reservado:{' '}
            {money(
              typeof session.budget.reserved_micro_usd === 'number'
                ? session.budget.reserved_micro_usd
                : null,
            )}{' '}
            · Teto:{' '}
            {money(
              typeof session.budget.ceiling_micro_usd === 'number'
                ? session.budget.ceiling_micro_usd
                : null,
            )}
          </p>
          {session.messages.length ? (
            session.messages.map(m => (
              <article className="va-chat" key={m.request_id}>
                <h3>Você</h3>
                <p>{m.text}</p>
                <h3>Agente · simulação privada</h3>
                {m.response ? (
                  <SimulationResult value={m.response} />
                ) : (
                  <p>Resultado pendente. Atualize a sessão antes de repetir.</p>
                )}
              </article>
            ))
          ) : (
            <LoadState empty="Pronto para o primeiro cenário" />
          )}
          <label>
            Mensagem sintética
            <textarea value={text} maxLength={4000} onChange={e => setText(e.target.value)} />
          </label>
          <Button
            disabled={busy || !text.trim() || session.state !== 'open'}
            onClick={() => act('turn')}
          >
            {busy ? 'Processando…' : 'Enviar cenário'}
          </Button>
          {session.state !== 'open' && (
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.removeItem(storageKey);
                setSession(undefined);
              }}
            >
              Preparar outro teste
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function SimulationResult({ value }: { value: unknown }) {
  if (value == null || value === false) return null;
  if (typeof value === 'string' || typeof value === 'number') return <p>{String(value)}</p>;
  if (value === true) return <p>Sim</p>;
  if (Array.isArray(value))
    return (
      <div>
        {value.map((item, index) => (
          <SimulationResult key={index} value={item} />
        ))}
      </div>
    );
  const labels: Record<string, string> = {
    mensagens: 'Resposta simulada',
    text: 'Resposta simulada',
    acao: 'Ação sugerida',
    resumo: 'Resumo interno',
    summary: 'Resumo interno',
    campos: 'Campos sugeridos',
    fields: 'Campos sugeridos',
    etiquetas: 'Etiquetas sugeridas',
    labels: 'Etiquetas sugeridas',
    tools: 'Ferramentas simuladas',
    sugestao: 'Sugestão interna',
    private: 'Visível somente à equipe',
  };
  return (
    <div>
      {Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item != null)
        .map(([key, item]) => (
          <div key={key}>
            <h3>{labels[key] || 'Informação interna'}</h3>
            <SimulationResult value={item} />
          </div>
        ))}
    </div>
  );
}
