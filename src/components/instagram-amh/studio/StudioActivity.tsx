import { useEffect, useState } from 'react';
import { extractError } from '@/utils/apiHelpers';
import { blockLabels, type StudioProof } from './graph';
import type { StudioApi, StudioDelivery } from './studioApi';
import { receiptLabels, receiptReason } from './receiptLabels';
export function StudioActivity({ proof, api }: { proof: StudioProof | null; api: StudioApi }) {
  const [rows, setRows] = useState<StudioDelivery[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState('all');
  const [state, setState] = useState('all');
  const [since, setSince] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!proof) { setLoading(false); return; }
    let live = true;
    let running = false;
    const refresh = async () => { if (running) return; running = true; try { const next = await api.deliveries(proof.id); if (live) { setRows(next); setError(''); } } catch (e) { if (live) setError(extractError(e).message); } finally { running = false; if (live) setLoading(false); } };
    void refresh(); const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, [api, proof]);
  const visible = rows.filter(r => (version === 'all' || r.version_id === version) && (state === 'all' || r.state === state) && (!since || new Date(r.created_at) >= new Date(`${since}T00:00:00`)));
  const activeId = selected && visible.some(r => r.id === selected) ? selected : visible[0]?.id || null;
  const detail = visible.find(r => r.id === activeId);
  return <div className="studio-activity"><section className="studio-panel"><span className="studio-eyebrow">ACOMPANHAMENTO</span><h2>O que aconteceu em cada caminho</h2><p>Até 50 execuções recentes · atualização automática. Recibos permanecem vinculados à versão executada.</p><div className="studio-filter-row"><label>Versão<select value={version} onChange={e => setVersion(e.target.value)}><option value="all">Todas</option>{proof?.versions.map(v => <option key={v.id} value={v.id}>v{v.number}</option>)}</select></label><label>Resultado<select value={state} onChange={e => setState(e.target.value)}><option value="all">Todos</option>{Object.entries(receiptLabels).filter(([k]) => ['accepted', 'blocked', 'failed', 'uncertain', 'awaiting_confirmation', 'prompt_failed', 'prompt_uncertain'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>A partir de<input type="date" value={since} onChange={e => setSince(e.target.value)} /></label></div>
    {error && <p role="alert" className="studio-error">{error}</p>}{loading ? <p role="status">Carregando execuções…</p> : !visible.length ? <div className="studio-empty"><h3>Nenhuma execução neste recorte</h3><p>Faça um teste restrito ou ajuste os filtros. A prévia visual não gera envios.</p></div> : <div className="studio-receipt-list">{visible.map(r => <button key={r.id} onClick={() => setSelected(r.id)} aria-pressed={activeId === r.id}><span><strong>{receiptLabels[r.state] || r.state}</strong><small>{r.resolved_material || 'Material não resolvido'} · v{proof?.versions.find(v => v.id === r.version_id)?.number || '—'}</small></span><time>{new Date(r.updated_at).toLocaleString('pt-BR')}</time></button>)}</div>}</section>
    {detail ? <aside className="studio-panel"><span className="studio-eyebrow">DETALHE DA EXECUÇÃO</span><h2>{receiptLabels[detail.state] || detail.state}</h2><ol className="studio-timeline">{detail.execution_trace?.length ? detail.execution_trace.map((t, i) => <li key={i}><strong>{blockLabels[t.type as keyof typeof blockLabels] || t.node}</strong><p>{receiptLabels[t.status] || t.status} · {receiptReason(t.reason)}</p><time>{new Date(t.at).toLocaleString('pt-BR')}</time></li>) : [['Convite', detail.prompt_state, detail.prompt_accepted_at], ['Resposta pública', detail.public_reply_state, detail.public_reply_accepted_at], ['Curtida', detail.like_state, detail.like_accepted_at], ['Clique real', detail.confirmation_received_at ? 'accepted' : 'pending', detail.confirmation_received_at], ['Material', detail.state, detail.updated_at]].map(([title, status, at]) => <li key={title}><strong>{title}</strong><p>{receiptLabels[status || 'not_requested'] || status}</p>{at && <time>{new Date(at).toLocaleString('pt-BR')}</time>}</li>)}</ol><p className="studio-helper-note">Cadastro, abertura do PDF e e-mail: sem evidência disponível neste recibo.</p><a href="/conversations">Abrir atendimento no CRM →</a></aside> : <aside className="studio-panel studio-panel-empty"><span className="studio-eyebrow">DETALHE DA EXECUÇÃO</span><h2>Selecione uma execução</h2><p>Escolha um recibo na lista ao lado para inspecionar o rastro de etapas, carimbos de tempo e estado de confirmação.</p></aside>}
  </div>;
}
