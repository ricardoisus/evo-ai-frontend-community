import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock('@/services/core/api', () => ({
  default: {
    get: (...args: unknown[]) => api.get(...args),
    post: (...args: unknown[]) => api.post(...args),
    patch: (...args: unknown[]) => api.patch(...args),
    delete: (...args: unknown[]) => api.delete(...args),
  },
}));

import { pipelinesService } from './pipelinesService';

describe('canonical deal API', () => {
  beforeEach(() => Object.values(api).forEach(mock => mock.mockReset()));

  it('loads and updates a deal through the canonical member route', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { id: 'deal-1' } } });
    api.patch.mockResolvedValueOnce({ data: { data: { id: 'deal-1', title: 'Novo título' } } });

    await pipelinesService.getDeal('deal-1');
    await pipelinesService.updateDeal('deal-1', { title: 'Novo título' });

    expect(api.get).toHaveBeenCalledWith('/deals/deal-1');
    expect(api.patch).toHaveBeenCalledWith('/deals/deal-1', { deal: { title: 'Novo título' } });
  });

  it('creates an autonomous opportunity through the pipeline deal collection', async () => {
    api.post.mockResolvedValueOnce({ data: { data: { id: 'deal-2', title: 'Renovação anual' } } });

    const deal = await pipelinesService.createDeal('pipeline-1', {
      title: 'Renovação anual',
      value: 2500,
      currency: 'BRL',
      pipeline_stage_id: 'stage-1',
      contact_ids: [],
      conversation_ids: [],
    });

    expect(api.post).toHaveBeenCalledWith('/pipelines/pipeline-1/deals', {
      deal: expect.objectContaining({ title: 'Renovação anual', value: 2500 }),
    });
    expect(deal.title).toBe('Renovação anual');
  });

  it('uses child routes for associations and files', async () => {
    api.post.mockResolvedValue({ data: { data: {} } });
    api.delete.mockResolvedValue({ data: { data: {} } });

    await pipelinesService.addDealContact('deal-1', 'contact-1', true);
    await pipelinesService.addDealConversation('deal-1', 'conversation-1');
    await pipelinesService.removeDealFile('deal-1', 'file-1');

    expect(api.post).toHaveBeenCalledWith('/deals/deal-1/contacts', { contact_id: 'contact-1', primary: true });
    expect(api.post).toHaveBeenCalledWith('/deals/deal-1/conversations', { conversation_id: 'conversation-1' });
    expect(api.delete).toHaveBeenCalledWith('/deals/deal-1/files/file-1');
  });
});
