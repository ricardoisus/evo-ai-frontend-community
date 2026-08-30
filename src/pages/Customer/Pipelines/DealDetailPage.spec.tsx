import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deal, Pipeline } from '@/types/analytics';
import DealDetailPage from './DealDetailPage';

const pipelineServiceMocks = vi.hoisted(() => ({
  getDeal: vi.fn(),
  getPipeline: vi.fn(),
  getAvailableContacts: vi.fn(),
  getAvailableConversations: vi.fn(),
  updateDeal: vi.fn(),
  addDealContact: vi.fn(),
  removeDealContact: vi.fn(),
  addDealConversation: vi.fn(),
  removeDealConversation: vi.fn(),
  uploadDealFiles: vi.fn(),
  removeDealFile: vi.fn(),
}));

const labelServiceMocks = vi.hoisted(() => ({ getLabels: vi.fn() }));
const fetchAgents = vi.hoisted(() => vi.fn());

vi.mock('@/services/pipelines', () => ({ pipelinesService: pipelineServiceMocks }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: labelServiceMocks }));
vi.mock('@/services/contacts', () => ({
  contactsService: { updateContact: vi.fn(), createContact: vi.fn() },
}));
vi.mock('@/store/appDataStore', () => ({
  useAppDataStore: () => ({
    agents: [{ id: 'owner-1', name: 'Ana' }],
    fetchAgents,
  }),
}));
vi.mock('@/components/contacts/CustomAttributes', () => ({ default: () => null }));

const pipeline = {
  id: 'pipeline-1',
  name: 'Comercial',
  stages: [{ id: 'stage-1', name: 'Entrada', color: '#111111' }],
  custom_fields: { attributes: [] },
} as Pipeline;

const deal = {
  id: 'deal-1',
  deal_id: 'deal-1',
  pipeline_id: 'pipeline-1',
  stage_id: 'stage-1',
  pipeline_stage_id: 'stage-1',
  title: 'Renovação',
  value: 100,
  currency: 'BRL',
  is_lead: false,
  item_id: 'contact-1',
  type: 'contact',
  created_at: '2026-08-30T10:00:00Z',
  updated_at: '2026-08-30T10:00:00Z',
  owner: { id: 'owner-1', name: 'Ana' },
  labels: [{ id: 'label-1', name: 'Expansão', title: 'Expansão', color: '#7c3aed' }],
  contacts: [],
  conversations: [],
  files: [],
  history: [],
  tasks: [],
  scheduled_actions: [],
  tasks_info: {
    pending_count: 0,
    overdue_count: 0,
    due_soon_count: 0,
    completed_count: 0,
    total_count: 0,
  },
} as Deal;

function renderPage(url = '/pipelines/pipeline-1/deals/deal-1?tab=deal') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/pipelines/:pipelineId/deals/:dealId" element={<DealDetailPage />} />
        <Route path="/pipelines/:pipelineId" element={<div>Pipeline</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DealDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineServiceMocks.getPipeline.mockResolvedValue(pipeline);
    pipelineServiceMocks.getAvailableContacts.mockResolvedValue([]);
    pipelineServiceMocks.getAvailableConversations.mockResolvedValue([]);
    labelServiceMocks.getLabels.mockResolvedValue({ data: [] });
    fetchAgents.mockResolvedValue(undefined);
  });

  it('shows a recoverable error instead of an endless spinner when the deal cannot load', async () => {
    pipelineServiceMocks.getDeal.mockRejectedValue(new Error('not found'));

    renderPage();

    expect(await screen.findByText('Negócio indisponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('sends explicit owner clearing and deal-owned labels when saving', async () => {
    pipelineServiceMocks.getDeal.mockResolvedValue(deal);
    pipelineServiceMocks.updateDeal.mockResolvedValue({ ...deal, owner: null });

    renderPage();

    const ownerSelect = await screen.findByLabelText('Responsável');
    fireEvent.change(ownerSelect, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(pipelineServiceMocks.updateDeal).toHaveBeenCalledWith(
        'deal-1',
        expect.objectContaining({ owner_id: null, labels: ['label-1'] }),
      ),
    );
  });
});
