import { afterEach, describe, expect, it } from 'vitest';
import { canStartKanbanPan, getShiftWheelHorizontalDelta, type KanbanPanPointerEvent } from './kanbanPan';

function mockBox(
  element: HTMLElement,
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
    clientLeft?: number;
    clientTop?: number;
    clientWidth: number;
    clientHeight: number;
    offsetWidth?: number;
    offsetHeight?: number;
    scrollHeight?: number;
  },
) {
  Object.defineProperty(element, 'clientLeft', { value: box.clientLeft ?? 0, configurable: true });
  Object.defineProperty(element, 'clientTop', { value: box.clientTop ?? 0, configurable: true });
  Object.defineProperty(element, 'clientWidth', { value: box.clientWidth, configurable: true });
  Object.defineProperty(element, 'clientHeight', { value: box.clientHeight, configurable: true });
  Object.defineProperty(element, 'offsetWidth', { value: box.offsetWidth ?? box.width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: box.offsetHeight ?? box.height, configurable: true });
  Object.defineProperty(element, 'scrollHeight', { value: box.scrollHeight ?? box.clientHeight, configurable: true });
  element.getBoundingClientRect = () =>
    ({
      left: box.left,
      top: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      width: box.width,
      height: box.height,
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

function buildBoard() {
  document.body.innerHTML = `
    <div class="kanban-scroll">
      <div class="kanban-track">
        <section class="kanban-column" data-stage-id="stage-1">
          <div class="kanban-column-surface">
            <div class="kanban-column-header">
              <div>
                <h3>Novo lead</h3>
                <p>R$ 12.500,00</p>
              </div>
              <button type="button" aria-label="Adicionar negócio">
                <svg><path /></svg>
              </button>
            </div>
            <div class="kanban-dropzone">
              <div class="deal-card-shell">
                <div class="configured-deal-card">
                  <span class="deal-value">R$ 12.500,00</span>
                </div>
              </div>
              <div class="kanban-stage-empty">
                <span>Nenhum negócio nesta etapa</span>
                <button type="button">Adicionar negócio</button>
              </div>
              <a href="/contacts/1">Contato</a>
              <input type="text" />
              <select><option>A</option></select>
              <textarea></textarea>
              <details><summary>+2</summary></details>
              <label><span>Campo</span></label>
              <div role="menu">
                <div role="menuitem"><span>Editar</span></div>
                <div role="menuitemcheckbox"><span>Ativo</span></div>
                <div role="menuitemradio"><span>Opção</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div data-radix-popper-content-wrapper="">
      <div class="portal-surface"><span>Fora do quadro</span></div>
    </div>
  `;

  return {
    board: document.querySelector<HTMLDivElement>('.kanban-scroll')!,
    header: document.querySelector<HTMLDivElement>('.kanban-column-header')!,
    headerTitle: document.querySelector<HTMLHeadingElement>('.kanban-column-header h3')!,
    headerSum: document.querySelector<HTMLParagraphElement>('.kanban-column-header p')!,
    headerButtonSvg: document.querySelector('.kanban-column-header button path')!,
    dropzone: document.querySelector<HTMLDivElement>('.kanban-dropzone')!,
    card: document.querySelector<HTMLDivElement>('.deal-card-shell')!,
    cardValue: document.querySelector<HTMLSpanElement>('.deal-value')!,
    emptyState: document.querySelector<HTMLDivElement>('.kanban-stage-empty')!,
    emptyStateText: document.querySelector<HTMLSpanElement>('.kanban-stage-empty span')!,
    emptyStateButton: document.querySelector<HTMLButtonElement>('.kanban-stage-empty button')!,
    link: document.querySelector<HTMLAnchorElement>('a')!,
    input: document.querySelector<HTMLInputElement>('input')!,
    select: document.querySelector<HTMLSelectElement>('select')!,
    textarea: document.querySelector<HTMLTextAreaElement>('textarea')!,
    summary: document.querySelector<HTMLElement>('summary')!,
    labelSpan: document.querySelector<HTMLSpanElement>('label span')!,
    menu: document.querySelector<HTMLDivElement>('[role="menu"]')!,
    menuItemSpan: document.querySelector<HTMLSpanElement>('[role="menuitem"] span')!,
    menuCheckboxSpan: document.querySelector<HTMLSpanElement>('[role="menuitemcheckbox"] span')!,
    menuRadioSpan: document.querySelector<HTMLSpanElement>('[role="menuitemradio"] span')!,
    portalSpan: document.querySelector<HTMLSpanElement>('.portal-surface span')!,
  };
}

function pointerEvent(
  board: HTMLElement,
  target: EventTarget | null,
  overrides: Partial<KanbanPanPointerEvent> = {},
): KanbanPanPointerEvent {
  return {
    pointerType: 'mouse',
    button: 0,
    clientX: 150,
    clientY: 120,
    target,
    currentTarget: board,
    ...overrides,
  };
}

describe('canStartKanbanPan', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('permite arrastar com botão esquerdo do mouse no fundo, cabeçalho, área vazia da coluna e estado vazio', () => {
    const dom = buildBoard();

    expect(canStartKanbanPan(pointerEvent(dom.board, dom.board))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.header))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.headerTitle))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.headerTitle.firstChild))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.headerSum))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.dropzone))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.emptyState))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.emptyStateText))).toBe(true);
  });

  it('não inicia arraste para toque, caneta ou outros botões do mouse', () => {
    const dom = buildBoard();

    expect(canStartKanbanPan(pointerEvent(dom.board, dom.header, { pointerType: 'touch' }))).toBe(false);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.header, { pointerType: 'pen' }))).toBe(false);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.header, { button: 1 }))).toBe(false);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.header, { button: 2 }))).toBe(false);
  });

  it('não inicia arraste em cartões, elementos interativos, menus nem portais fora do quadro', () => {
    const dom = buildBoard();

    const blockedTargets: Array<EventTarget | null> = [
      null,
      dom.card,
      dom.cardValue,
      dom.headerButtonSvg,
      dom.emptyStateButton,
      dom.link,
      dom.input,
      dom.select,
      dom.textarea,
      dom.summary,
      dom.labelSpan,
      dom.menu,
      dom.menuItemSpan,
      dom.menuCheckboxSpan,
      dom.menuRadioSpan,
      dom.portalSpan,
    ];

    for (const target of blockedTargets) {
      expect(canStartKanbanPan(pointerEvent(dom.board, target))).toBe(false);
    }
  });

  it('não inicia arraste na barra de rolagem vertical da coluna, mas permite na área útil e quando não há overflow', () => {
    const dom = buildBoard();

    // Coluna com overflow vertical e barra de rolagem de 6px à direita + borda de 1px
    mockBox(dom.dropzone, {
      left: 100,
      top: 80,
      width: 304,
      height: 500,
      clientLeft: 1,
      clientWidth: 296,
      clientHeight: 498,
      offsetWidth: 304,
      scrollHeight: 920,
    });

    // Dentro da área útil da coluna (101 <= x < 397)
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.dropzone, { clientX: 250, clientY: 200 }))).toBe(true);
    // Na barra de rolagem vertical da coluna (x >= 397)
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.dropzone, { clientX: 397, clientY: 200 }))).toBe(false);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.dropzone, { clientX: 400, clientY: 200 }))).toBe(false);

    // Sem overflow vertical, a mesma coordenada pode iniciar arraste normalmente
    mockBox(dom.dropzone, {
      left: 100,
      top: 80,
      width: 304,
      height: 500,
      clientLeft: 1,
      clientWidth: 302,
      clientHeight: 498,
      offsetWidth: 304,
      scrollHeight: 400,
    });
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.dropzone, { clientX: 397, clientY: 200 }))).toBe(true);
  });

  it('não inicia arraste na barra de rolagem horizontal do próprio quadro', () => {
    const dom = buildBoard();

    mockBox(dom.board, {
      left: 0,
      top: 100,
      width: 1000,
      height: 600,
      clientTop: 0,
      clientWidth: 1000,
      clientHeight: 588,
      offsetHeight: 600,
    });

    expect(canStartKanbanPan(pointerEvent(dom.board, dom.board, { clientX: 400, clientY: 500 }))).toBe(true);
    expect(canStartKanbanPan(pointerEvent(dom.board, dom.board, { clientX: 400, clientY: 692 }))).toBe(false);
  });
});

describe('getShiftWheelHorizontalDelta', () => {
  it('converte shift+roda vertical em deslocamento horizontal somente quando deltaX é zero', () => {
    expect(getShiftWheelHorizontalDelta({ shiftKey: true, deltaX: 0, deltaY: 120, deltaMode: 0 }, 800)).toBe(120);
    expect(getShiftWheelHorizontalDelta({ shiftKey: true, deltaX: 0, deltaY: 3, deltaMode: 1 }, 800)).toBe(48);
    expect(getShiftWheelHorizontalDelta({ shiftKey: true, deltaX: 0, deltaY: 1, deltaMode: 2 }, 800)).toBe(800);
    // Quando o navegador/SO já converteu em deltaX ou Shift não está pressionado, não duplica
    expect(getShiftWheelHorizontalDelta({ shiftKey: true, deltaX: 120, deltaY: 120, deltaMode: 0 }, 800)).toBe(0);
    expect(getShiftWheelHorizontalDelta({ shiftKey: false, deltaX: 0, deltaY: 120, deltaMode: 0 }, 800)).toBe(0);
  });
});
