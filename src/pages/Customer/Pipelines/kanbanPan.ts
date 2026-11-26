const PAN_BLOCKED_SELECTOR = [
  '.deal-card-shell',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  'label',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(', ');

export interface KanbanPanPointerEvent {
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
  currentTarget: HTMLElement;
}

function isOnVerticalScrollbar(element: HTMLElement, clientX: number): boolean {
  if (element.clientWidth <= 0 || element.scrollHeight <= element.clientHeight) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0) return false;
  const scaleX = element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1;
  const contentLeft = rect.left + element.clientLeft * scaleX;
  const contentRight = contentLeft + element.clientWidth * scaleX;
  return clientX < contentLeft || clientX >= contentRight;
}

function isOnHorizontalScrollbar(element: HTMLElement, clientY: number): boolean {
  if (element.clientHeight <= 0 || element.offsetHeight <= element.clientHeight + element.clientTop) return false;
  const rect = element.getBoundingClientRect();
  if (rect.height <= 0) return false;
  const scaleY = element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1;
  const contentBottom = rect.top + (element.clientTop + element.clientHeight) * scaleY;
  return clientY >= contentBottom;
}

export function getShiftWheelHorizontalDelta(
  event: Pick<WheelEvent, 'shiftKey' | 'deltaX' | 'deltaY' | 'deltaMode'>,
  pageWidth: number,
): number {
  if (!event.shiftKey || event.deltaX !== 0 || event.deltaY === 0) return 0;
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * pageWidth;
  return event.deltaY;
}

export function canStartKanbanPan(event: KanbanPanPointerEvent): boolean {
  if (event.pointerType !== 'mouse' || event.button !== 0) return false;

  const board = event.currentTarget;
  const rawTarget = event.target;
  if (!(rawTarget instanceof Node) || !board.contains(rawTarget)) return false;

  const target = rawTarget instanceof Element ? rawTarget : rawTarget.parentElement;
  if (!target || !board.contains(target)) return false;

  if (target.closest(PAN_BLOCKED_SELECTOR)) return false;

  const dropzone = target.closest<HTMLElement>('.kanban-dropzone');
  if (dropzone && isOnVerticalScrollbar(dropzone, event.clientX)) return false;

  if (isOnHorizontalScrollbar(board, event.clientY)) return false;

  return true;
}
