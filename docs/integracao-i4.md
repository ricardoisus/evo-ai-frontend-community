# I4 — Managed agents interface

The existing Agents page now reads the Rails catalog. Managed profiles stay separate from native bulk selection and native Core mutation routes. Native tools, wizards and other agent consumers retain their original transport. Managed profiles use `/agents/vetorial/:id`, protected by `ai_agents.read`; configuration controls also require the server's `can_manage` flag and the update grant. Test sessions require the update grant. Conversation controls use the existing conversation read/update grants and the durable Rails control routes.

Drafts carry the entire published bundle, preserving the other role. Saving is distinct from publication. Existing drafts can be opened from history after reload. Reversion creates a draft while preserving current activation and native bindings. Mutations carry If-Match and an intent-specific Idempotency-Key; ambiguous retries reuse the key. Native return-to-bot checks the managed route first and only uses the native handoff after a 404. A lookup outage never falls back to the native handoff.

Tests use the runtime's offline simulation exclusively. Opening a panel does not create a session. The plan selects a pinned revision, purpose, approval criterion, sample size and spending ceiling. Session IDs and pending creation/turn intent keys survive reload within the browser session. Runtime budget DTOs supply spent/reserved/ceiling amounts; missing amounts remain unavailable. No WhatsApp recipient, OAuth or secret input exists on these screens.

The browser fixture `e2e/fixtures/vetorial-snapshot.json` is a technical test copy of CRM `spec/fixtures/vetorial_agent/snapshot.json` from commit 11e008b. The canonical fixture remains in the CRM; the copy allows standalone browser/unit tests without Rails or paid providers. The browser adapter replaces only synthetic prompt text. It mocks HTTP at the transport boundary, renders the real application/routes/components and refuses to imply a production validation.

## Validation

```sh
npm ci --ignore-scripts
npx vitest run src/components/agents/vetorial/Interface.spec.tsx src/components/chat/conversation/ConversationActionsDropdown.spec.tsx
npm run build
npx eslint src/components/agents/vetorial src/pages/Customer/Agents/VetorialAgentPage.tsx src/services/agents/vetorialService.ts
I4_CAPTURES='/Users/ricardohenrique/Projetos/Atividades da Vetorial/Vetorial - Evo CRM Agentes/entregas/capturas/integracao/depois' npx playwright test e2e/vetorial-interface.spec.ts e2e/vetorial-conversation.spec.ts e2e/vetorial-states.spec.ts
```

Use one Playwright invocation at a time: its temporary Vite server is shared on 5173 and is stopped by the invocation that launched it. Tests cover both themes at 1440×900 and 390×844. Contrast checks cover the new profile's rendered heading/body/metadata/status text, and overflow checks cover profile/list states. Browser screenshots include the existing shell, not a separate mockup. Final visual review belongs to I5.

The optional whole-repository Vitest run has unrelated baseline failures. A clean `git archive 783a951` with the same node_modules reproduced 27 failures/22 passes in Sidebar, ContactAvatar, widget MessageList, opusRecorder and flowEditor lastSavedMark. The I4 and native handoff regression suites are green. This stage does not claim that the repository-wide legacy suite is green.

Canonical delivery, validation summary and screenshot matrix: `/Users/ricardohenrique/Projetos/Atividades da Vetorial/Vetorial - Evo CRM Agentes/entregas/I4-interface.md` and `I4-validacao.json`. No merge, deployment, production access or paid inference is included.
