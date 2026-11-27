// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import WhatsappTracking from './WhatsappTracking';
import { trackingApi } from './trackingApi';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: { key: 'administrator' } } }),
}));
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ isReady: true, can: () => true }),
}));
vi.mock('@/services/channels/inboxesService', () => ({
  default: { list: async () => ({
    data: [{ id: 'cra', name: 'CRA', channel_type: 'Channel::Whatsapp', provider_config: { instance_name: 'CR Advogados' } }],
  }) },
}));
vi.mock('./trackingApi', () => ({
  trackingApi: { rules: vi.fn(), destinations: vi.fn(), history: vi.fn(), saveRule: vi.fn(), simulate: vi.fn(), retry: vi.fn() },
}));

const existing = {
  id: 'rule-1', name: 'CRA CTWA', draft: { trigger: 'message_received', frequency: 'contact' },
  published: null, active: false, lock_version: 0,
};

async function selectInbox() {
  render(<WhatsappTracking />);
  await screen.findByRole('option', { name: 'CRA · CR Advogados' });
  fireEvent.change(screen.getByLabelText('Caixa de WhatsApp'), { target: { value: 'cra' } });
}

beforeEach(() => {
  vi.mocked(trackingApi.rules).mockResolvedValue([existing]);
  vi.mocked(trackingApi.destinations).mockResolvedValue([]);
  vi.mocked(trackingApi.history).mockResolvedValue({ data: [], meta: { page: 1, per_page: 25, total_count: 0 } });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('switches tabs and simulates a selected rule in the correct inbox', async () => {
  vi.mocked(trackingApi.simulate).mockResolvedValue({ result: 'matched' });
  await selectInbox();
  fireEvent.click(await screen.findByRole('button', { name: 'Regras' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir configuração' }));
  fireEvent.change(screen.getByLabelText('Texto sintético da mensagem'), { target: { value: 'Olá' } });
  fireEvent.click(screen.getByRole('button', { name: 'Simular regra' }));
  expect(await screen.findByText('O evento corresponde à regra.')).toBeInTheDocument();
  expect(trackingApi.simulate).toHaveBeenCalledWith('cra', existing, { text: 'Olá', confirmed: true });
});

it('filters history in the selected inbox', async () => {
  await selectInbox();
  fireEvent.click(await screen.findByRole('button', { name: 'Histórico' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'uncertain' } });
  await waitFor(() => expect(trackingApi.history).toHaveBeenCalledWith('cra', expect.objectContaining({ status: 'uncertain', page: 1 })));
});
