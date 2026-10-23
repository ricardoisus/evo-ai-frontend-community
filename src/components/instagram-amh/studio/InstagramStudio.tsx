import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Eye, PanelRightClose, Pause, Settings2, Upload, Undo2, X, AlertCircle } from 'lucide-react';
import { extractError } from '@/utils/apiHelpers';
import type { ProofPermissions } from '../AmhVisualProof';
import { blockLabels, changesBetween, initialStudioGraph, localIssues, toStudioGraph, type Issue, type StudioRun } from './graph';
import { studioApi, type Catalog, type StudioApi } from './studioApi';
import { useStudioDraft } from './useStudioDraft';
import { StudioCanvas } from './StudioCanvas';
import { StudioProperties } from './StudioProperties';
import { StudioPreview } from './StudioPreview';
import { StudioTesting } from './StudioTesting';
import { StudioModal } from './StudioModal';
import { StudioReview } from './StudioReview';
import { StudioActivity } from './StudioActivity';
import './studio.css';
const saveLabels = { loading: 'Carregando…', saved: 'Rascunho salvo', pending: 'Alterações aguardando salvamento', saving: 'Salvando rascunho…', error: 'Falha ao salvar', conflict: 'Conflito de edição' };
const operationLabels = { paused: 'Pausada', test: 'Teste restrito', active: 'Ativa' };
export function InstagramStudio({ initialId, catalog, permissions, onBack, api = studioApi }: { initialId?: string; catalog: Catalog | null; permissions: ProofPermissions; onBack: () => void; api?: StudioApi }) {
  const draft = useStudioDraft(api, initialId);
  const { proof, graph, name, status, change } = draft;
  const [tab, setTab] = useState<'build' | 'test' | 'activity'>('build');
  const [panel, setPanel] = useState<'properties' | 'preview' | null>(null);
  const [selected, setSelected] = useState('keyword');
  const [dialog, setDialog] = useState<'publish' | 'discard' | 'leave' | 'activate' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [run, setRun] = useState<StudioRun | null>(null);
  const [viewPublished, setViewPublished] = useState(false);
  const version = proof?.versions.at(-1);
  const baseline = version ? toStudioGraph(version.graph) : initialStudioGraph(catalog?.account.id);
  const changes = changesBetween(baseline, graph);
  const displayGraph = viewPublished && version ? toStudioGraph(version.graph) : graph;
  const issues = [...localIssues(graph), ...serverIssues];
  const node = displayGraph.nodes.find(n => n.id === selected) || displayGraph.nodes[0];
  const readonly = busy || viewPublished || status === 'loading' || status === 'conflict' || (initialId ? !permissions.edit : !permissions.create) || (status === 'error' && !proof && Boolean(initialId));
  const pendingPublication = !version || changes.length > 0 || !('schema_version' in version.graph);
  const publishedCurrent = !pendingPublication && status === 'saved';
  const act = async (fn: () => Promise<void>) => { setBusy(true); setNotice(''); try { await fn(); } catch (e) { const info = extractError(e); setNotice(info.message); if (Array.isArray(info.details)) setServerIssues(info.details); } finally { setBusy(false); } };
  const edit = (next: Parameters<typeof change>[0]) => { setServerIssues([]); setRun(null); change(next); };
  const preparePublish = () => void act(async () => { const saved = await draft.save(); if (!saved) return; await api.validate(saved); setDialog('publish'); });
  return <section className="instagram-studio" aria-label="Construtor de automação Instagram">
    <header className="studio-header"><button className="studio-back" aria-label="Todas as automações" onClick={() => draft.unsaved ? setDialog('leave') : onBack()}><ArrowLeft size={18} /></button><div className="studio-heading"><input aria-label="Nome da automação" maxLength={100} value={name} disabled={readonly} onChange={e => draft.rename(e.target.value)} /><div className="studio-state-line"><span className={`studio-operating ${proof?.state || 'paused'}`}>{proof ? operationLabels[proof.state] : 'Rascunho'}</span><span>{proof?.active_version_id && !proof.outbound_enabled ? 'Selecionada (envio bloqueado): ' : 'Executando: '}{proof?.active_version_id ? `v${proof.versions.find(v => v.id === proof.active_version_id)?.number}` : 'nenhuma versão'}</span><span className={`save-${status}`} role="status">{status === 'saved' && <Check size={12} />}{status === 'saved' && publishedCurrent ? 'Tudo publicado' : saveLabels[status]}</span></div></div><div className="studio-header-actions"><button disabled={busy || status === 'saving' || status === 'loading' || !permissions.edit} onClick={() => setDialog('discard')}><Undo2 size={15} /> Descartar rascunho</button>{proof && proof.state !== 'paused' && permissions.publish && <button disabled={busy || status !== 'saved'} onClick={() => void act(async () => draft.hydrate(await api.activate(proof, '', 'paused')))}><Pause size={15} /> Pausar</button>}<button className="studio-primary" disabled={busy || readonly || status === 'saving' || !permissions.publish || !pendingPublication} onClick={preparePublish}><Upload size={15} /> Revisar e publicar</button></div></header>
    {(!catalog || catalog.comment_like_status === 'connection_required') && <div className="studio-connection-alert"><AlertCircle size={16} /><span>{!catalog ? 'Não foi possível carregar a conexão Instagram.' : 'A curtida precisa da conexão Facebook correspondente.'} O rascunho pode ser editado.</span><a href="/channels">Conferir em Canais <ChevronRight size={14} /></a></div>}
    {draft.error && <div role="alert" className="studio-error"><strong>{draft.error}</strong>{status === 'conflict' ? <><button onClick={() => void act(draft.reload)}>Recarregar edição do servidor</button><button onClick={() => void act(async () => { await navigator.clipboard.writeText(JSON.stringify({ name, graph }, null, 2)); setNotice('Alterações locais copiadas.'); })}>Copiar alterações locais</button></> : <button onClick={draft.retry}>Tentar novamente</button>}</div>}
    {notice && <p role="status" className="studio-notice">{notice}</p>}
    <div className="studio-navigation"><nav aria-label="Áreas da automação">{([['build', 'Construir'], ['test', 'Testar'], ['activity', 'Acompanhar']] as const).map(([id, label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav><div className="studio-view-actions">{tab === 'build' && <>{version && <button aria-pressed={viewPublished} onClick={() => setViewPublished(v => !v)}>{viewPublished ? 'Voltar ao rascunho' : `Publicada v${version.number}`}</button>}<button aria-label="Propriedades" aria-expanded={panel === 'properties'} aria-controls="studio-inspector" aria-pressed={panel === 'properties'} onClick={() => setPanel(p => p === 'properties' ? null : 'properties')}><Settings2 size={16} /><span>Propriedades</span></button><button aria-label="Prévia" aria-expanded={panel === 'preview'} aria-controls="studio-inspector" aria-pressed={panel === 'preview'} onClick={() => setPanel(p => p === 'preview' ? null : 'preview')}><Eye size={16} /><span>Prévia</span></button></>}</div></div>
    {tab === 'build' && <><div className={`studio-workspace ${panel ? 'has-inspector' : ''}`}><StudioCanvas graph={displayGraph} change={edit} selected={selected} select={id => { setSelected(id); setPanel('properties'); }} issues={issues} run={run} readonly={readonly} account={catalog?.account.id || ''} />{panel && <aside id="studio-inspector" className="studio-inspector" aria-label={panel === 'preview' ? 'Prévia' : 'Propriedades'}><div className="studio-inspector-header"><strong>{panel === 'preview' ? 'Prévia do Direct' : 'Propriedades'}</strong><button aria-label="Recolher painel" title="Recolher painel" onClick={() => setPanel(null)}><PanelRightClose size={17} /></button></div>{panel === 'preview' ? <StudioPreview graph={displayGraph} label={viewPublished ? `Publicada v${version?.number}` : 'Rascunho'} /> : node && <StudioProperties key={node.id} node={node} graph={displayGraph} catalog={catalog} readonly={readonly} update={data => edit({ ...graph, nodes: graph.nodes.map(n => n.id === node.id ? { ...n, data } : n) })} remove={() => edit({ ...graph, nodes: graph.nodes.filter(n => n.id !== node.id), edges: graph.edges.filter(e => e.source !== node.id && e.target !== node.id) })} connect={(port, target) => {
      const edges = graph.edges.filter(e => !(e.source === node.id && e.sourceHandle === port));
      if (target) edges.push({ id: crypto.randomUUID(), source: node.id, sourceHandle: port, target });
      const next = { ...graph, edges };
      const incompatible = localIssues(next).find(i => i.field === 'safety' || i.message.includes('ciclo'));
      if (incompatible) { setNotice(`Conexão recusada: ${incompatible.message}`); return; }
      edit(next);
    }} />}</aside>}</div>{issues.length > 0 && <details className="studio-issues"><summary><AlertCircle size={16} /> {issues.length} pendência(s) para publicar</summary><ul>{issues.map((i, ix) => <li key={ix}><button onClick={() => { if (i.node) setSelected(i.node); setPanel('properties'); }}>{i.node ? `${blockLabels[graph.nodes.find(n => n.id === i.node)?.type || 'end']}: ` : ''}{i.message}</button></li>)}</ul></details>}</>}
    {tab === 'test' && <StudioTesting proof={proof} catalog={catalog} api={api} frozen={!publishedCurrent} publishPermission={permissions.publish} update={draft.hydrate} syncMetadata={draft.syncMetadata} onBusy={setBusy} onRun={r => { setRun(r); setNotice('Simulação concluída. O caminho também pode ser inspecionado em Construir.'); }} />}
    {tab === 'activity' && <StudioActivity proof={proof} api={api} />}
    {tab !== 'build' && proof && <footer className="studio-operation-footer"><div className="studio-operation-copy"><span>Ativação comercial exige teste real da configuração publicada.</span>{proof.activation_readiness?.reason && <small>{proof.activation_readiness.reason}</small>}</div><button className="studio-primary" disabled={!publishedCurrent || !proof.activation_readiness?.eligible || busy || !permissions.publish || !catalog?.execution_available} onClick={() => setDialog('activate')}>Ativar para novos comentários</button></footer>}
    {dialog && <StudioModal onClose={() => setDialog(null)}><button className="studio-dialog-close" aria-label="Fechar" onClick={() => setDialog(null)}><X size={18} /></button><span className="studio-eyebrow">{dialog === 'publish' ? 'NOVA VERSÃO' : 'CONFIRMAÇÃO'}</span><h2 id="studio-dialog-title">{dialog === 'publish' ? 'Revisar antes de publicar' : dialog === 'discard' ? 'Descartar rascunho?' : dialog === 'activate' ? 'Ativar para novos comentários?' : 'Sair com alterações não salvas?'}</h2>
      {dialog === 'publish' || dialog === 'discard' ? <><p>{dialog === 'publish' ? 'Publicar cria uma versão imutável. A versão em execução permanece a mesma até a ativação.' : version ? `O rascunho voltará integralmente à publicada v${version.number}. A execução atual permanece igual.` : 'O fluxo voltará ao modelo inicial e continuará como rascunho.'}</p><ul>{(changes.length ? changes : ['Nenhuma diferença no grafo; revisar nome e estado de salvamento.']).map(c => <li key={c}>{c}</li>)}</ul>{dialog === 'publish' && <details><summary>Conferir textos e ramificações completos</summary><StudioReview baseline={baseline} next={graph} /></details>}</> : <p>{dialog === 'activate' ? `A versão v${version?.number} responderá a novos comentários elegíveis fora do perfil de teste. Comentários antigos não serão processados.` : 'Há alterações que ainda não foram confirmadas pelo servidor. Você pode continuar editando ou sair.'}</p>}
      {notice && <p role="alert" className="studio-error">{notice}</p>}<div className="studio-dialog-actions"><button onClick={() => setDialog(null)}>Cancelar</button><button className="studio-primary" disabled={busy || status === 'saving'} onClick={() => void act(async () => { if (dialog === 'discard') { await draft.discard(); setNotice('Rascunho descartado.'); } else if (dialog === 'publish' && proof) { draft.hydrate(await api.publish(proof)); setNotice('Nova versão publicada. Faça o teste restrito antes de ativar.'); } else if (dialog === 'activate' && proof && version) draft.hydrate(await api.activate(proof, version.id, 'active')); else if (dialog === 'leave') onBack(); setDialog(null); })}>{dialog === 'publish' ? 'Publicar configuração' : dialog === 'discard' ? 'Descartar rascunho' : dialog === 'activate' ? 'Confirmar ativação' : 'Sair sem salvar'}</button></div>
    </StudioModal>}
  </section>;
}
