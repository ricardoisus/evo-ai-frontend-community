import type { Edge, Node } from '@xyflow/react';
import type { Graph as LegacyGraph, Parameters, Proof as LegacyProof, Run } from '../contract';
export const blockLabels = { comment: 'Comentário recebido', scope: 'Conta e conteúdo', keyword: 'Palavras-chave', material: 'Escolher material', invitation: 'Convite no Direct', confirmation: 'Clique em Pode enviar', public_reply: 'Resposta pública', like: 'Curtir comentário', delivery: 'Entregar material', end: 'Encerrar caminho' } as const;
export type BlockKind = keyof typeof blockLabels;
export const ports: Record<BlockKind, string[]> = { comment: ['next'], scope: ['match', 'no_match'], keyword: ['match', 'no_match'], material: ['success', 'blocked'], invitation: ['success', 'failed', 'blocked'], confirmation: ['confirmed'], public_reply: ['success', 'failed', 'blocked'], like: ['success', 'failed', 'blocked'], delivery: ['success', 'failed', 'blocked'], end: [] };
export const portLabels: Record<string, string> = { next: 'Continuar', match: 'Corresponde', no_match: 'Não corresponde', success: 'Sucesso', blocked: 'Bloqueado', failed: 'Falha', confirmed: 'Clique confirmado' };
export type BlockData = Parameters & { variants?: string[]; label?: string; [key: string]: unknown };
export type Block = Node<BlockData, BlockKind>;
export type StudioGraph = { schema_version: 2; nodes: Block[]; edges: Edge[] };
export type Issue = { node?: string; field: string; message: string; action?: string };
export type StudioVersion = Omit<LegacyProof['versions'][number], 'graph'> & { graph: StudioGraph | LegacyGraph; functional_digest?: string };
export type StudioProof = Omit<LegacyProof, 'draft' | 'versions'> & { draft: StudioGraph | LegacyGraph; versions: StudioVersion[]; published_version_id?: string; draft_changed?: boolean; activation_readiness?: { eligible: boolean; reason?: string } };
export type StudioRun = Omit<Run, 'trace'> & { trace: { node: string; type?: string; port?: string; status: string; reason: string; at: string; attempts: number }[] };
export function defaults(kind: BlockKind, account = ''): BlockData {
  switch (kind) {
    case 'scope': return { account, allContent: true };
    case 'keyword': return { keywords: ['AMH'], mode: 'word', ignoreCase: true, ignoreAccents: true };
    case 'material': return { mode: 'fixed', material: 'amh' };
    case 'invitation': return { text: 'Oi, {{primeiro_nome}}! Posso enviar o material por aqui?' };
    case 'public_reply': return { variants: ['Enviei um convite no Direct. Confira suas mensagens!'] };
    case 'delivery': return { text: 'Aqui está o acesso. Preencha seus dados para liberar o material.', buttonLabel: 'Acessar material' };
    default: return {};
  }
}
export function initialStudioGraph(account = ''): StudioGraph {
  const kinds: BlockKind[] = ['comment', 'scope', 'keyword', 'material', 'invitation', 'public_reply', 'like', 'confirmation', 'delivery', 'end'];
  const nodes: Block[] = kinds.map((type, i) => ({ id: type, type, data: defaults(type, account), position: { x: i * 300, y: 80 } }));
  nodes.push({ id: 'stop', type: 'end', data: { label: 'Sem envio' }, position: { x: 600, y: 460 } });
  const edges: Edge[] = kinds.slice(0, -1).flatMap((source, i) => ports[source].map(port => ({ id: `${source}-${port}`, source, sourceHandle: port, target: ['no_match', 'blocked', 'failed'].includes(port) && !['like', 'public_reply'].includes(source) ? 'stop' : kinds[i + 1] })));
  return { schema_version: 2, nodes, edges };
}
export function toStudioGraph(graph: StudioGraph | LegacyGraph): StudioGraph {
  if ('schema_version' in graph) return structuredClone(graph);
  const data = Object.fromEntries(graph.nodes.map(n => [n.id, n.data]));
  const next = initialStudioGraph(data.scope?.account);
  next.nodes = next.nodes.map(n => ({ ...n, data: n.type === 'invitation' ? { text: data.reply?.openingText || defaults('invitation').text } : n.type === 'public_reply' ? { variants: data.reply?.publicReplyVariants || [data.reply?.publicReplyText || 'Confira seu Direct!'] } : n.type === 'delivery' ? { text: data.reply?.text, buttonLabel: data.reply?.buttonLabel || 'Acessar material' } : { ...n.data, ...(data[n.id] || {}) } }));
  if (!data.reply?.publicReplyEnabled) {
    next.nodes = next.nodes.filter(n => n.type !== 'public_reply');
    next.edges = next.edges.filter(e => e.source !== 'public_reply').map(e => e.target === 'public_reply' ? { ...e, target: 'like' } : e);
  }
  return next;
}
export function cleanStudioGraph(graph: StudioGraph): StudioGraph {
  return { schema_version: 2, nodes: graph.nodes.map(({ id, type, data, position }) => ({ id, type, data, position })), edges: graph.edges.map(({ id, source, target, sourceHandle }) => ({ id, source, target, sourceHandle })) };
}
export function localIssues(graph: StudioGraph): Issue[] {
  const issues: Issue[] = [];
  const roots = graph.nodes.filter(n => n.type === 'comment');
  if (roots.length !== 1) issues.push({ field: 'nodes', message: 'Use exatamente um gatilho de comentário.' });
  for (const n of graph.nodes) {
    for (const port of ports[n.type!]) if (!graph.edges.some(e => e.source === n.id && e.sourceHandle === port)) issues.push({ node: n.id, field: port, message: `Conecte a saída “${portLabels[port]}”.` });
    if (n.type === 'scope' && !n.data.account) issues.push({ node: n.id, field: 'account', message: 'Escolha uma conta conectada.' });
    if (n.type === 'keyword' && !n.data.keywords?.length) issues.push({ node: n.id, field: 'keywords', message: 'Adicione uma palavra-chave.' });
    if (['invitation', 'delivery'].includes(n.type!) && !n.data.text?.trim()) issues.push({ node: n.id, field: 'text', message: 'Escreva a mensagem.' });
  }
  const reached = new Set<string>();
  let traversals = 0;
  const visit = (id: string, stack: string[], history: string[]) => {
    if (stack.includes(id)) { issues.push({ node: id, field: 'edges', message: 'Remova o ciclo entre os blocos.' }); return; }
    if (++traversals > 512) return;
    reached.add(id);
    const node = graph.nodes.find(n => n.id === id);
    if (!node) return;
    const kind = node.type!;
    const unsafe = (message: string) => issues.push({ node: id, field: 'safety', message });
    if (['invitation', 'confirmation', 'public_reply', 'like', 'delivery'].includes(kind)) {
      if (history.includes(kind)) unsafe('Uma ação de cada tipo por caminho.');
      if (!history.includes('scope:match')) unsafe('Configure conta e conteúdo antes de enviar.');
    }
    if (kind === 'invitation' && !history.includes('material:success')) unsafe('Resolva o material antes do convite.');
    if (['confirmation', 'public_reply'].includes(kind) && !history.includes('invitation:success')) unsafe('Esta ação exige convite aceito.');
    if (kind === 'delivery' && !history.includes('confirmation:confirmed')) unsafe('Entrega exige confirmação por clique real.');
    if (['scope', 'keyword', 'material'].includes(kind) && history.includes('invitation')) unsafe('Condições e material devem vir antes do convite.');
    graph.edges.filter(e => e.source === id).forEach(e => visit(e.target, [...stack, id], [...history, kind, `${kind}:${e.sourceHandle}`]));
  };
  if (roots[0]) visit(roots[0].id, [], []);
  graph.nodes.filter(n => !reached.has(n.id)).forEach(n => issues.push({ node: n.id, field: 'edges', message: 'Conecte este bloco ao gatilho.' }));
  return issues.filter((issue, index) => issues.findIndex(i => i.node === issue.node && i.message === issue.message) === index);
}
export function changesBetween(baseline: StudioGraph, next: StudioGraph): string[] {
  const changes: string[] = [];
  for (const n of next.nodes) {
    const old = baseline.nodes.find(b => b.id === n.id);
    if (!old) changes.push(`Adicionado: ${blockLabels[n.type!]}`);
    else if (JSON.stringify(old.data) !== JSON.stringify(n.data)) changes.push(`Configuração: ${blockLabels[n.type!]}`);
  }
  for (const n of baseline.nodes) if (!next.nodes.some(b => b.id === n.id)) changes.push(`Removido: ${blockLabels[n.type!]}`);
  if (JSON.stringify(baseline.edges) !== JSON.stringify(next.edges)) changes.push('Conexões e ramificações');
  if (!changes.length && JSON.stringify(baseline) !== JSON.stringify(next)) changes.push('Organização visual dos blocos');
  return changes;
}
