// Read-only local Vite entry; never imported by the production application.
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { InstagramAutomations } from '../components/instagram-amh/InstagramAutomations';
import { automationApi } from '../components/instagram-amh/automationApi';
const api = { ...automationApi,
  list: async () => [
    { id: 'qa-one', name: 'AMH · Criativos e assuntos', state: 'test' as const, version: 6, published_version: 6, running_version: 6, draft_changed: true, material: 'context', keywords: ['AMH', 'material'], scope: { allContent: true }, last_simulation: { outcome: 'simulated_accepted', at: '2026-10-22T12:20:00Z', outbound_calls: 0 } },
    { id: 'qa-two', name: 'AMH · No consultório', state: 'paused' as const, version: 2, published_version: 2, running_version: null, draft_changed: false, material: 'amh-consultorio', keywords: ['guia'], scope: { media: '90005' }, last_simulation: null },
  ],
  catalog: async () => ({ account: { id: '90001', label: '@conta_de_exemplo' }, publications: [{ id: '90005', label: 'AMH na rotina do consultório', source: 'inventory' }], execution_available: false, test_available: false }),
  get: async () => { throw new Error('Abra instagram-studio-preview.html para revisar o editor interativo.'); },
};
createRoot(document.getElementById('root')!).render(<MemoryRouter><InstagramAutomations api={api} permissions={{ create: false, edit: false, publish: false }} /></MemoryRouter>);
