import { memo, useCallback, useState } from 'react';
import { ReactFlow, Background, Handle, Position, applyEdgeChanges, applyNodeChanges, type ReactFlowInstance, type Connection, type NodeProps } from '@xyflow/react';
import { GitBranch, MessageCircle, MousePointer2, Send, ThumbsUp, Flag, FileText, Filter, Instagram, Plus, LayoutGrid, ZoomIn, ZoomOut, Maximize, Focus, MessagesSquare } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { receiptLabels } from './receiptLabels';
import { blockLabels, portLabels, ports, defaults, localIssues, type Block, type BlockKind, type Issue, type StudioGraph, type StudioRun } from './graph';
const icons = { comment: Instagram, scope: Filter, keyword: GitBranch, material: FileText, invitation: MessageCircle, confirmation: MousePointer2, public_reply: MessagesSquare, like: ThumbsUp, delivery: Send, end: Flag };
function summary(n: Block) {
  const d = n.data;
  switch (n.type) {
    case 'comment': return 'Novos comentários da conta conectada';
    case 'scope': return d.allContent ? 'Todos os conteúdos da conta' : d.media || d.ad || 'Escolher conteúdo';
    case 'keyword': return d.keywords?.join(' · ') || 'Configurar palavras';
    case 'material': return d.mode === 'context' ? 'Por criativo e assunto' : d.material === 'amh-consultorio' ? 'AMH · No consultório' : 'AMH · Highlights';
    case 'invitation': case 'delivery': return d.text || 'Escrever mensagem';
    case 'public_reply': return `${d.variants?.length || 0} variação(ões)`;
    case 'confirmation': return 'Aguarda clique real no Instagram';
    case 'like': return 'Curtir o comentário recebido';
    default: return d.label || 'Fim deste caminho';
  }
}
const BlockNode = memo(function BlockNode({ data, type, selected }: NodeProps<Block>) {
  const Icon = icons[type!];
  return <div className={`studio-node ${selected ? 'is-selected' : ''} ${data._issue ? 'has-issue' : ''} ${data._trace ? `trace-${data._trace}` : ''}`}>
    {type !== 'comment' && <Handle type="target" position={Position.Left} />}
    <div className="studio-node-head"><span className={`studio-node-icon kind-${type}`}><Icon size={17} /></span><span>{type === 'scope' || type === 'keyword' ? 'CONDIÇÃO' : type === 'comment' ? 'GATILHO' : type === 'end' ? 'RESULTADO' : 'AÇÃO'}</span>{Boolean(data._issue) && <strong title={String(data._issue)}>!</strong>}</div>
    <strong>{blockLabels[type!]}</strong><p>{summary({ data, type } as Block)}</p>
    {Boolean(data._trace) && <small className="studio-node-trace">{receiptLabels[String(data._trace)] || String(data._trace)}</small>}
    <div className="studio-ports">{ports[type!].map(port => <div key={port} className={`port-${port}`}><span>{portLabels[port]}</span><Handle id={port} type="source" position={Position.Right} style={{ top: '50%' }} /></div>)}</div>
  </div>;
});
const nodeTypes = Object.fromEntries(Object.keys(blockLabels).map(k => [k, BlockNode]));
export function StudioCanvas({ graph, change, selected, select, issues, run, readonly, account }: { graph: StudioGraph; change: (g: StudioGraph | ((old: StudioGraph) => StudioGraph)) => void; selected: string; select: (id: string) => void; issues: Issue[]; run?: StudioRun | null; readonly: boolean; account: string }) {
  const [flow, setFlow] = useState<ReactFlowInstance<Block> | null>(null);
  const [zoom, setZoom] = useState(0.9);
  const [error, setError] = useState('');
  const connect = useCallback((c: Connection) => {
    if (!c.source || !c.target || !c.sourceHandle) return;
    const candidate = { ...graph, edges: [...graph.edges.filter(e => !(e.source === c.source && e.sourceHandle === c.sourceHandle)), { id: crypto.randomUUID(), source: c.source, target: c.target, sourceHandle: c.sourceHandle }] };
    const target = graph.nodes.find(n => n.id === c.target);
    const reaches = (id: string, seen: Set<string>): boolean => { if (id === c.source) return true; if (seen.has(id)) return false; seen.add(id); return candidate.edges.filter(e => e.source === id).some(e => reaches(e.target, seen)); };
    if (target?.type === 'comment' || reaches(c.target, new Set())) { setError('Conexão recusada: o gatilho não recebe entrada e o fluxo não aceita ciclos.'); return; }
    const invalid = localIssues(candidate).find(i => i.field === 'safety');
    if (invalid) { setError(`Conexão recusada: ${invalid.message}`); return; }
    setError(''); change(candidate);
  }, [graph, change]);
  const arrange = () => {
    const root = graph.nodes.find(n => n.type === 'comment');
    const depth = new Map<string, number>();
    const visit = (id: string, level: number) => { if ((depth.get(id) ?? -1) >= level || level > graph.nodes.length) return; depth.set(id, level); graph.edges.filter(e => e.source === id).forEach(e => visit(e.target, level + 1)); };
    if (root) visit(root.id, 0);
    const rows = new Map<number, number>();
    change({ ...graph, nodes: graph.nodes.map(n => { const d = depth.get(n.id) ?? 0; const row = rows.get(d) ?? 0; rows.set(d, row + 1); return { ...n, position: { x: d * 310, y: row * 290 + 70 } }; }) });
  };
  const add = (kind: BlockKind) => {
    const id = `${kind}-${crypto.randomUUID().slice(0, 8)}`;
    change({ ...graph, nodes: [...graph.nodes, { id, type: kind, data: defaults(kind, account), position: { x: 160, y: 400 + (graph.nodes.length % 3) * 60 } }] }); select(id);
  };
  const display = graph.nodes.map(n => ({ ...n, selected: n.id === selected, data: { ...n.data, _issue: issues.find(i => i.node === n.id)?.message, _trace: run?.trace.find(t => t.node === n.id)?.status } }));
  return <div className="studio-canvas-area">
    <div className="studio-canvas-toolbar"><span>{graph.nodes.length} blocos · {graph.edges.length} conexões</span><button disabled={readonly} onClick={arrange}><LayoutGrid size={15} /> Organizar</button></div>
    {!readonly && <details className="studio-library"><summary><Plus size={15} /> Adicionar bloco</summary><div>{(Object.keys(blockLabels) as BlockKind[]).map(kind => <button key={kind} onClick={() => add(kind)} disabled={kind === 'comment' && graph.nodes.some(n => n.type === 'comment')}>{blockLabels[kind]}</button>)}</div></details>}
    {error && <p role="alert" className="studio-canvas-error">{error}</p>}
    <div className="studio-desktop-canvas"><ReactFlow onInit={setFlow} onMove={(_, viewport) => setZoom(viewport.zoom)} nodes={display} edges={graph.edges.map(e => ({ ...e,  animated: Boolean(run?.trace.some(t => t.node === e.source && t.port === e.sourceHandle)), style: { stroke: 'var(--st-edge)', strokeWidth: 1.5 } }))} nodeTypes={nodeTypes} defaultViewport={{ x: 25, y: 10, zoom: 0.9 }} minZoom={0.15} maxZoom={1.5} nodesDraggable={!readonly} nodesConnectable={!readonly} elementsSelectable onNodeClick={(_, n) => select(n.id)}
      onNodesChange={changes => { const persistent = changes.filter(c => c.type === 'position' || c.type === 'remove'); if (persistent.length && !readonly) change(old => { const nodes = applyNodeChanges(persistent, old.nodes); return { ...old, nodes, edges: old.edges.filter(e => nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)) }; }); }}
      onEdgesChange={changes => { const removals = changes.filter(c => c.type === 'remove'); if (!readonly && removals.length) change(old => ({ ...old, edges: applyEdgeChanges(removals, old.edges) })); }} onConnect={connect} deleteKeyCode={readonly ? null : ['Backspace', 'Delete']}><Background gap={22} color="var(--st-grid)" /></ReactFlow></div>
    <div className="studio-viewport-controls" role="group" aria-label="Navegação do canvas"><button aria-label="Aproximar" title="Aproximar" onClick={() => void flow?.zoomIn({ duration: 180 })}><ZoomIn size={18} /></button><button aria-label="Restaurar zoom de 100%" title="Restaurar zoom de 100%" onClick={() => void flow?.zoomTo(1, { duration: 180 })}>{Math.round(zoom * 100)}%</button><button aria-label="Afastar" title="Afastar" onClick={() => void flow?.zoomOut({ duration: 180 })}><ZoomOut size={18} /></button><span /><button aria-label="Enquadrar fluxo" title="Enquadrar fluxo" onClick={() => void flow?.fitView({ padding: 0.15, duration: 250 })}><Maximize size={18} /></button><button aria-label="Focar bloco selecionado" title="Focar bloco selecionado" disabled={!selected} onClick={() => void flow?.fitView({ nodes: [{ id: selected }], maxZoom: 1, duration: 250 })}><Focus size={18} /></button></div>
    <nav className="studio-node-list" aria-label="Blocos do fluxo">{graph.nodes.map(n => <button key={n.id} aria-current={selected === n.id ? 'step' : undefined} onClick={() => select(n.id)}>{blockLabels[n.type!]}<small>{summary(n)}</small></button>)}</nav>
  </div>;
}
