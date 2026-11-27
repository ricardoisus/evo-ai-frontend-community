import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, History, Plus, Radio, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import inboxesService from '@/services/channels/inboxesService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { extractError } from '@/utils/apiHelpers';
import { trackingApi, type Delivery, type Destination, type Draft, type Rule, type RuntimeMode } from './trackingApi';
import '@/components/instagram-amh/automation.css';
import './tracking.css';

const tabs = [
  { name: 'Visão geral', icon: Activity }, { name: 'Regras', icon: Settings2 },
  { name: 'Destinos Meta', icon: Radio }, { name: 'Histórico', icon: History },
] as const;
const triggers = { message_received: 'Mensagem recebida', message_sent: 'Envio confirmado', stage_entered: 'Entrada em etapa' };
const frequencies = { occurrence: 'Por ocorrência', contact: 'Por contato', acquisition: 'Por aquisição' };
const modes = { test: 'Teste', production: 'Produção' };
const historyModes = { ...modes, observation: 'Observação' };
const ruleModes = { ...modes, test: 'Observação' };
const operators = { exact: 'É igual a', contains: 'Contém', starts_with: 'Começa com' };
const origins = { website: 'Site', ctwa: 'Anúncio · Click to WhatsApp', chat: 'WhatsApp', organic: 'Orgânico' };
const messageTypes = { text: 'Texto', image: 'Imagem', audio: 'Áudio', video: 'Vídeo', file: 'Arquivo', template: 'Modelo' };
const statuses: Record<string, string> = {
  pending: 'Pendente', sending: 'Em envio', accepted: 'Aceita', retryable: 'Aguardando retentativa',
  uncertain: 'Entrega incerta', rejected: 'Rejeitada', expired: 'Expirada', exhausted: 'Tentativas esgotadas',
  configuration_error: 'Erro de configuração', observed: 'Em observação', cancelled: 'Cancelada',
};
const runtimeLabels: Record<RuntimeMode, string> = {
  disabled: 'Captura desativada nesta caixa.',
  observation: 'Captura em observação. As correspondências ficam no Histórico.',
  production: 'Produção ativa para esta caixa.',
};
const results: Record<string, string> = {
  matched: 'O evento corresponde à regra.', missing_trigger: 'Selecione um gatilho para simular.',
  filter_mismatch: 'O evento não atende aos filtros.', text_mismatch: 'O texto não atende à condição.',
  different_trigger: 'O gatilho é diferente.', ineligible_message: 'A mensagem não é elegível para tracking.',
};
const errorText = (error: unknown) => extractError(error).message || 'Não foi possível concluir a operação.';
type Tab = typeof tabs[number]['name'];
type Option = { id: string; name: string };
type Pipeline = Option & { stages?: Option[] };
type Permissions = { create: boolean; update: boolean };

function Choices({ items }: { items: Record<string, string> }) {
  return <>{Object.entries(items).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>;
}

export default function WhatsappTracking() {
  const { user, isLoading } = useAuth();
  const { can, loading, isReady } = usePermissions();
  if (isLoading || loading || !isReady) return <p role="status">Carregando permissões…</p>;
  if (!['super_admin', 'account_owner', 'administrator', 'admin'].includes(user?.role?.key || '') || !can('automation_rules', 'read')) {
    return <p role="alert">O Tracking está disponível para administradores.</p>;
  }
  return <TrackingScreen permissions={{ create: can('automation_rules', 'create'), update: can('automation_rules', 'update') }} />;
}

function TrackingScreen({ permissions }: { permissions: Permissions }) {
  const [inboxes, setInboxes] = useState<Array<Option & { instance?: string }>>([]);
  const [inboxId, setInboxId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void inboxesService.list().then(({ data }) => {
      const items = data.filter(box => box.channel_type === 'Channel::Whatsapp').map(box => ({
        id: box.id, name: box.name,
        instance: typeof box.provider_config?.instance_name === 'string' ? box.provider_config.instance_name : undefined,
      }));
      if (live) setInboxes(items);
    }).catch(error => { if (live) setError(errorText(error)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const selected = inboxes.find(box => box.id === inboxId);
  return <section className="ig-automation ig-automation-overview wa-tracking">
    <header className="ig-title">
      <div><h1>Tracking de WhatsApp</h1><p>Configure as conversões e acompanhe as entregas à Meta por caixa de entrada.</p></div>
    </header>
    <div className="ig-connection">
      <Radio aria-hidden size={24} />
      <label>Caixa de WhatsApp
        <select value={inboxId} onChange={event => setInboxId(event.target.value)}>
          <option value="">Selecione uma caixa</option>
          {inboxes.map(box => <option key={box.id} value={box.id}>{box.name}{box.instance ? ` · ${box.instance}` : ''}</option>)}
        </select>
      </label>
    </div>
    {error && <p role="alert" className="ig-alert">{error}</p>}
    {loading && <p role="status">Carregando caixas…</p>}
    {!loading && !error && !inboxes.length && <p>Nenhuma caixa de WhatsApp está disponível.</p>}
    {selected && <InboxTracking key={selected.id} inbox={selected.id} permissions={permissions} />}
  </section>;
}

function InboxTracking({ inbox, permissions }: { inbox: string; permissions: Permissions }) {
  const [tab, setTab] = useState<Tab>('Visão geral');
  const [rules, setRules] = useState<Rule[]>([]);
  const [runtime, setRuntime] = useState<RuntimeMode>('disabled');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [rule, setRule] = useState<Rule | 'new'>();
  const [destination, setDestination] = useState<Destination | 'new'>();
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    void Promise.all([trackingApi.rules(inbox), trackingApi.destinations(inbox)]).then(([rules, destinations]) => {
      if (!live) return;
      setRules(rules.data);
      setRuntime(rules.meta.runtime_mode);
      setDestinations(destinations);
    }).catch(error => { if (live) setError(errorText(error)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [inbox, reload]);
  function open(next: Tab) {
    setTab(next);
    setRule(undefined);
    setDestination(undefined);
  }
  function refresh() { setReload(value => value + 1); }
  const activeRules = rules.filter(item => item.active);
  return <>
    <nav className="wa-tracking-nav" aria-label="Seções de Tracking">
      {tabs.map(({ name, icon: Icon }) => <button type="button" key={name} aria-current={tab === name ? 'page' : undefined} onClick={() => open(name)}>
        <Icon size={16} aria-hidden />{name}
      </button>)}
    </nav>
    {error && <p role="alert" className="ig-alert">{error}</p>}
    {!loading && !error && <p className="wa-tracking-runtime">{runtimeLabels[runtime]}</p>}
    {loading && <p role="status">Carregando Tracking…</p>}
    {tab === 'Visão geral' && !loading && !error && <>
      <div className="ig-metrics">
        <div><strong>{rules.length}</strong><span>Regras configuradas</span></div>
        <div><strong>{activeRules.length}</strong><span>Regras publicadas e ativas</span></div>
        <div><strong>{destinations.filter(item => item.credential_configured).length}</strong><span>Destinos com credencial</span></div>
      </div>
      <div className="ig-card wa-tracking-card"><h2>Últimas entregas</h2><DeliveryHistory inbox={inbox} destinations={destinations} compact /></div>
    </>}
    {tab === 'Regras' && <>
      <SectionHeader title="Regras" action={permissions.create && <button className="ig-primary" onClick={() => setRule('new')}><Plus size={16} /> Nova regra</button>} />
      {rule && <RuleEditor key={typeof rule === 'string' ? rule : rule.id} inbox={inbox} rule={rule === 'new' ? undefined : rule}
        destinations={destinations} permissions={permissions} onClose={() => setRule(undefined)}
        onSave={saved => { setRule(saved); refresh(); }} />}
      {!rule && !loading && !error && <div className="ig-automation-list">
        {rules.map(item => <article className="ig-rule-card" key={item.id}>
          <header><Settings2 size={18} aria-hidden /><span className={`ig-status ${item.active ? 'ig-status-active' : ''}`}>
            {item.active ? 'Ativa' : item.published ? 'Pausada' : 'Rascunho'}
          </span></header>
          <h2>{item.name}</h2>
          <p>{triggers[item.draft.trigger as keyof typeof triggers] || 'Gatilho pendente'} · {item.draft.event_name || 'Evento pendente'}</p>
          <button onClick={() => setRule(item)}>Abrir configuração <ArrowRight size={15} /></button>
        </article>)}
        {!rules.length && <p>Nenhuma regra criada para esta caixa.</p>}
      </div>}
    </>}
    {tab === 'Destinos Meta' && <>
      <SectionHeader title="Destinos Meta" action={permissions.create && <button className="ig-primary" onClick={() => setDestination('new')}><Plus size={16} /> Novo destino</button>} />
      {destination && <DestinationEditor key={typeof destination === 'string' ? destination : destination.id} inbox={inbox}
        destination={destination === 'new' ? undefined : destination} onClose={() => setDestination(undefined)} onSave={() => { setDestination(undefined); refresh(); }} />}
      {!destination && !loading && !error && <div className="ig-automation-list">
        {destinations.map(item => <article className="ig-rule-card" key={item.id}>
          <header><Radio size={18} aria-hidden /><span className={`ig-status ${item.credential_configured ? 'ig-status-active' : ''}`}>
            {item.credential_configured ? 'Credencial configurada' : 'Credencial pendente'}
          </span></header>
          <h2>{item.name}</h2><p>Dataset {item.dataset_id}</p>
          {permissions.update && <button onClick={() => setDestination(item)}>Editar destino <ArrowRight size={15} /></button>}
        </article>)}
        {!destinations.length && <p>Nenhum destino criado para esta caixa.</p>}
      </div>}
    </>}
    {tab === 'Histórico' && <><SectionHeader title="Histórico de entregas" /><DeliveryHistory inbox={inbox} destinations={destinations} canRetry={permissions.update} /></>}
  </>;
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return <header className="wa-tracking-section"><h2>{title}</h2>{action}</header>;
}

function RuleEditor({ inbox, rule, destinations, permissions, onClose, onSave }: {
  inbox: string; rule?: Rule; destinations: Destination[]; permissions: Permissions; onClose: () => void; onSave: (rule: Rule) => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [draft, setDraft] = useState<Draft>(rule?.draft || { trigger: 'message_received', frequency: 'occurrence', mode: 'test' });
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Option[]>([]);
  const [sample, setSample] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editable = rule ? permissions.update : permissions.create;
  const pipelineId = draft.filters?.pipeline_id;
  useEffect(() => {
    if (draft.trigger !== 'stage_entered') return;
    let live = true;
    void pipelinesService.getPipelines({ per_page: 100 }).then(({ data }) => {
      if (live) setPipelines(data.map(({ id, name }) => ({ id, name })));
    }).catch(error => { if (live) setError(errorText(error)); });
    return () => { live = false; };
  }, [draft.trigger]);
  useEffect(() => {
    let live = true;
    setStages([]);
    if (pipelineId) void pipelinesService.getPipelineStages(pipelineId).then(({ data }) => {
      if (live) setStages(data);
    }).catch(error => { if (live) setError(errorText(error)); });
    return () => { live = false; };
  }, [pipelineId]);
  function change(change: Partial<Draft>) {
    setDraft(prev => ({ ...prev, ...change }));
    setDirty(true);
    setResult('');
  }
  function changeFilter(key: string, value: string) {
    const filters = { ...draft.filters };
    if (key === 'pipeline_id') {
      delete filters.stage_id;
      delete filters.from_stage_id;
    }
    if (value) filters[key] = value;
    else delete filters[key];
    change({ filters });
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try { await action(); } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const clean = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== '' && value !== undefined)) as Draft;
      onSave(await trackingApi.saveRule(inbox, { name, draft: clean }, rule));
      setDirty(false);
    });
  }
  const update = (action: 'publish' | 'pause') => {
    if (rule) void run(async () => onSave(await trackingApi.action(inbox, rule, action)));
  };
  const stageTrigger = draft.trigger === 'stage_entered';
  const savedDraft = rule?.draft;
  const ruleReady = Boolean(savedDraft?.trigger && savedDraft.frequency && savedDraft.event_name &&
    savedDraft.destination_id && savedDraft.mode &&
    (savedDraft.trigger !== 'stage_entered' || savedDraft.filters?.stage_id));
  return <div className="ig-card wa-tracking-card">
    <SectionHeader title={rule ? rule.name : 'Nova regra'} action={<button onClick={onClose}>Voltar</button>} />
    {error && <p role="alert" className="ig-alert">{error}</p>}
    <form onSubmit={save}>
      <fieldset className="wa-tracking-form" disabled={!editable || busy}>
        <label>Nome<input required maxLength={120} value={name} onChange={event => { setName(event.target.value); setDirty(true); }} /></label>
        <label>Gatilho<select value={draft.trigger || ''} onChange={event => change({
          trigger: event.target.value, filters: draft.filters?.origin ? { origin: draft.filters.origin } : {}, text: undefined,
        })}><Choices items={triggers} /></select></label>
        <label>Frequência<select value={draft.frequency || ''} onChange={event => change({ frequency: event.target.value })}><Choices items={frequencies} /></select></label>
        <label>Modo<select value={draft.mode || ''} onChange={event => change({ mode: event.target.value })}><Choices items={ruleModes} /></select></label>
        <label>Evento Meta<input maxLength={50} placeholder="Lead" value={draft.event_name || ''} onChange={event => change({ event_name: event.target.value })} /></label>
        <label>Destino Meta<select value={draft.destination_id || ''} onChange={event => change({ destination_id: event.target.value })}>
          <option value="">Selecione um destino</option>{destinations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Origem<select value={draft.filters?.origin || ''} onChange={event => changeFilter('origin', event.target.value)}>
          <option value="">Todas as origens</option><Choices items={origins} />
        </select></label>
        {stageTrigger ? <>
          <label>Pipeline<select value={pipelineId || ''} onChange={event => changeFilter('pipeline_id', event.target.value)}>
            <option value="">Selecione um pipeline</option>{pipelines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Etapa de destino<select value={draft.filters?.stage_id || ''} onChange={event => changeFilter('stage_id', event.target.value)}>
            <option value="">Selecione uma etapa</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>Etapa anterior<select value={draft.filters?.from_stage_id || ''} onChange={event => changeFilter('from_stage_id', event.target.value)}>
            <option value="">Qualquer etapa anterior</option>{stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
        </> : <>
          <label>Tipo de mensagem<select value={draft.filters?.message_type || ''} onChange={event => changeFilter('message_type', event.target.value)}>
            <option value="">Todos os tipos</option><Choices items={messageTypes} />
          </select></label>
          <label>Condição de texto<select value={draft.text?.operator || ''} onChange={event => change({
            text: event.target.value ? { operator: event.target.value, value: draft.text?.value || '' } : undefined,
          })}><option value="">Sem condição</option><Choices items={operators} /></select></label>
          {draft.text && <label>Texto da condição<input maxLength={500} required value={draft.text.value} onChange={event => {
            if (draft.text) change({ text: { ...draft.text, value: event.target.value } });
          }} /></label>}
        </>}
      </fieldset>
      <div className="wa-tracking-actions">
        {editable && <button className="ig-primary" disabled={busy} type="submit">Salvar rascunho</button>}
        {rule && permissions.update && <button disabled={busy || dirty || !ruleReady} type="button" onClick={() => update('publish')}>Publicar regra</button>}
        {rule?.active && permissions.update && <button disabled={busy} type="button" onClick={() => update('pause')}>Pausar</button>}
      </div>
    </form>
    {rule && <div className="wa-tracking-simulation">
      <h3>Simulação</h3>
      {!stageTrigger && <label>Texto sintético da mensagem<textarea maxLength={1000} rows={2} value={sample} onChange={event => setSample(event.target.value)} /></label>}
      <button disabled={busy || dirty} onClick={() => void run(async () => {
        const output = await trackingApi.simulate(inbox, rule, { ...rule.draft.filters, text: sample, confirmed: true });
        setResult(results[output.result] || output.result);
      })}>Simular regra</button>
      {result && <p role="status">{result}</p>}
    </div>}
  </div>;
}

function DestinationEditor({ inbox, destination, onClose, onSave }: {
  inbox: string; destination?: Destination; onClose: () => void; onSave: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name'));
    const dataset = String(form.get('dataset_id') || '');
    const reference = String(form.get('credential_ref') || '');
    setBusy(true);
    setError('');
    try {
      await trackingApi.saveDestination(inbox, { name, dataset_id: dataset || undefined, credential_ref: reference || undefined }, destination?.id);
      onSave();
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  }
  return <div className="ig-card wa-tracking-card">
    <SectionHeader title={destination ? 'Editar destino' : 'Novo destino'} action={<button onClick={onClose}>Voltar</button>} />
    {error && <p role="alert" className="ig-alert">{error}</p>}
    <form onSubmit={save}>
      <fieldset className="wa-tracking-form" disabled={busy}>
        <label>Nome<input name="name" defaultValue={destination?.name} maxLength={120} required /></label>
        <label>ID do dataset<input name="dataset_id" defaultValue={destination?.dataset_id} disabled={Boolean(destination)} inputMode="numeric" pattern="[0-9]{1,30}" required /></label>
        <label>Referência da credencial<input name="credential_ref" placeholder="WHATSAPP_TRACKING_META_…" pattern="WHATSAPP_TRACKING_META_[A-Z0-9_]{1,96}" required={!destination} /></label>
      </fieldset>
      <div className="wa-tracking-actions"><button className="ig-primary" disabled={busy}>Salvar destino</button></div>
    </form>
  </div>;
}

function DeliveryHistory({ inbox, destinations, compact = false, canRetry = false }: {
  inbox: string; destinations: Destination[]; compact?: boolean; canRetry?: boolean;
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [status, setStatus] = useState('');
  const [dataset, setDataset] = useState('');
  const [mode, setMode] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    void trackingApi.history(inbox, { page, status: status || undefined, dataset_id: dataset || undefined, mode: mode || undefined })
      .then(({ data, meta }) => {
        if (!live) return;
        setDeliveries(data);
        setPages(Math.max(1, Math.ceil(meta.total_count / meta.per_page)));
      }).catch(error => { if (live) setError(errorText(error)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [inbox, page, status, dataset, mode, reload]);
  async function retry(id: string) {
    setRetrying(id);
    setError('');
    try { await trackingApi.retry(inbox, id); setReload(value => value + 1); }
    catch (error) { setError(errorText(error)); }
    finally { setRetrying(''); }
  }
  return <div>
    {!compact && <div className="wa-tracking-form">
      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">Todos</option><Choices items={statuses} /></select></label>
      <label>Destino<select value={dataset} onChange={event => { setDataset(event.target.value); setPage(1); }}><option value="">Todos</option>
        {destinations.map(item => <option key={item.id} value={item.dataset_id}>{item.name}</option>)}
      </select></label>
      <label>Modo<select value={mode} onChange={event => { setMode(event.target.value); setPage(1); }}><option value="">Todos</option><Choices items={historyModes} /></select></label>
    </div>}
    {error && <p role="alert" className="ig-alert">{error}</p>}
    {loading && <p role="status">Carregando histórico…</p>}
    {!loading && !error && !deliveries.length && <p>Nenhuma entrega encontrada.</p>}
    {!loading && <div className="wa-tracking-feed">
      {(compact ? deliveries.slice(0, 5) : deliveries).map(item => <article key={item.id}>
        <header><strong>{item.event_name}</strong><span className={`ig-status ${item.status === 'accepted' ? 'ig-status-active' : item.status === 'uncertain' ? 'ig-status-test' : ''}`}>
          {statuses[item.status] || item.status}
        </span></header>
        <p>{new Date(item.created_at).toLocaleString('pt-BR')} · {destinations.find(destination => destination.dataset_id === item.dataset_id)?.name || item.dataset_id} · {historyModes[item.mode as keyof typeof historyModes]} · {item.attempt_count} tentativa(s)</p>
        {!compact && item.receipts.length > 0 && <details><summary>Recibos</summary><ol>
          {item.receipts.map(receipt => <li key={receipt.attempt_number}>
            {statuses[receipt.status] || receipt.status}{receipt.http_status ? ` · HTTP ${receipt.http_status}` : ''}{receipt.error_code ? ` · Código ${receipt.error_code}` : ''}{receipt.error_subcode ? `/${receipt.error_subcode}` : ''}
          </li>)}
        </ol></details>}
        {canRetry && ['configuration_error', 'exhausted'].includes(item.status) && <button disabled={Boolean(retrying)} onClick={() => void retry(item.id)}>Tentar novamente</button>}
      </article>)}
    </div>}
    {!compact && pages > 1 && <div className="wa-tracking-actions">
      <button disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
      <span>Página {page} de {pages}</span>
      <button disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Próxima</button>
    </div>}
  </div>;
}
