import type { Page } from '@playwright/test';
export async function visualAudit(page: Page) {
  return page.evaluate(() => {
    const rgb = (color: string) =>
      color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) || [0, 0, 0];
    const luminance = (color: number[]) =>
      color
        .map(x => x / 255)
        .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
        .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
    const checks = [
      ...document.querySelectorAll(
        '.va-page h1,.va-page h2,.va-page p,.va-page small,.va-page label,.va-status,.va-managed h2,.va-managed p',
      ),
    ]
      .filter(x => x.getBoundingClientRect().height > 0 && x.textContent?.trim())
      .map(element => {
        const style = getComputedStyle(element);
        let parent: Element | null = element;
        let background = 'rgb(242,239,232)';
        while (parent) {
          const candidate = getComputedStyle(parent).backgroundColor;
          if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {
            background = candidate;
            break;
          }
          parent = parent.parentElement;
        }
        const a = luminance(rgb(style.color));
        const b = luminance(rgb(background));
        return {
          text: element.textContent!.trim().slice(0, 70),
          color: style.color,
          background,
          contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          fontSize: style.fontSize,
        };
      });
    return {
      minimum: Math.min(...checks.map(x => x.contrast)),
      checks,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
}
