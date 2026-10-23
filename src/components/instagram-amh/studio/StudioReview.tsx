import { blockLabels, portLabels, type Block, type StudioGraph } from './graph';
function description(node: Block | undefined) {
  if (!node) return <p>Bloco ausente nesta versão.</p>;
  const d = node.data;
  switch (node.type) {
    case 'scope': return <p>{d.allContent ? 'Todos os conteúdos' : 'Conteúdo específico'} · conta {d.account || 'não escolhida'}</p>;
    case 'keyword': return <p>{d.keywords?.join(' · ')}<small>{d.mode === 'word' ? 'Palavra inteira' : 'Qualquer trecho'} · {d.ignoreCase ? 'ignora' : 'considera'} maiúsculas · {d.ignoreAccents ? 'ignora' : 'considera'} acentos</small></p>;
    case 'material': return <p>{d.mode === 'context' ? `${d.mappings?.length || 0} vínculos por criativo · revisão ${d.inventoryRevision || '—'}` : d.material === 'amh' ? 'AMH · Highlights' : 'AMH · No consultório'}</p>;
    case 'invitation': case 'delivery': return <><p className="studio-review-message">{d.text}</p>{d.buttonLabel && <strong>Botão: {d.buttonLabel}</strong>}</>;
    case 'public_reply': return <ol>{d.variants?.map((v, i) => <li key={i}>{v}</li>)}</ol>;
    default: return <p>{d.label || blockLabels[node.type!]}</p>;
  }
}
export function StudioReview({ baseline, next }: { baseline: StudioGraph; next: StudioGraph }) {
  const ids = [...new Set([...baseline.nodes.map(n => n.id), ...next.nodes.map(n => n.id)])];
  const changed = ids.filter(id => JSON.stringify(baseline.nodes.find(n => n.id === id)?.data) !== JSON.stringify(next.nodes.find(n => n.id === id)?.data));
  return <div className="studio-review">{changed.map(id => { const before = baseline.nodes.find(n => n.id === id); const after = next.nodes.find(n => n.id === id); return <section key={id}><h3>{blockLabels[(after || before)!.type!]}</h3><div className="studio-diff"><div><small>PUBLICADA</small>{description(before)}</div><div><small>RASCUNHO</small>{description(after)}</div></div></section>; })}<h3>Caminhos da nova versão</h3><ul>{next.edges.map(e => <li key={e.id}>{blockLabels[next.nodes.find(n => n.id === e.source)!.type!]} → <strong>{portLabels[e.sourceHandle || '']}</strong> → {next.nodes.find(n => n.id === e.target)?.data.label || blockLabels[next.nodes.find(n => n.id === e.target)!.type!]}</li>)}</ul></div>;
}
