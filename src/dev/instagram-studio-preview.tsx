// Local Vite entry only. Not imported by the application or production build.
import { createRoot } from 'react-dom/client';
import { InstagramStudio } from '../components/instagram-amh/studio/InstagramStudio';
import { initialStudioGraph, type StudioProof } from '../components/instagram-amh/studio/graph';
import coreApi from '../services/core/api';
import { studioApi } from '../components/instagram-amh/studio/studioApi';
import type { Catalog, StudioApi } from '../components/instagram-amh/studio/studioApi';
const catalog: Catalog = { account: { id: '90001', label: '@conta_de_exemplo' }, publications: [{ id: '90004', label: 'AMH na prática clínica · Highlights', source: 'inventory' }], execution_available: false, test_available: false, comment_like_status: 'configured' };
let proof: StudioProof = { id: 'preview', name: 'AMH · Criativos e assuntos', draft: initialStudioGraph('90001'), versions: [], ledger: [], lock_version: 0, state: 'test', outbound_enabled: false };
proof.versions.push({ id: 'v6', number: 6, graph: structuredClone(proof.draft), at: new Date().toISOString(), actor: 'exemplo', digest: 'preview', state: 'paused' });
proof.active_version_id = 'v6';
proof.activation_readiness = { eligible: false, reason: 'Este protótipo não permite envios nem ativação.' };
const copy = () => structuredClone(proof);
const mock: StudioApi = {
  catalog: async () => catalog,
  get: async () => copy(),
  create: async (name, graph) => { proof = { ...proof, name, draft: graph }; return copy(); },
  save: async (_, graph, name) => { proof = { ...proof, name, draft: structuredClone(graph), lock_version: proof.lock_version + 1 }; return copy(); },
  discard: async () => { proof.draft = structuredClone(proof.versions.at(-1)!.graph); proof.lock_version++; return copy(); },
  validate: async () => ({ valid: true }),
  publish: async () => { const number = proof.versions.length + 6; proof.versions.push({ id: `v${number}`, number, graph: structuredClone(proof.draft), at: new Date().toISOString(), actor: 'exemplo', digest: 'preview', state: 'paused' }); proof.lock_version++; return copy(); },
  activate: async () => { throw new Error('Envios desabilitados no protótipo.'); },
  testEvents: async () => [],
  deliveries: async () => [{ id: 'exemplo-1', version_id: 'v6', state: 'awaiting_confirmation', prompt_state: 'accepted', public_reply_state: 'accepted', like_state: 'accepted', resolved_material: 'amh', reason: 'waiting_for_button_click', created_at: '2026-10-22T12:20:00Z', updated_at: '2026-10-22T12:20:05Z' }],
  testReply: async () => { throw new Error('Envios desabilitados no protótipo.'); },
  simulate: async () => ({ proof: copy(), run: { id: 'demo', key: 'demo', version_id: 'v6', version_number: 6, graph_digest: 'preview', fixture: 'eligible', outcome: 'simulated_accepted', at: new Date().toISOString(), material: 'amh', outbound_calls: 0, mautic_state: 'not_executed', preview: '', trace: [{ node: 'keyword', type: 'keyword', port: 'match', status: 'passed', reason: 'AMH corresponde como palavra inteira', at: new Date().toISOString(), attempts: 1 }, { node: 'delivery', type: 'delivery', port: 'success', status: 'passed', reason: 'Material entregue após clique simulado', at: new Date().toISOString(), attempts: 1 }] } }),
};
const integrationId = new URLSearchParams(window.location.search).get('proof');
async function boot() {
  const integration = integrationId && /^[a-f0-9-]{36}$/.test(integrationId);
  if (integration) coreApi.defaults.baseURL = 'http://127.0.0.1:3186/api/v1';
  const actualCatalog = integration ? await studioApi.catalog() : catalog;
  createRoot(document.getElementById('root')!).render(<InstagramStudio initialId={integration ? integrationId : 'preview'} catalog={actualCatalog} permissions={{ create: true, edit: true, publish: true }} api={integration ? studioApi : mock} onBack={() => window.location.reload()} />);
}
void boot();
