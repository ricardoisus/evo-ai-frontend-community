import { expect, test, type Page, type Route } from '@playwright/test';

const ok = (data: unknown) => ({ success: true, data, meta: {}, message: '' });

async function json(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
}

function makeItem(stageId: string, index: number) {
  const id = `deal-${stageId}-${index}`;
  return {
    id,
    deal_id: id,
    item_id: id,
    type: 'deal',
    pipeline_id: 'pipeline-1',
    pipeline_stage_id: stageId,
    stage_id: stageId,
    title: `Negócio ${stageId} #${index}`,
    value: 1500 * index,
    currency: 'BRL',
    deal_status: 'open',
    notes: '',
    custom_fields: {},
    owner: null,
    primary_contact: {
      id: `contact-${index}`,
      name: `Contato ${index}`,
      email: `contato${index}@example.com`,
      phone_number: '+55 11 99999-0000',
      avatar_url: null,
    },
    contact: {
      id: `contact-${index}`,
      name: `Contato ${index}`,
      email: `contato${index}@example.com`,
      phone_number: '+55 11 99999-0000',
      avatar_url: null,
    },
    labels: [],
    contact_count: 1,
    conversation_count: 0,
    file_count: 0,
    is_lead: false,
    entered_at: 1788091200,
    created_at: '2026-08-30T10:00:00Z',
    updated_at: '2026-08-30T10:00:00Z',
    tasks_info: {
      pending_count: 0,
      overdue_count: 0,
      due_soon_count: 0,
      completed_count: 0,
      total_count: 0,
    },
  };
}

async function installKanbanApi(page: Page) {
  const stages = [
    {
      id: 'stage-1',
      name: 'Novo lead',
      color: '#7c3aed',
      item_count: 14,
      items: Array.from({ length: 14 }, (_, idx) => makeItem('stage-1', idx + 1)),
    },
    {
      id: 'stage-2',
      name: 'Qualificação',
      color: '#0ea5e9',
      item_count: 0,
      items: [],
    },
    {
      id: 'stage-3',
      name: 'Proposta',
      color: '#10b981',
      item_count: 1,
      items: [makeItem('stage-3', 1)],
    },
    {
      id: 'stage-4',
      name: 'Negociação',
      color: '#f59e0b',
      item_count: 0,
      items: [],
    },
    {
      id: 'stage-5',
      name: 'Fechamento',
      color: '#ef4444',
      item_count: 0,
      items: [],
    },
    {
      id: 'stage-6',
      name: 'Pós-venda',
      color: '#6366f1',
      item_count: 0,
      items: [],
    },
  ];

  const pipeline = {
    id: 'pipeline-1',
    name: 'Pipeline Scroll E2E',
    description: 'Pipeline com várias etapas',
    custom_fields: { attributes: [] },
    services_info: { total_value: 0 },
    stages,
  };

  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/undefined/, '');

    if (path.endsWith('/auth/validate')) {
      return json(
        route,
        ok({
          user: {
            id: 'user-1',
            name: 'Usuário E2E',
            email: 'e2e@example.com',
            account_id: 'account-1',
            account: { id: 'account-1', name: 'Conta E2E' },
            role: 'administrator',
            ui_settings: {},
          },
          token: { access_token: 'e2e-token' },
        }),
      );
    }
    if (path.endsWith('/resource_actions')) {
      return json(route, ok({ resources: { pipelines: ['read', 'create', 'update'] }, all_permissions: [] }));
    }
    if (path.endsWith('/permissions')) {
      return json(route, ok({ permissions: ['pipelines.read', 'pipelines.create', 'pipelines.update'] }));
    }
    if (path.endsWith('/user_tours')) {
      return json(route, ok([{ tour_key: 'onboarding:welcome', status: 'completed' }]));
    }
    if (path.includes('/unread_count')) return json(route, ok({ count: 0 }));
    if (path.endsWith('/users')) return json(route, ok([{ id: 'owner-1', name: 'Ana Souza' }]));
    if (path.endsWith('/pipelines/pipeline-1')) return json(route, ok(pipeline));
    if (path.endsWith('/pipelines')) return json(route, ok([pipeline]));
    return json(route, ok(path.endsWith('/account') ? { id: 'account-1', locale: 'pt_BR' } : []));
  });
}

test('rolagem horizontal por wheel (deltaX e shift+roda) e arraste sobre colunas do kanban', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('theme', 'light');
    localStorage.setItem('i18nextLng', 'pt-BR');
  });
  await installKanbanApi(page);

  await page.goto('/pipelines/pipeline-1');
  await expect(page.getByText('Pipeline Scroll E2E').first()).toBeVisible();

  const board = page.locator('.kanban-scroll');
  const firstColumn = page.locator('section.kanban-column[data-stage-id="stage-1"]');
  const firstDropzone = firstColumn.locator('.kanban-dropzone');
  const firstCard = firstColumn.locator('.deal-card-shell').first();
  const secondColumn = page.locator('section.kanban-column[data-stage-id="stage-2"]');
  const secondEmpty = secondColumn.locator('.kanban-stage-empty');

  // Confirma que o quadro tem overflow horizontal e a 1ª coluna tem overflow vertical
  const dims = await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('.kanban-scroll')!;
    const dz = document.querySelector<HTMLElement>('section[data-stage-id="stage-1"] .kanban-dropzone')!;
    const dzStyle = getComputedStyle(dz);
    return {
      boardOverflowX: b.scrollWidth > b.clientWidth,
      dropzoneOverflowY: dz.scrollHeight > dz.clientHeight,
      overscrollX: dzStyle.overscrollBehaviorX,
      overscrollY: dzStyle.overscrollBehaviorY,
    };
  });
  expect(dims.boardOverflowX).toBe(true);
  expect(dims.dropzoneOverflowY).toBe(true);
  expect(dims.overscrollX).toBe('auto');
  expect(dims.overscrollY).toBe('contain');

  // 1. Wheel horizontal (deltaX) sobre um cartão dentro da coluna rola o quadro
  const cardBox = (await firstCard.boundingBox())!;
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.wheel(240, 0);
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);

  // Volta ao início para testar Shift+roda
  await board.evaluate(el => { el.scrollLeft = 0; });
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBe(0);

  // 2. Shift + wheel vertical sobre a coluna com overflow vertical rola o quadro na horizontal sem rolar a coluna
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 240);
  await page.keyboard.up('Shift');
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  expect(await firstDropzone.evaluate(el => el.scrollTop)).toBe(0);

  // 3. Wheel vertical normal sobre a coluna rola a coluna na vertical, mantendo a página parada
  await board.evaluate(el => { el.scrollLeft = 0; });
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBe(0);
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => firstDropzone.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await board.evaluate(el => el.scrollLeft)).toBe(0);

  // Volta ao início para testar arraste com o mouse
  await board.evaluate(el => { el.scrollLeft = 0; });
  await firstDropzone.evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBe(0);

  // 4. Arrastar pelo cabeçalho da coluna rola o quadro, aplica cursor grabbing e não seleciona texto
  const headerTitle = firstColumn.locator('.kanban-column-header h3');
  const titleBox = (await headerTitle.boundingBox())!;
  await page.mouse.move(titleBox.x + 20, titleBox.y + titleBox.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(titleBox.x - 160, titleBox.y + titleBox.height / 2, { steps: 6 });

  const duringPan = await page.evaluate(() => {
    const b = document.querySelector<HTMLElement>('.kanban-scroll')!;
    const title = document.querySelector<HTMLElement>('section[data-stage-id="stage-1"] .kanban-column-header h3')!;
    return {
      hasClass: b.classList.contains('is-panning'),
      boardCursor: getComputedStyle(b).cursor,
      childCursor: getComputedStyle(title).cursor,
      scrollLeft: b.scrollLeft,
      selection: window.getSelection()?.toString() ?? '',
    };
  });
  expect(duringPan.hasClass).toBe(true);
  expect(duringPan.boardCursor).toBe('grabbing');
  expect(duringPan.childCursor).toBe('grabbing');
  expect(duringPan.scrollLeft).toBeGreaterThan(100);
  expect(duringPan.selection).toBe('');

  await page.mouse.up({ button: 'left' });
  expect(await board.evaluate(el => el.classList.contains('is-panning'))).toBe(false);

  // 5. Arrastar pelo estado vazio da coluna também rola o quadro
  const emptyText = secondEmpty.locator('span');
  const emptyBox = (await emptyText.boundingBox())!;
  const beforeEmptyDrag = await board.evaluate(el => el.scrollLeft);
  await page.mouse.move(emptyBox.x + 20, emptyBox.y + emptyBox.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(emptyBox.x - 120, emptyBox.y + emptyBox.height / 2, { steps: 5 });
  await page.mouse.up({ button: 'left' });
  expect(await board.evaluate(el => el.scrollLeft)).toBeGreaterThan(beforeEmptyDrag + 50);

  // 6. Arrastar sobre um botão no cabeçalho ou sobre um cartão NÃO inicia pan do quadro
  await board.evaluate(el => { el.scrollLeft = 0; });
  await expect.poll(() => board.evaluate(el => el.scrollLeft)).toBe(0);
  const addBtnBox = (await firstColumn.locator('.kanban-column-header button').first().boundingBox())!;
  await page.mouse.move(addBtnBox.x + addBtnBox.width / 2, addBtnBox.y + addBtnBox.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(addBtnBox.x - 100, addBtnBox.y + addBtnBox.height / 2, { steps: 4 });
  expect(await board.evaluate(el => el.classList.contains('is-panning'))).toBe(false);
  await page.mouse.up({ button: 'left' });
  expect(await board.evaluate(el => el.scrollLeft)).toBe(0);

  const cardBoxAgain = (await firstCard.boundingBox())!;
  await page.mouse.move(cardBoxAgain.x + cardBoxAgain.width / 2, cardBoxAgain.y + cardBoxAgain.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(cardBoxAgain.x - 100, cardBoxAgain.y + cardBoxAgain.height / 2, { steps: 4 });
  expect(await board.evaluate(el => el.classList.contains('is-panning'))).toBe(false);
  await page.mouse.up({ button: 'left' });
  expect(await board.evaluate(el => el.scrollLeft)).toBe(0);

  // 7. Arrastar em um portal Radix (menu de opções da etapa) NÃO inicia pan do quadro
  const menuTrigger = firstColumn.locator('.kanban-column-header button').nth(1);
  await menuTrigger.click();
  const firstMenuItem = page.getByRole('menuitem').first();
  await expect(firstMenuItem).toBeVisible();
  const menuItemBox = (await firstMenuItem.boundingBox())!;
  await page.mouse.move(menuItemBox.x + menuItemBox.width / 2, menuItemBox.y + menuItemBox.height / 2);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(menuItemBox.x - 100, menuItemBox.y + menuItemBox.height / 2, { steps: 4 });
  expect(await board.evaluate(el => el.classList.contains('is-panning'))).toBe(false);
  await page.mouse.up({ button: 'left' });
  await page.keyboard.press('Escape');
  expect(await board.evaluate(el => el.scrollLeft)).toBe(0);

  // 8. Arrastar na barra de rolagem vertical da coluna NÃO inicia pan do quadro
  const scrollbarPoint = await firstDropzone.evaluate(el => {
    const r = el.getBoundingClientRect();
    const scaleX = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
    const scrollbarStart = r.left + (el.clientLeft + el.clientWidth) * scaleX;
    return {
      hasScrollbarGutter: r.right - scrollbarStart >= 2,
      x: scrollbarStart + (r.right - scrollbarStart) / 2,
      y: r.top + 40,
    };
  });
  if (scrollbarPoint.hasScrollbarGutter) {
    await page.mouse.move(scrollbarPoint.x, scrollbarPoint.y);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(scrollbarPoint.x - 100, scrollbarPoint.y + 40, { steps: 4 });
    expect(await board.evaluate(el => el.classList.contains('is-panning'))).toBe(false);
    await page.mouse.up({ button: 'left' });
    expect(await board.evaluate(el => el.scrollLeft)).toBe(0);
  }
});
