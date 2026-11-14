import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system';
import { usePermissions } from '@/contexts/PermissionsContext';
import {
  catalog,
  errorMessage,
  healthLabel,
  modeLabel,
  read,
  write,
  type ManagedAgent,
  type Mode,
  type Profile,
  type Revision,
  type Snapshot,
} from '@/services/agents/vetorialService';
import { LoadState, Status } from '@/components/agents/vetorial/Shared';
import { IntegrationsPanel, MetricsPanel, TestPanel } from '@/components/agents/vetorial/Panels';
function validation(payload: Snapshot): string {
  if (
    Object.values(payload.roles).some(
      r =>
        !r.prompt.trim() ||
        new TextEncoder().encode(r.prompt).length > 131072 ||
        !r.prompt_version.trim(),
    )
  )
    return 'Preencha o prompt e sua versão, respeitando o limite de 128 KiB.';
  for (const [key, [, min, max, scale]] of Object.entries(numericBehavior)) {
    const value = Number(payload.behavior[key]);
    if (!Number.isInteger(value / scale) || value < min * scale || value > max * scale)
      return 'Revise os tempos e limites: use números inteiros dentro dos intervalos indicados.';
  }
  const maximum: Record<string, number> = {
    messages_per_hour: 20,
    blocks_per_reply: 5,
    chars_per_block: 300,
    max_output_tokens: 2500,
    max_tool_rounds: 8,
  };
  if (
    Object.entries(payload.limits).some(
      ([key, value]) => !Number.isInteger(value) || value < 1 || value > maximum[key],
    )
  )
    return 'Um limite operacional está fora do intervalo permitido.';
  const hours = payload.behavior.office_hours as {
    enabled: boolean;
    windows: { weekday: number; start: string; end: string }[];
  };
  if (
    hours.enabled &&
    (!hours.windows.length ||
      hours.windows.some(
        w =>
          !Number.isInteger(w.weekday) ||
          w.weekday < 0 ||
          w.weekday > 6 ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.start) ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(w.end) ||
          w.start >= w.end,
      ) ||
      hours.windows.some((w, i) =>
        hours.windows.some(
          (other, j) =>
            i !== j && w.weekday === other.weekday && w.start < other.end && w.end > other.start,
        ),
      ))
  )
    return 'Adicione janelas válidas de expediente, sem sobreposição no mesmo dia.';
  return '';
}
const tabs = [
  'Visão geral',
  'Prompt e versões',
  'Comportamento',
  'Integrações',
  'Caixas e ativação',
  'Execuções',
  'Testar agente',
];
const numericBehavior: Record<string, [string, number, number, number]> = {
  text_debounce_ms: ['Espera entre textos (s)', 1, 120, 1000],
  audio_debounce_ms: ['Espera entre áudios (s)', 1, 180, 1000],
  analysis_silence_ms: ['Silêncio para análise (s)', 60, 3600, 1000],
  typing_cpm: ['Digitação (caracteres/min)', 300, 3000, 1],
  first_typing_cap_ms: ['Espera máxima inicial (s)', 0, 30, 1000],
  next_typing_cap_ms: ['Espera máxima seguinte (s)', 0, 30, 1000],
};
const limitLabels: Record<string, string> = {
  messages_per_hour: 'Mensagens por hora',
  blocks_per_reply: 'Blocos por resposta',
  chars_per_block: 'Caracteres por bloco',
  max_output_tokens: 'Tokens máximos de saída',
  max_tool_rounds: 'Rodadas máximas de ferramentas',
};
export function AgentWorkspace({
  id,
  editable,
  testable,
}: {
  id: string;
  editable: boolean;
  testable: boolean;
}) {
  const [profile, setProfile] = useState<Profile>();
  const [payload, setPayload] = useState<Snapshot>();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [peers, setPeers] = useState<ManagedAgent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState<Revision>();
  const [compare, setCompare] = useState<Revision>();
  const [challenge, setChallenge] = useState<{ nonce: string; phrase: string }>();
  const [phrase, setPhrase] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<Mode>('pilot');
  const [lists, setLists] = useState({ allowlist: '', internal_numbers: '' });
  const intent = useRef<{ body: string; key: string } | undefined>(undefined);
  const load = useCallback(async () => {
    setError('');
    try {
      const [p, r] = await Promise.all([read<Profile>(id), read<Revision[]>(id, '/revisions')]);
      setProfile(p);
      setPayload(structuredClone(p.published_revision.payload));
      setRevisions(r);
      setMode(p.mode);
      setLists({
        allowlist: p.published_revision.payload.activation.allowlist.join('\n'),
        internal_numbers: p.published_revision.payload.activation.internal_numbers.join('\n'),
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);
  useEffect(() => {
    setProfile(undefined);
    setDraft(undefined);
    setCompare(undefined);
    void load();
    let alive = true;
    catalog(1, 24)
      .then(x => {
        if (alive) setPeers(x.data.managed);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, load]);
  useEffect(() => {
    let alive = true;
    const timer = window.setInterval(() => {
      read<Profile>(id)
        .then(p => {
          if (alive)
            setProfile(
              previous =>
                previous && {
                  ...previous,
                  health: p.health,
                  applied_version: p.applied_version,
                  desired_version: p.desired_version,
                },
            );
        })
        .catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  const baseline = draft?.payload || profile?.published_revision.payload;
  const dirty = !!payload && JSON.stringify(payload) !== JSON.stringify(baseline);
  const activationDirty =
    !!profile &&
    (mode !== profile.mode ||
      lists.allowlist !== profile.published_revision.payload.activation.allowlist.join('\n') ||
      lists.internal_numbers !==
        profile.published_revision.payload.activation.internal_numbers.join('\n'));
  useEffect(() => {
    if (!dirty && !activationDirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    const click = (event: MouseEvent) => {
      if (
        (event.target as HTMLElement).closest('a') &&
        !window.confirm('Há alterações não salvas. Descartar e sair?')
      )
        event.preventDefault();
    };
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', guard);
      document.removeEventListener('click', click, true);
    };
  }, [dirty, activationDirty]);
  async function mutation(path: string, data: unknown, method: 'post' | 'put' = 'post') {
    if (!profile) return;
    if (path === '/revisions' && payload) {
      const invalid = validation(payload);
      if (invalid) {
        setError(invalid);
        return;
      }
    }
    setBusy(true);
    setNotice('');
    setError('');
    const body = JSON.stringify({ path, data, version: profile.lock_version });
    if (intent.current?.body !== body) intent.current = { body, key: crypto.randomUUID() };
    try {
      const r = await write<Revision>(
        id,
        path,
        data,
        profile.lock_version,
        intent.current.key,
        method,
      );
      intent.current = undefined;
      if (path === '/revisions' || path.endsWith('/restore')) {
        const p = await read<Profile>(id);
        setProfile(p);
        setDraft(r);
        setPayload(structuredClone(r.payload));
        setRevisions(await read(id, '/revisions'));
        setNotice('Rascunho salvo. Publique para aplicar a alteração. A ativação é preservada.');
      } else {
        setDraft(undefined);
        await load();
        setNotice('Versão publicada. Aguardando aplicação pelo serviço.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function activate() {
    if (mode === 'all') {
      setBusy(true);
      setError('');
      try {
        setChallenge(await write(id, '/activation_challenges', {}));
        setPhrase('');
        setConfirmed(false);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    } else await applyMode();
  }
  async function applyMode() {
    await mutation(
      '/activation',
      {
        mode,
        ...(profile?.control_source === 'crm'
          ? {
              allowlist: lists.allowlist.split(/[\s,]+/).filter(Boolean),
              internal_numbers: lists.internal_numbers.split(/[\s,]+/).filter(Boolean),
            }
          : {}),
        ...(mode === 'all' ? { nonce: challenge?.nonce, phrase, confirm: confirmed } : {}),
      },
      'put',
    );
    setChallenge(undefined);
  }
  if (!profile || !payload)
    return (
      <main className="va-page">
        <LoadState error={error} retry={load} />
      </main>
    );
  const role = payload.roles[profile.role];
  function updateRole(key: string, value: string) {
    setPayload(
      p =>
        p && {
          ...p,
          roles: { ...p.roles, [profile!.role]: { ...p.roles[profile!.role], [key]: value } },
        },
    );
  }
  function updateBehavior(key: string, value: unknown) {
    setPayload(p => p && { ...p, behavior: { ...p.behavior, [key]: value } });
  }
  const editingDisabled =
    !editable || !profile.can_manage || busy || profile.control_source !== 'crm';
  const promptBytes = new TextEncoder().encode(role.prompt).length;
  const listsValid = [lists.allowlist, lists.internal_numbers].every(x =>
    x
      .split(/[\s,]+/)
      .filter(Boolean)
      .every(n => /^\+[1-9]\d{7,14}$/.test(n)),
  );
  return (
    <main className="va-page">
      <Link to="/agents/list">← Agentes de IA</Link>
      <header className="va-panel">
        <div className="va-row va-between">
          <div>
            <h1>{profile.name}</h1>
            <p>
              {profile.role === 'analista'
                ? 'Análise do pipeline · somente interna'
                : 'Atendimento e agenda'}
            </p>
          </div>
          <div className="va-row">
            {editable && profile.can_manage && (
              <Button
                variant="outline"
                disabled={busy || profile.mode === 'off'}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm(
                      'Desligar o agente e descartar as alterações de configuração não salvas?',
                    )
                  )
                    void mutation('/activation', { mode: 'off' }, 'put');
                }}
              >
                Desligar
              </Button>
            )}
            {testable && (
              <Button variant="outline" onClick={() => setTab(6)}>
                Testar agente
              </Button>
            )}
            {editable && profile.can_manage && !dirty && tab !== 6 && (
              <Button variant="outline" disabled>
                Salvar rascunho
              </Button>
            )}
            {editable && profile.can_manage && tab !== 6 && (
              <Button
                disabled={editingDisabled || !draft || dirty}
                onClick={() => mutation(`/revisions/${draft!.id}/publish`, {})}
              >
                Publicar
              </Button>
            )}
          </div>
        </div>
        <div className="va-row">
          <Status value={profile.mode} label={modeLabel[profile.mode]} />
          <Status value={profile.health} label={healthLabel[profile.health]} />
          <small>
            {profile.model} · Prompt {profile.prompt_version}
          </small>
        </div>
        <p>
          <small>
            Versão publicada {profile.desired_version} · Versão em uso{' '}
            {profile.applied_version ?? 'aguardando aplicação'}
          </small>
        </p>
        {peers
          .filter(x => x.id !== id)
          .map(x => (
            <Link key={x.id} to={`/agents/vetorial/${x.id}`}>
              {x.name} →
            </Link>
          ))}
        {profile.control_source !== 'crm' && (
          <p role="status">
            Transição em andamento. Desligar continua disponível; edição e publicação aguardam a
            conclusão.
          </p>
        )}
      </header>
      <nav className="va-tabs" role="tablist" aria-label="Configuração do agente">
        {tabs
          .filter((_, i) => i !== 6 || testable)
          .map((name, index) => (
            <button
              role="tab"
              id={`va-tab-${index}`}
              aria-controls="va-content"
              aria-selected={tab === index}
              tabIndex={tab === index ? 0 : -1}
              onKeyDown={e => {
                if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
                  e.preventDefault();
                  const next =
                    (index + (e.key === 'ArrowRight' ? 1 : -1) + (testable ? 7 : 6)) %
                    (testable ? 7 : 6);
                  setTab(next);
                  document.getElementById(`va-tab-${next}`)?.focus();
                }
              }}
              key={name}
              onClick={() => setTab(index)}
            >
              {name}
            </button>
          ))}
      </nav>
      {error && (
        <p className="va-error" role="alert">
          {error}{' '}
          <Button variant="outline" onClick={load}>
            Atualizar
          </Button>
        </p>
      )}
      {notice && (
        <p className="va-notice" role="status">
          {notice}
        </p>
      )}
      <div id="va-content" role="tabpanel" aria-labelledby={`va-tab-${tab}`}>
        {(tab === 0 || tab === 5) && <MetricsPanel id={id} />}
        {tab === 1 && (
          <section className="va-panel">
            <div className="va-two">
              <div>
                <h2>Prompt {draft ? '· rascunho' : '· publicado'}</h2>
                <label>
                  Versão do prompt
                  <input
                    disabled={editingDisabled}
                    value={role.prompt_version}
                    onChange={e => updateRole('prompt_version', e.target.value)}
                  />
                </label>
                <label>
                  Instruções do agente
                  <textarea
                    className="va-prompt"
                    disabled={editingDisabled}
                    value={role.prompt}
                    onChange={e => updateRole('prompt', e.target.value)}
                  />
                </label>
                <small className={promptBytes > 131072 ? 'va-error' : ''}>
                  {promptBytes.toLocaleString('pt-BR')} / 131.072 bytes
                </small>
              </div>
              <div>
                <h2>Histórico de versões</h2>
                <p>
                  Reverter cria um novo rascunho. O modo e a lista de permissão são preservados.
                </p>
                {revisions.map(r => (
                  <div className="va-panel" key={r.id}>
                    <div className="va-row va-between">
                      <span>
                        Versão {r.revision} · {r.status === 'draft' ? 'Rascunho' : 'Publicada'}
                      </span>
                      <small>
                        {new Date(r.created_at).toLocaleString('pt-BR')} ·{' '}
                        {r.created_by || 'Importação inicial'}
                      </small>
                    </div>
                    <div className="va-row">
                      {r.status === 'draft' && editable && (
                        <Button
                          variant="outline"
                          disabled={editingDisabled || dirty}
                          onClick={async () => {
                            try {
                              const revision = await read<Revision>(id, `/revisions/${r.id}`);
                              setDraft(revision);
                              setPayload(structuredClone(revision.payload));
                            } catch (e) {
                              setError(errorMessage(e));
                            }
                          }}
                        >
                          Abrir rascunho
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setError('');
                          try {
                            setCompare(await read(id, `/revisions/${r.id}`));
                          } catch (e) {
                            setError(errorMessage(e));
                          }
                        }}
                      >
                        Comparar
                      </Button>
                      {editable && (
                        <Button
                          variant="outline"
                          disabled={editingDisabled || dirty}
                          onClick={() => mutation(`/revisions/${r.id}/restore`, {})}
                        >
                          Reverter
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {compare && (
              <div className="va-two va-diff">
                <div>
                  <h3>Versão {compare.revision}</h3>
                  <pre>
                    {compare.payload.roles[profile.role].prompt.split('\n').map((line, i) => (
                      <span
                        className={line !== role.prompt.split('\n')[i] ? 'va-removed' : ''}
                        key={i}
                      >
                        {line !== role.prompt.split('\n')[i] ? '− ' : '  '}
                        {line}
                        {'\n'}
                      </span>
                    ))}
                  </pre>
                </div>
                <div>
                  <h3>{draft ? 'Rascunho atual' : 'Versão atual'}</h3>
                  <pre>
                    {role.prompt.split('\n').map((line, i) => (
                      <span
                        className={
                          line !== compare.payload.roles[profile.role].prompt.split('\n')[i]
                            ? 'va-added'
                            : ''
                        }
                        key={i}
                      >
                        {line !== compare.payload.roles[profile.role].prompt.split('\n')[i]
                          ? '+ '
                          : '  '}
                        {line}
                        {'\n'}
                      </span>
                    ))}
                  </pre>
                </div>
              </div>
            )}
          </section>
        )}
        {tab === 2 && (
          <section className="va-panel">
            <h2>Modelo e comportamento</h2>
            <div className="va-two">
              <label>
                Modelo
                <select
                  disabled={editingDisabled}
                  value={role.model}
                  onChange={e => updateRole('model', e.target.value)}
                >
                  <option value="gpt-6-luna">Luna · gpt-6-luna</option>
                  <option value="gpt-6.1-sol">Sol · gpt-6.1-sol</option>
                </select>
              </label>
              {Object.entries(numericBehavior)
                .filter(([key]) => key in payload.behavior)
                .map(([key, [label, min, max, scale]]) => (
                  <label key={key}>
                    {label}
                    <input
                      disabled={editingDisabled}
                      type="number"
                      min={min}
                      max={max}
                      step={1}
                      value={Number(payload.behavior[key]) / scale}
                      onChange={e => updateBehavior(key, Number(e.target.value) * scale)}
                    />
                  </label>
                ))}
              <label>
                Fuso horário
                <input
                  disabled={editingDisabled}
                  value={String(payload.behavior.timezone)}
                  readOnly
                />
              </label>
              {Object.entries(payload.limits).map(([key, value]) => (
                <label key={key}>
                  {limitLabels[key] || 'Limite operacional'}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    disabled={editingDisabled}
                    value={value}
                    onChange={e =>
                      setPayload({
                        ...payload,
                        limits: { ...payload.limits, [key]: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <OfficeHours
              value={
                payload.behavior.office_hours as {
                  enabled: boolean;
                  windows: { weekday: number; start: string; end: string }[];
                }
              }
              disabled={editingDisabled}
              onChange={v => updateBehavior('office_hours', v)}
            />
            <p>
              Fora do expediente, os eventos aguardam a próxima janela. Pausas humanas são
              preservadas.
            </p>
          </section>
        )}
        {tab === 3 && <IntegrationsPanel id={id} />}
        {tab === 4 && (
          <section className="va-panel">
            <h2>Caixas vinculadas</h2>
            {profile.role === 'analista' && (
              <p>
                Mesma caixa de Ricardo IA. O analista registra informações internas e não envia
                mensagens.
              </p>
            )}
            {payload.binding.inbox_ids.map(box => (
              <p key={box}>
                Caixa vinculada ·{' '}
                {profile.linked_inboxes?.find(x => x.id === box)?.name || 'WhatsApp vinculado'}
              </p>
            ))}
            <p>O vínculo existente é compartilhado pelos dois agentes.</p>
            <h2>Ativação</h2>
            <div className="va-two">
              <label>
                Modo
                <select
                  disabled={!editable || !profile.can_manage || busy || dirty}
                  value={mode}
                  onChange={e => setMode(e.target.value as Mode)}
                >
                  {Object.entries(modeLabel).map(([key, label]) => (
                    <option
                      disabled={profile.control_source !== 'crm' && key !== 'off'}
                      value={key}
                      key={key}
                    >
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div />
              <label>
                Lista de permissão (um número E.164 por linha)
                <textarea
                  disabled={editingDisabled}
                  value={lists.allowlist}
                  onChange={e => setLists({ ...lists, allowlist: e.target.value })}
                />
              </label>
              <label>
                Números internos excluídos
                <textarea
                  disabled={editingDisabled}
                  value={lists.internal_numbers}
                  onChange={e => setLists({ ...lists, internal_numbers: e.target.value })}
                />
              </label>
            </div>
            {!listsValid && (
              <p className="va-error" role="alert">
                Use o formato internacional, por exemplo +5511999990000.
              </p>
            )}
            {activationDirty && <p role="status">Alteração de ativação ainda não aplicada.</p>}
            <p>
              As listas são compartilhadas pelos dois papéis. Alterar a ativação publica uma nova
              versão imediatamente.
            </p>
            {editable && profile.can_manage && (
              <Button variant="outline" disabled={busy || dirty || !listsValid} onClick={activate}>
                Aplicar ativação
              </Button>
            )}
          </section>
        )}
        {tab === 6 && testable && <TestPanel id={id} revisions={revisions} />}
      </div>
      {editable && profile.can_manage && dirty && (
        <footer className="va-row va-between va-dirty">
          <span>
            {dirty
              ? 'Alterações não salvas'
              : draft
                ? 'Rascunho pronto para publicar'
                : 'Nenhuma alteração pendente'}
          </span>
          <div className="va-row">
            {dirty && (
              <Button variant="outline" onClick={() => setPayload(structuredClone(baseline!))}>
                Descartar
              </Button>
            )}
            <Button
              variant="outline"
              disabled={editingDisabled || !dirty || promptBytes > 131072}
              onClick={() => mutation('/revisions', { payload })}
            >
              Salvar rascunho
            </Button>
          </div>
        </footer>
      )}
      <Dialog
        open={!!challenge}
        onOpenChange={open => {
          if (!open) setChallenge(undefined);
        }}
      >
        <DialogContent className="va-dialog">
          <DialogHeader>
            <DialogTitle>Ativar para todos?</DialogTitle>
            <DialogDescription>
              O agente poderá atender todos os contatos elegíveis desta caixa. A confirmação expira
              em 60 segundos. Cancelar preserva a ativação atual.
            </DialogDescription>
          </DialogHeader>
          <label>
            Digite ATIVAR PARA TODOS
            <input value={phrase} onChange={e => setPhrase(e.target.value)} />
          </label>
          <label className="va-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
            />
            Confirmo a ampliação do atendimento.
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallenge(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              disabled={busy || phrase !== challenge?.phrase || !confirmed}
              onClick={applyMode}
            >
              Confirmar ativação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function OfficeHours({
  value,
  disabled,
  onChange,
}: {
  value: { enabled: boolean; windows: { weekday: number; start: string; end: string }[] };
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  if (!value) return null;
  return (
    <div>
      <label className="va-check">
        <input
          type="checkbox"
          disabled={disabled}
          checked={value.enabled}
          onChange={e => onChange({ ...value, enabled: e.target.checked })}
        />
        Restringir ao expediente
      </label>
      {value.enabled && (
        <>
          {value.windows.map((w, index) => (
            <div className="va-row" key={index}>
              <label>
                Dia (0 domingo a 6 sábado)
                <input
                  disabled={disabled}
                  value={String(w.weekday)}
                  onChange={e =>
                    onChange({
                      ...value,
                      windows: value.windows.map((x, i) =>
                        i === index ? { ...x, weekday: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              {(['start', 'end'] as const).map(key => (
                <label key={key}>
                  {key === 'start' ? 'Início' : 'Fim'}
                  <input
                    type="time"
                    disabled={disabled}
                    value={w[key]}
                    onChange={e =>
                      onChange({
                        ...value,
                        windows: value.windows.map((x, i) =>
                          i === index ? { ...x, [key]: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...value, windows: value.windows.filter((_, i) => i !== index) })
                }
              >
                Remover janela
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...value,
                windows: [...value.windows, { weekday: 1, start: '09:00', end: '18:00' }],
              })
            }
          >
            Adicionar janela
          </Button>
        </>
      )}
    </div>
  );
}
export default function VetorialAgentPage() {
  const { id } = useParams();
  const { can } = usePermissions();
  return id ? (
    <AgentWorkspace
      key={id}
      id={id}
      editable={can('ai_agents', 'update')}
      testable={can('ai_agents', 'update')}
    />
  ) : null;
}
