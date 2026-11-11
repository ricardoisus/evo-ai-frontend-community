import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pipeline } from '@/types/analytics/pipelines';
import { nativeFields } from './cardConfiguration';
import CardConfigurationPanel from './CardConfigurationPanel';

vi.mock('@/contexts/PermissionsContext', () => ({ usePermissions: () => ({ can: () => true }) }));
const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/pipelines', () => ({ pipelinesService: { updatePipeline: update } }));
const pipeline = { id: 'pipeline', name: 'Vendas', card_field_definitions: nativeFields, card_configuration_revision: 3 } as Pipeline;
const mount = (onSaved = vi.fn(), onClose = vi.fn()) => render(<MemoryRouter><CardConfigurationPanel pipeline={pipeline} onClose={onClose} onSaved={onSaved} /></MemoryRouter>);
describe('card configuration editor', () => {
  beforeEach(() => vi.clearAllMocks());
  it('updates live preview, confirms discard and makes no request before saving', () => {
    const onClose = vi.fn(); mount(vi.fn(), onClose);
    fireEvent.click(screen.getByRole('radio', {name:'Compacta'}));
    expect(document.querySelector('.configuration-preview .compact')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox',{name:'Valor'}));
    expect(document.querySelector('.configuration-preview .deal-value')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Cancelar',exact:true}));
    expect(screen.getByText('Descartar alterações?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Descartar',exact:true})); expect(onClose).toHaveBeenCalledOnce();
  });
  it('saves once with the loaded revision and closes after success', async () => {
    update.mockResolvedValue({...pipeline,card_configuration_revision:4});
    const onSaved=vi.fn(),onClose=vi.fn(); mount(onSaved,onClose);
    fireEvent.click(screen.getByRole('radio',{name:'Compacta'}));
    fireEvent.click(screen.getByRole('button',{name:'Salvar',exact:true}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith('pipeline',expect.objectContaining({card_configuration_revision:3,card_configuration:expect.objectContaining({density:'compact'})}));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('keeps draft after conflict and prevents overwriting a newer revision', async () => {
    update.mockRejectedValue({response:{status:409}}); mount();
    fireEvent.click(screen.getByRole('radio',{name:'Compacta'}));
    fireEvent.click(screen.getByRole('button',{name:'Salvar',exact:true}));
    const alert=await screen.findByRole('alert'); expect(alert).toHaveTextContent('A configuração mudou');
    expect(within(alert).getByRole('button',{name:'Recarregar'})).toBeInTheDocument();
    expect(screen.getByRole('radio',{name:'Compacta'})).toBeChecked();
    expect(screen.getByRole('button',{name:'Salvar',exact:true})).toBeDisabled();
  });
});
