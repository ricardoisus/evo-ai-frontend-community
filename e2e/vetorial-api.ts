import type { Page, Route } from '@playwright/test';
import fs from 'node:fs';
const snapshot = JSON.parse(
  fs.readFileSync(new URL('./fixtures/vetorial-snapshot.json', import.meta.url), 'utf8'),
);
const ok = (data: unknown) => ({ success: true, data });
export async function installVetorialAPI(page: Page) {
  const payload = structuredClone(snapshot.payload);
  payload.roles.atendimento.prompt =
    'Você é Ricardo IA, assistente da Vetorial.\nAjude o contato com clareza e respeito.\nConsulte a disponibilidade antes de sugerir horários.';
  payload.roles.analista.prompt =
    'Analise a conversa e atualize o pipeline.\nPreserve campos preenchidos pela equipe.\nProduza apenas informações internas.';
  const revisions = [
    {
      id: 'revision-1',
      revision: 1,
      status: 'published',
      created_at: '2026-11-13T12:00:00Z',
      payload,
    },
  ];
  const agents = ['atendimento', 'analista'].map((role, i) => ({
    id: `agent-${i + 1}`,
    name: i ? 'Analista do pipeline' : 'Ricardo IA',
    role,
    model: 'gpt-6-luna',
    prompt_version: i ? '1.1' : '1.3',
    mode: 'pilot',
    health: 'healthy',
    desired_version: 1,
    applied_version: 1,
    description: 'Agente sintético',
  }));
  let lock = 0;
  let paused = false;
  let session: Record<string, unknown> | undefined;
  const calls: { path: string; method: string; body: any; headers: Record<string, string> }[] = [];
  const state = {
    loadingPath: '',
    errorPath: '',
    metricsEmpty: false,
    metricsError: false,
    loading: false,
    partial: false,
    catalogEmpty: false,
    readOnly: false,
    conflict: false,
    mode: 'pilot',
    eligible: true,
    health: 'healthy',
    assignee: false,
    calls,
  };
  const json = (route: Route, data: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const conversation = () => ({
    id: '00000000-0000-4000-8000-000000000099',
    uuid: '00000000-0000-4000-8000-000000000099',
    inbox_id: 'inbox-1',
    status: 'open',
    display_id: '42',
    assignee_id: state.assignee ? 'user-1' : null,
    assignee: state.assignee ? { id: 'user-1', name: 'Equipe sintética' } : null,
    can_reply: true,
    contact: {
      id: 'contact-1',
      name: 'Marina · contato sintético',
      phone_number: '+15550000002',
      type: 'contact',
      labels: [],
      custom_attributes: {},
    },
    inbox: {
      id: 'inbox-1',
      name: 'WhatsApp Vetorial',
      channel_type: 'Channel::Whatsapp',
      agent_bot_active: true,
    },
    meta: {},
    labels: [],
    messages: [],
    custom_attributes: {},
    additional_attributes: {},
    unread_count: 0,
    created_at: '2026-11-13T12:00:00Z',
    last_activity_at: '2026-11-13T12:00:00Z',
    priority: null,
    timestamp: 1794571200,
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    if (!['GET', 'OPTIONS'].includes(method))
      calls.push({ path, method, body, headers: request.headers() });
    if (path.endsWith('/auth/validate'))
      return json(
        route,
        ok({
          user: {
            id: 'user-1',
            name: 'Equipe sintética',
            email: 'teste@example.com',
            account_id: 'account-1',
            account: { id: 'account-1', name: 'Vetorial' },
            role: 'administrator',
            ui_settings: {},
          },
          token: { access_token: 'synthetic-local' },
        }),
      );
    if (path.endsWith('/resource_actions'))
      return json(
        route,
        ok({
          resources: { ai_agents: ['read', 'update'], conversations: ['read', 'update'] },
          all_permissions: [
            'ai_agents.read',
            'ai_agents.update',
            'conversations.read',
            'conversations.update',
          ].map(key => ({ key, display_name: key })),
        }),
      );
    if (path.endsWith('/permissions'))
      return json(
        route,
        ok({
          permissions: state.readOnly
            ? ['ai_agents.read', 'conversations.read']
            : ['ai_agents.read', 'ai_agents.update', 'conversations.read', 'conversations.update'],
        }),
      );
    if (path.endsWith('/user_tours'))
      return json(
        route,
        ok([
          { tour_key: 'onboarding:welcome', status: 'completed' },
          { tour_key: 'agents', status: 'completed' },
        ]),
      );
    if (state.loadingPath && path.includes(state.loadingPath))
      await new Promise(resolve => setTimeout(resolve, 1500));
    if (state.errorPath && path.includes(state.errorPath)) return json(route, { error: {} }, 503);
    if (path.endsWith('/agent_catalog'))
      return json(route, {
        success: true,
        data: {
          managed: state.catalogEmpty ? [] : agents,
          native: state.partial
            ? null
            : {
                data: state.catalogEmpty
                  ? []
                  : [
                      {
                        id: 'native-1',
                        name: 'Assistente nativo sintético',
                        description: 'Agente do catálogo existente',
                        type: 'llm',
                        model: 'gpt-6-luna',
                        created_at: '2026-11-13T12:00:00Z',
                      },
                    ],
                meta: {
                  pagination: {
                    page: 1,
                    page_size: 24,
                    total: state.catalogEmpty ? 0 : 1,
                    total_pages: state.catalogEmpty ? 0 : 1,
                  },
                },
              },
        },
        meta: { partial: state.partial },
      });
    if (path.includes('/vetorial_agents/')) {
      if (state.loading) await new Promise(resolve => setTimeout(resolve, 1500));
      if (state.conflict && method !== 'GET')
        return json(route, { error: { code: 'conflict' } }, 409);
      if (path.endsWith('/metrics'))
        return state.metricsError
          ? json(route, { error: {} }, 503)
          : json(
              route,
              ok({
                conversations: 12,
                appointments: 3,
                errors: 1,
                month_cost_micro_usd: 0,
                usage_known: 0,
                usage_unknown: 4,
                input_tokens: 1400,
                output_tokens: 900,
                measurement_started_at: state.metricsEmpty ? null : '2026-11-13T12:00:00Z',
                latency: { n: state.metricsEmpty ? 0 : 12, p50_ms: 2400, p95_ms: 4100 },
                recent_executions: state.metricsEmpty
                  ? []
                  : [
                      {
                        role: 'atendimento',
                        status: 'completed',
                        revision: 1,
                        occurred_at: '2026-11-13T12:00:00Z',
                        latency_ms: 2400,
                        cost_micro_usd: null,
                      },
                      {
                        role: 'analista',
                        status: 'failed',
                        revision: 1,
                        occurred_at: '2026-11-13T12:01:00Z',
                        latency_ms: 1500,
                        cost_micro_usd: null,
                      },
                    ],
              }),
            );
      if (path.endsWith('/integrations'))
        return json(
          route,
          ok({
            openai: 'configured',
            groq: 'configured',
            calendly: 'configured',
            google_gateway: 'error',
            evolution: 'absent',
          }),
        );
      if (path.endsWith('/activation_challenges'))
        return json(
          route,
          ok({ nonce: 'synthetic-nonce', phrase: 'ATIVAR PARA TODOS', expires_in: 60 }),
        );
      if (path.endsWith('/activation')) {
        agents[0].mode = body.mode;
        lock++;
        return json(route, ok(revisions[0]));
      }
      if (path.includes('/test_sessions')) {
        if (method === 'POST' && path.endsWith('/test_sessions'))
          session = {
            id: 'session-1',
            state: 'open',
            revision_id: body.revision_id,
            messages: [],
            budget: { spent_micro_usd: 0, reserved_micro_usd: 0, ceiling_micro_usd: 50000 },
          };
        if (path.endsWith('/messages'))
          (session!.messages as any[]).push({
            request_id: 'turn-1',
            text: body.text,
            status: 'completed',
            response: {
              text: 'Simulação: posso ajudar a encontrar um horário.',
              tools: ['Agenda simulada'],
              private: true,
            },
          });
        if (path.endsWith('/close')) session!.state = 'closed';
        return json(route, ok(session));
      }
      if (path.endsWith('/revisions') && method === 'POST') {
        lock++;
        const revision = {
          id: `revision-${revisions.length + 1}`,
          revision: revisions.length + 1,
          status: 'draft',
          created_at: '2026-11-13T13:00:00Z',
          payload: body.payload,
        };
        revisions.unshift(revision);
        return json(route, ok(revision));
      }
      if (path.endsWith('/restore')) {
        lock++;
        const revision = {
          ...revisions[revisions.length - 1],
          id: 'restored',
          revision: revisions.length + 1,
          status: 'draft',
        };
        revisions.unshift(revision);
        return json(route, ok(revision));
      }
      if (path.endsWith('/publish')) {
        revisions[0].status = 'published';
        for (const agent of agents) {
          agent.desired_version = revisions[0].revision;
          agent.health = 'awaiting_configuration';
        }
        lock++;
        return json(route, ok(revisions[0]));
      }
      if (path.endsWith('/revisions')) return json(route, ok(revisions));
      if (path.includes('/revisions/'))
        return json(route, ok(revisions.find(r => path.endsWith(r.id))));
      const agent = path.includes('agent-2') ? agents[1] : agents[0];
      return json(
        route,
        ok({
          ...agent,
          can_manage: !state.readOnly,
          lock_version: lock,
          control_source: 'crm',
          published_revision: revisions.find(r => r.status === 'published'),
        }),
      );
    }
    if (path.endsWith('/vetorial_ia/pause')) {
      paused = true;
      return json(route, ok({ version: 1, paused: true }));
    }
    if (path.endsWith('/vetorial_ia/resume')) {
      paused = false;
      return json(route, ok({ version: 2, paused: false }));
    }
    if (path.endsWith('/vetorial_ia'))
      return json(
        route,
        ok({
          version: paused ? 1 : 0,
          paused,
          eligible: state.eligible,
          mode: state.mode,
          health: state.health,
          reason: paused ? 'pausa_manual' : null,
        }),
      );
    if (path.endsWith('/conversations') || path.endsWith('/conversations/filter'))
      return json(route, {
        ...ok([conversation()]),
        meta: { pagination: { page: 1, page_size: 24, total: 1, total_pages: 1 } },
      });
    if (path.endsWith('/00000000-0000-4000-8000-000000000099/messages'))
      return json(route, {
        ...ok([
          {
            id: 'm1',
            conversation_id: conversation().id,
            content: 'Olá, quero conhecer o trabalho da Vetorial.',
            message_type: 'incoming',
            created_at: '2026-11-13T12:00:00Z',
            sender: { id: 'contact-1', name: 'Marina', type: 'contact' },
            attachments: [],
            content_attributes: {},
          },
        ]),
        meta: { pagination: { page: 1, total_pages: 1 } },
      });
    if (path.endsWith('/conversations/00000000-0000-4000-8000-000000000099'))
      return json(route, ok(conversation()));
    if (path.includes('/unread_count')) return json(route, ok({ count: 0 }));
    return json(route, ok([]));
  });
  return state;
}
