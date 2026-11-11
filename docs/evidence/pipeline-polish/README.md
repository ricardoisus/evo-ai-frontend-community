# Polimento do quadro · U4

- Data: 11/11/2026. Autor: Theo, CTO · Codex Sol. Status: implementado/testado localmente, aguardando U5/U6.
- Fontes: spec U1, auditoria V1 e revisão U2 da frente Evo CRM da Vetorial; código deste PR.
- Dados exclusivamente sintéticos. Sem merge, deploy ou mensagens de produção.

O quadro tem cabeçalho de118px em1440px, KPIs neutros e CTA “Adicionar negócio”. A busca mede320px. Origem/campanha fica nos filtros; contagens e somas acompanham o resultado. Há uma única ação “Limpar filtros”. No celular, o primeiro cartão começa em178,6px e os quatro controles principais medem44px.

Esqueleto usa a quantidade da última leitura bem-sucedida por pipeline em sessionStorage; fallback3, zero preservado e armazenamento indisponível tolerado. Pulso respeita reduced-motion. Erro oferece retry; sem etapas apresenta uma única ação. Preferência de idioma existente é preservada; as novas chaves pt-BR foram adicionadas.

- [Antes](u4-antes-toolbar-1440-light.png), [depois claro](u4-depois-toolbar-1440-light.png), [depois escuro](u4-depois-toolbar-1440-dark.png).
- [Vazio filtrado móvel](u4-depois-vazio-390-dark.png), [carregando](u4-depois-carregando.png), [erro](u4-depois-erro-retry.png), [sem etapas](u4-depois-sem-etapas.png).
- [Medições de DOM/contraste](u4-medicoes.json). Os demais PNGs e manifesto estão no acervo da frente, em entregas/capturas/depois/u4-*.

Reprodução: `scripts/verify-pipeline-polish.mjs`, com as mesmas variáveis locais documentadas em [U3](../pipeline-card-configuration/README.md). Requer Vite em5174 com VITE_API_URL=http://127.0.0.1:3010 e VITE_AUTH_API_URL=http://127.0.0.1:3011, Chrome e a stack sintética K1. O script seleciona pt-BR somente na sessão do navegador para a captura.

GET retido prova o esqueleto. Erro503, ausência de responsável e ausência de etapas são substituições explícitas de respostas locais; não alteram o banco. Os demais requests usam APIs locais reais. HTTP401 iniciais são a validação/refresh sem sessão antes do login. Exceções de rede não imprimem headers. Dispositivo físico de toque não foi testado.

Verificação:24 testes relevantes verdes, lint dos arquivos alterados, typecheck e build. Suíte geral mantém dívida registrada na U3; não se declara toda a suíte verde. [Regressão U3](u4-regressao-u3.json): persistência após reload,422 preserva rascunho,503 reverte movimento, foco, menu, drag/Escape e304px sem zoom passaram. O script foi tornado repetível restaurando o padrão sintético antes de começar. Backend não mudou na U4; seus34 exemplos da U3 não foram repetidos.
