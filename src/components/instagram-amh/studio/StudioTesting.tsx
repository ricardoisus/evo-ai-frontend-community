import { useEffect, useRef, useState } from 'react';
import { Play, Send, CheckCircle2, Circle } from 'lucide-react';
import { extractError } from '@/utils/apiHelpers';
import { fixtures } from '../contract';
import { blockLabels, type StudioProof, type StudioRun } from './graph';
import type { Catalog, StudioApi, StudioDelivery, TestEvent } from './studioApi';
import { receiptLabels } from './receiptLabels';
export function StudioTesting({ proof, catalog, api, frozen, publishPermission, update, onRun, syncMetadata, onBusy }: { proof: StudioProof | null; catalog: Catalog | null; api: StudioApi; frozen: boolean; publishPermission: boolean; update: (proof: StudioProof) => void; onRun: (run: StudioRun) => void; syncMetadata: (proof: StudioProof) => void; onBusy: (busy: boolean) => void }) {
  const acceptedId = useRef('');
  const [fixture, setFixture] = useState('eligible');
  const [sample, setSample] = useState('Quero AMH!');
  const [media, setMedia] = useState('');
  const [caption, setCaption] = useState('');
  const [run, setRun] = useState<StudioRun | null>(null);
  const [events, setEvents] = useState<TestEvent[]>([]);
  const [eventId, setEventId] = useState('');
  const [receipts, setReceipts] = useState<StudioDelivery[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const version = proof?.versions.at(-1);
  const current = proof?.active_version_id === version?.id;
  useEffect(() => {
    if (!proof?.id || proof.state !== 'test') return;
    let live = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const [next, rows] = await Promise.all([api.testEvents(), api.deliveries(proof.id)]);
        if (live) {
          setEvents(next); setReceipts(rows);
          const accepted = rows.find(row => row.version_id === version?.id && row.state === 'accepted' && row.confirmation_received_at);
          if (accepted && acceptedId.current !== accepted.id) {
            const snapshot = await api.get(proof.id);
            if (live) { syncMetadata(snapshot); acceptedId.current = accepted.id; }
          }
        }
      } catch (e) { if (live) setError(extractError(e).message); }
      finally { running = false; }
    };
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 4000);
    return () => { live = false; window.clearInterval(interval); };
  }, [api, proof?.id, proof?.state, version?.id, syncMetadata]);
  const act = async (fn: () => Promise<void>) => { setBusy(true); onBusy(true); setError(''); try { await fn(); } catch (e) { setError(extractError(e).message); } finally { setBusy(false); onBusy(false); } };
  const latest = receipts.find(r => r.version_id === version?.id);
  const steps = [proof?.state === 'test' && current, Boolean(latest?.prompt_state === 'accepted'), Boolean(latest?.confirmation_received_at), latest?.state === 'accepted'];
  return <div className="studio-test-grid"><section className="studio-panel"><span className="studio-eyebrow">01 · SEM ENVIO</span><h2>Simular o caminho</h2><p>O teste usa a versão publicada {version ? `v${version.number}` : '—'}. Mostra as decisões sem enviar mensagens.</p>
    {frozen && <p className="studio-status-banner">Publique o rascunho para testar as alterações atuais.</p>}
    <div className="studio-form-row">
      <label>Cenário<select value={fixture} onChange={e => setFixture(e.target.value)}>{Object.entries(fixtures).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Conteúdo para simular<select value={media} onChange={e => setMedia(e.target.value)}><option value="">Usar conteúdo configurado</option>{catalog?.publications.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
    </div>
    <label>Comentário de exemplo<input maxLength={200} value={sample} onChange={e => setSample(e.target.value)} /></label>
    <label>Legenda de exemplo<textarea rows={3} maxLength={2200} value={caption} onChange={e => setCaption(e.target.value)} placeholder="Necessária para testar o assunto quando não há vínculo no mapa." /></label>
    <button className="studio-primary" disabled={!proof || !version || frozen || busy} onClick={() => void act(async () => { const publication = catalog?.publications.find(p => p.id === media); const result = await api.simulate(proof!, version!.id, fixture, fixture === 'negative' ? '' : sample, { ...(media ? { media, ad: publication?.ad || '' } : {}), ...(caption ? { caption } : {}) }); syncMetadata(result.proof); setRun(result.run); onRun(result.run); })}><Play size={15} /> Simular sem enviar</button>
    {run && <div className="studio-simulation-result" role="status"><strong>{run.outcome === 'simulated_accepted' ? 'Caminho de entrega validado' : 'Caminho encerrado sem entrega'}</strong><p>Material: {run.material || 'não resolvido'} · zero envios externos</p><ol className="studio-timeline">{run.trace.map((t, i) => <li key={`${t.node}-${i}`}><strong>{blockLabels[t.type as keyof typeof blockLabels] || t.node} · {receiptLabels[t.status] || t.status}</strong><p>{t.reason}</p></li>)}</ol></div>}
  </section><section className="studio-panel"><span className="studio-eyebrow">02 · PERFIL AUTORIZADO</span><h2>Teste real no Instagram</h2><p>Envia somente ao perfil autorizado no servidor, usando a versão {version ? `v${version.number}` : '—'}. O material depende do clique real.</p>
    <ol className="studio-test-progress">{['Preparar teste restrito', 'Convite aceito pelo Instagram', 'Clique em Pode enviar recebido', 'Material aceito pelo Instagram'].map((s, i) => <li key={s} className={steps[i] ? 'complete' : ''}>{steps[i] ? <CheckCircle2 size={18} /> : <Circle size={18} />}<span>{s}</span></li>)}</ol>
    <div className="studio-test-actions">
      <button disabled={!proof || !version || frozen || busy || !publishPermission || !catalog?.test_available || !catalog.execution_available} onClick={() => void act(async () => update(await api.activate(proof!, version!.id, 'test')))}>Preparar teste restrito</button>
    </div>
    {proof?.state === 'test' && <div className="studio-test-live-box"><label>Comentário novo do perfil autorizado<select value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Selecione um comentário novo</option>{events.map(e => <option key={e.id} value={e.id} disabled={e.delivered}>{e.text} · {new Date(e.at).toLocaleString('pt-BR')}{e.delivered ? ' · já processado' : ''}</option>)}</select></label>{!events.length && <p className="studio-helper-note">Faça um comentário novo no conteúdo configurado. A lista é atualizada automaticamente.</p>}<button className="studio-primary" disabled={!eventId || frozen || !current || busy || !publishPermission} onClick={() => void act(async () => { const result = await api.testReply(proof.id, eventId); setReceipts(old => [result, ...old.filter(r => r.id !== result.id)]); setEventId(''); })}><Send size={15} /> Enviar convite real · v{version?.number}</button></div>}
    {latest && <p role="status" className="studio-status-banner">{receiptLabels[latest.state] || latest.state}</p>}<small className="studio-footnote">“Aceita” comprova aceite do provedor. Não comprova leitura. Comentários processados não são reenviados.</small>
  </section>{error && <p role="alert" className="studio-error">{error}</p>}</div>;
}
