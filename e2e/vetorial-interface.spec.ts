import { visualAudit } from './vetorial-visual-audit';
import { test, expect, type Page } from '@playwright/test';
import { installVetorialAPI } from './vetorial-api';
import path from 'node:path';
import fs from 'node:fs';
const output = process.env.I4_CAPTURES || 'test-results/i4';
for (const width of [1440, 390])
  for (const theme of ['light', 'dark']) {
    test(`agent interface ${width} ${theme}`, async ({ page }) => {
      test.setTimeout(90000);
      page.setDefaultTimeout(10000);
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.addInitScript(theme => {
        localStorage.setItem('access_token', 'synthetic-local');
        localStorage.setItem('theme', theme);
        localStorage.setItem('i18nextLng', 'pt-BR');
      }, theme);
      const state = await installVetorialAPI(page);
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.message));
      async function shot(name: string) {
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`) });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflow).toBe(false);
      }
      await page.goto('/agents/list');
      await expect(page.getByRole('link', { name: /Ricardo IA/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Analista do pipeline/ })).toBeVisible();
      await shot('lista');
      await page.getByRole('link', { name: /Ricardo IA/ }).click();
      await expect(page.getByRole('heading', { name: 'Ricardo IA', exact: true })).toBeVisible();
      await expect(page.getByText('2.400 / 4.100 ms')).toHaveCount(0);
      await expect(page.getByText('2400 / 4100 ms')).toBeVisible();
      await shot('visao-geral');
      if (width === 390) {
        await page.getByText('Conversas atendidas', { exact: true }).scrollIntoViewIfNeeded();
        await shot('visao-geral-dados');
      }
      const audit = await visualAudit(page);
      fs.writeFileSync(
        path.join(output, `auditoria-${width}-${theme}.json`),
        JSON.stringify(audit, null, 2),
      );
      expect(audit.minimum).toBeGreaterThanOrEqual(4.5);
      await expect(
        page.getByRole('button', { name: 'Salvar rascunho', exact: true }),
      ).toBeDisabled();
      await page.getByRole('tab', { name: 'Prompt e versões' }).click();
      await page.getByRole('button', { name: 'Comparar', exact: true }).first().click();
      await shot('prompt-versoes');
      await page
        .getByLabel('Instruções do agente')
        .fill('Você é Ricardo IA.\nResponda com clareza.');
      await expect(page.getByText('Alterações não salvas')).toBeVisible();
      await shot('prompt-editado');
      await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeEnabled();
      expect(state.calls.find(x => x.path.endsWith('/revisions'))?.headers['if-match']).toBe('0');
      await page.getByRole('button', { name: 'Publicar', exact: true }).click();
      await expect(
        page.getByText('Versão publicada. Aguardando aplicação pelo serviço.'),
      ).toBeVisible();
      await page.getByRole('tab', { name: 'Comportamento' }).click();
      await shot('comportamento');
      await page.getByRole('tab', { name: 'Integrações' }).click();
      await expect(page.getByText('Erro de conexão')).toBeVisible();
      await shot('integracoes');
      await page.getByRole('tab', { name: 'Caixas e ativação' }).click();
      await page.getByRole('combobox', { name: 'Modo', exact: true }).selectOption('all');
      await page.getByRole('button', { name: 'Aplicar ativação' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirmar ativação' })).toBeDisabled();
      await shot('confirmar-todos');
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
      expect(state.calls.filter(x => x.path.endsWith('/activation'))).toHaveLength(0);
      await shot('caixas-ativacao');
      await page.getByRole('tab', { name: 'Execuções' }).click();
      await shot('execucoes');
      await page.getByRole('tab', { name: 'Testar agente', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Iniciar teste' })).toBeDisabled();
      await page.getByLabel('Propósito').fill('Validar agenda sintética');
      await page.getByLabel('Critério de aprovação').fill('Nenhum efeito externo');
      await shot('teste-plano');
      await page.getByRole('button', { name: 'Iniciar teste' }).click();
      await expect(page.getByText('Sessão aberta')).toBeVisible();
      await shot('teste-vazio');
      await page.getByLabel('Mensagem sintética').fill('Quero conhecer a Vetorial');
      await page.getByRole('button', { name: 'Enviar cenário' }).click();
      await expect(page.getByRole('heading', { name: 'Agente · simulação privada' })).toBeVisible();
      await shot('teste-resposta');
      await page.reload();
      await page.getByRole('tab', { name: 'Testar agente', exact: true }).click();
      await expect(page.getByText('Quero conhecer a Vetorial', { exact: true })).toBeVisible();
      expect(state.calls.filter(x => x.path.endsWith('/test_sessions'))).toHaveLength(1);
      await page.getByRole('button', { name: 'Terminar sessão' }).click();
      await shot('teste-encerrado');
      await page.getByRole('link', { name: 'Analista do pipeline', exact: false }).click();
      await expect(
        page.getByRole('heading', { name: 'Analista do pipeline', exact: true }),
      ).toBeVisible();
      await page.getByRole('tab', { name: 'Prompt e versões' }).click();
      await expect(page.getByLabel('Instruções do agente')).toHaveValue(/Analise a conversa/);
      await shot('analista');
      state.metricsEmpty = true;
      await page.getByRole('tab', { name: 'Execuções' }).click();
      await expect(
        page.getByRole('heading', { name: 'Nenhuma execução no período' }),
      ).toBeVisible();
      await shot('vazio');
      state.metricsError = true;
      await page.getByRole('tab', { name: 'Visão geral' }).click();
      await page.getByRole('combobox', { name: 'Origem', exact: true }).selectOption('test');
      await expect(page.getByRole('heading', { name: 'Não foi possível carregar' })).toBeVisible();
      await shot('erro');
      state.metricsError = false;
      state.loading = true;
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
      await expect(page.getByLabel('Carregando')).toBeVisible();
      await shot('carregando');
      state.loading = false;
      expect(errors).toEqual([]);
    });
  }
