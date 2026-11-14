import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentWorkspace } from '@/pages/Customer/Agents/VetorialAgentPage';
import { ConversationIA } from './ConversationIA';
import { MetricsPanel, TestPanel } from './Panels';
import { ManagedAgents } from './Shared';
import * as service from '@/services/agents/vetorialService';
import fixture from '../../../../e2e/fixtures/vetorial-snapshot.json';
vi.mock('@/services/agents/vetorialService', async original => ({
  ...(await original<typeof service>()),
  read: vi.fn(),
  write: vi.fn(),
  catalog: vi.fn(),
  conversationIA: vi.fn(),
  controlIA: vi.fn(),
}));
const snapshot = fixture.payload as unknown as service.Snapshot;
const agent = {
  id: 'a1',
  name: 'Ricardo IA',
  role: 'atendimento',
  model: 'gpt-6-luna',
  mode: 'pilot',
  health: 'healthy',
  desired_version: 1,
  applied_version: null,
  prompt_version: '1.3',
} as service.ManagedAgent;
const revision = {
  id: 'r1',
  revision: 1,
  status: 'published',
  payload: snapshot,
  created_at: '2026-11-13T12:00:00Z',
};
const profile = {
  ...agent,
  can_manage: true,
  lock_version: 5,
  control_source: 'crm',
  published_revision: revision,
};
function workspace(editable = true) {
  return render(
    <MemoryRouter>
      <AgentWorkspace id="a1" editable={editable} testable={editable} />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(service.catalog).mockResolvedValue({
    data: { managed: [], native: null },
    meta: { partial: false },
  });
  vi.mocked(service.read).mockImplementation(async (_, path = '') =>
    path === '/revisions'
      ? [revision]
      : path === '/metrics'
        ? {
            measurement_started_at: null,
            usage_known: 0,
            usage_unknown: 2,
            recent_executions: [],
            latency: { n: 0 },
          }
        : profile,
  );
  vi.mocked(service.write).mockResolvedValue({ ...revision, id: 'r2', status: 'draft' });
});
afterEach(cleanup);
describe('Managed agent operation', () => {
  it('shows managed identity without native destructive actions', () => {
    render(
      <MemoryRouter>
        <ManagedAgents agents={[agent]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/agents/vetorial/a1');
    expect(screen.getByText(/aguardando aplicação/)).toBeInTheDocument();
    expect(screen.queryByText(/Excluir|Duplicar|Chaves API/)).toBeNull();
  });
  it('requires a changed draft, preserves the full bundle and uses the server version', async () => {
    workspace();
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Prompt e versões' }));
    fireEvent.change(screen.getByLabelText('Instruções do agente'), {
      target: { value: 'Novo prompt sintético' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(service.write).toHaveBeenCalled());
    const args = vi.mocked(service.write).mock.calls[0];
    expect(args[2]).toMatchObject({
      payload: {
        roles: {
          atendimento: { prompt: 'Novo prompt sintético' },
          analista: snapshot.roles.analista,
        },
        activation: snapshot.activation,
      },
    });
    expect(args[3]).toBe(5);
    expect(args[4]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('restoring only creates a draft and does not publish or activate', async () => {
    workspace();
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    fireEvent.click(screen.getByRole('tab', { name: 'Prompt e versões' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reverter' }));
    await waitFor(() =>
      expect(service.write).toHaveBeenCalledWith(
        'a1',
        '/revisions/r1/restore',
        {},
        5,
        expect.any(String),
        'post',
      ),
    );
    expect(service.write).toHaveBeenCalledTimes(1);
  });
  it('keeps a read-only user out of editing and tests', async () => {
    workspace(false);
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Testar agente' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Prompt e versões' }));
    expect(screen.getByLabelText('Instruções do agente')).toBeDisabled();
  });
  it('does not activate everyone before the exact phrase and explicit confirmation', async () => {
    vi.mocked(service.write).mockResolvedValue({ nonce: 'test', phrase: 'ATIVAR PARA TODOS' });
    workspace();
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    fireEvent.click(screen.getByRole('tab', { name: 'Caixas e ativação' }));
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ativação' }));
    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: 'Confirmar ativação' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(service.write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(service.write).mock.calls[0][1]).toBe('/activation_challenges');
  });
  it('sends the server challenge only after phrase and confirmation', async () => {
    vi.mocked(service.write)
      .mockResolvedValueOnce({ nonce: 'single-use', phrase: 'ATIVAR PARA TODOS' })
      .mockResolvedValue(revision);
    workspace();
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    fireEvent.click(screen.getByRole('tab', { name: 'Caixas e ativação' }));
    fireEvent.change(screen.getByLabelText('Modo'), { target: { value: 'all' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar ativação' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Digite ATIVAR PARA TODOS'), {
      target: { value: 'ATIVAR PARA TODOS' },
    });
    expect(screen.getByRole('button', { name: 'Confirmar ativação' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar ativação' }));
    await waitFor(() =>
      expect(service.write).toHaveBeenCalledWith(
        'a1',
        '/activation',
        expect.objectContaining({
          mode: 'all',
          nonce: 'single-use',
          phrase: 'ATIVAR PARA TODOS',
          confirm: true,
        }),
        5,
        expect.any(String),
        'put',
      ),
    );
  });

  it('requires a valid spending cap before creating a test session', () => {
    render(<TestPanel id="a1" revisions={[revision]} />);
    fireEvent.change(screen.getByLabelText('Propósito'), {
      target: { value: 'Cenário sintético' },
    });
    fireEvent.change(screen.getByLabelText('Critério de aprovação'), {
      target: { value: 'Sem efeitos' },
    });
    fireEvent.change(screen.getByLabelText('Teto da sessão (USD)'), { target: { value: '0.51' } });
    expect(screen.getByRole('button', { name: 'Iniciar teste' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Teto da sessão (USD)'), { target: { value: '0.05' } });
    expect(screen.getByRole('button', { name: 'Iniciar teste' })).toBeEnabled();
    expect(service.write).not.toHaveBeenCalled();
  });

  it('keeps edits visible after conflict and reuses the intent key', async () => {
    vi.mocked(service.write).mockRejectedValue({ response: { status: 409 } });
    workspace();
    await screen.findByRole('heading', { name: 'Ricardo IA' });
    fireEvent.click(screen.getByRole('tab', { name: 'Prompt e versões' }));
    fireEvent.change(screen.getByLabelText('Instruções do agente'), {
      target: { value: 'Edição preservada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Instruções do agente')).toHaveValue('Edição preservada');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(service.write).toHaveBeenCalledTimes(2));
    expect(vi.mocked(service.write).mock.calls[0][4]).toBe(
      vi.mocked(service.write).mock.calls[1][4],
    );
  });
  it('does not present unknown usage as zero cost', async () => {
    render(<MetricsPanel id="a1" />);
    await screen.findByText('Indisponível');
    expect(screen.getByText('Sem medição')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nenhuma execução no período' }),
    ).toBeInTheDocument();
  });
  it('does not start a sandbox simply by opening the panel', () => {
    render(<TestPanel id="a1" revisions={[revision]} />);
    expect(service.write).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Iniciar teste' })).toBeDisabled();
  });
});
describe('Internal conversation controls', () => {
  beforeEach(() => {
    vi.mocked(service.conversationIA).mockResolvedValue({
      version: 7,
      paused: true,
      reason: 'pausa_manual',
      eligible: true,
      mode: 'pilot',
      health: 'healthy',
    });
    vi.mocked(service.controlIA).mockResolvedValue({});
  });
  it('shows the internal pause reason and requires confirmation to clear an assignee', async () => {
    render(<ConversationIA id="c1" assignee editable />);
    await screen.findByText('IA pausada · por pessoa');
    expect(screen.getByText('Somente equipe · Motivo: Pausa manual')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Devolver à IA' }));
    await screen.findByRole('dialog');
    expect(service.controlIA).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover responsável e devolver' }));
    await waitFor(() => expect(service.controlIA).toHaveBeenCalledWith('c1', 'resume', 7, true));
  });
  it('hides controls for read-only staff and preserves unmanaged conversations', async () => {
    vi.mocked(service.conversationIA).mockRejectedValue({ response: { status: 404 } });
    const { container } = render(<ConversationIA id="native" assignee={false} editable={false} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(service.controlIA).not.toHaveBeenCalled();
  });
  it('shows off and prevents resuming an ineligible conversation', async () => {
    vi.mocked(service.conversationIA).mockResolvedValue({
      version: 0,
      paused: false,
      reason: null,
      eligible: false,
      mode: 'off',
      health: 'healthy',
    });
    render(<ConversationIA id="c1" assignee={false} editable />);
    await screen.findByText('IA desligada');
    expect(screen.getByRole('button', { name: 'Devolver à IA' })).toBeDisabled();
  });
});
