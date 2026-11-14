import { test, expect } from '@playwright/test';
import { installVetorialAPI } from './vetorial-api';
import path from 'node:path';
import fs from 'node:fs';
const output = process.env.I4_CAPTURES || 'test-results/i4';
for (const width of [1440, 390])
  for (const theme of ['light', 'dark']) {
    test(`conversation ${width} ${theme}`, async ({ page }) => {
      page.setDefaultTimeout(10000);
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.addInitScript(theme => {
        localStorage.setItem('access_token', 'synthetic-local');
        localStorage.setItem('theme', theme);
        localStorage.setItem('i18nextLng', 'pt-BR');
      }, theme);
      const state = await installVetorialAPI(page);
      const go = () => page.goto('/conversations/00000000-0000-4000-8000-000000000099');
      const shot = async (name: string) => {
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ animations: 'disabled', path: path.join(output, `${name}-${width}-${theme}.png`) });
      };
      await go();
      await expect(page.getByText('IA atendendo', { exact: true })).toBeVisible();
      await expect(page.getByText('IA atendendo', { exact: true })).toHaveAttribute('data-state', 'attending');
      await shot('conversa-atendendo');
      await page.getByRole('button', { name: 'Pausar IA', exact: true }).click();
      await expect(page.getByText('IA pausada · por pessoa')).toBeVisible();
      await expect(page.getByText('IA pausada · por pessoa', { exact: true })).toHaveAttribute('data-state', 'paused');
      await shot('conversa-pausada');
      await page.getByRole('button', { name: 'Devolver à IA', exact: true }).click();
      await expect(page.getByText('IA atendendo', { exact: true })).toBeVisible();
      state.assignee = true;
      await go();
      await page.getByRole('button', { name: 'Devolver à IA', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot('conversa-confirmacao');
      await page.getByRole('button', { name: 'Remover responsável e devolver' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(
        state.calls.find(x => x.path.endsWith('/resume') && x.body.clear_assignee)?.body,
      ).toMatchObject({ clear_assignee: true });
      state.mode = 'off';
      await go();
      await expect(page.getByText('IA desligada')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pausar IA', exact: true })).toBeDisabled();
      await expect(page.getByText('IA desligada')).toHaveAttribute('data-state', 'inactive');
      await shot('conversa-desligada');
      state.mode = 'pilot';
      state.eligible = false;
      await go();
      await expect(page.getByText('Fora do piloto', { exact: true })).toBeVisible();
      await shot('conversa-fora-piloto');
      state.eligible = true;
      state.health = 'unavailable';
      await go();
      await expect(page.getByText('IA indisponível', { exact: true })).toBeVisible();
      await shot('conversa-indisponivel');
      expect(state.calls.some(x => x.path.includes('return_to_bot'))).toBe(false);
    });
  }
