# Cartões por pipeline · U3

Data: 11/11/2026. Autor: Theo, CTO · Codex Sol. Status: implementado e validado localmente; aguarda revisão e deploy.
Fontes: código desta branch; plano U1, revisão U2 e auditoria V1 da frente Evo CRM da Vetorial.

- Colunas304px e gap16px, com/sem zoom do shell, em1440/390px, claro/escuro.
- Configuração compartilhada por pipeline, prévia, ordem, visibilidade e densidade. Revisão atômica protege contra sobrescrita.
- Migração aditiva no CRM deve preceder este frontend. Banco e conteúdo destas capturas são sintéticos.
- Medições: [u3-medicoes.json](u3-medicoes.json). Contraste de metadados renderizados:6,26:1 claro e8,10:1 escuro.
- Evidência de navegação, persistência depois de reload, falha422 preservando rascunho, foco devolvido, rollback503 e movimento pelo menu: script abaixo.
- `body.scrollWidth` é medido em pixels lógicos do body com zoom0,9; o quadro contém sua própria rolagem horizontal.

```sh
EVO_LOCAL_LOGIN_FILE=/caminho/privado/login-local.private.json \
EVO_LOCAL_PIPELINE_ID=uuid-do-pipeline-sintetico \
EVO_LOCAL_BASE_URL=http://127.0.0.1:5174 \
EVO_SCREENSHOT_DIR=tmp/pipeline-card-configuration \
node scripts/verify-pipeline-cards.mjs
```

Requer Chrome, frontend Vite em5174, CRM em3010 e Auth em3011 da stack sintética. O script encaminha as requisições reais locais por `route.fetch/fulfill` para evitar o CORS do build local em outra porta; substitui somente os dois erros deliberados422/503. Não imprime nem exporta cookies/tokens. Bloqueia navegação externa. O PNG de arrastar registra o placeholder, não o fantasma nativo do sistema operacional.

Validação:22 testes relevantes frontend; typecheck e build; ESLint dos componentes/serviço e novos testes sem erros. O arquivo de tipos possui10 ocorrências de lint preexistentes, confirmadas no main. Suíte geral interrompida após falhas fora desta frente; três arquivos amostrados no main reproduziram13 falhas (Chat, widget MessageList e lastSavedMark). Não declarar a suíte geral verde.

U4: concluir P1 da toolbar desktop, rótulos pt-BR e estados vazio/carregando, incluindo quantidade de etapas do último carregamento. Conversas/canais/agenda/agentes não foram alterados. Especialidade entra no padrão se houver definição autorizada. Limites7/14 dias e “Múltiplas moedas” sem popover seguem U2.
