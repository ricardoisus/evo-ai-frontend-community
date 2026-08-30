import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'globals.css'), 'utf8');

describe('authenticated panel density', () => {
  it('scales only the authenticated body class to 90%', () => {
    expect(css).toMatch(/body\.authenticated-panel-density\s*{[^}]*zoom:\s*0\.9/s);
    expect(css).not.toMatch(/(?:^|\n)body\s*{[^}]*zoom:/s);
  });

  it('compensates the authenticated shell viewport dimensions', () => {
    expect(css).toMatch(/\.authenticated-shell\s*{[^}]*width:\s*calc\(100vw\s*\/\s*0\.9\)/s);
    expect(css).toMatch(/\.authenticated-shell\s*{[^}]*height:\s*calc\(100dvh\s*\/\s*0\.9\)/s);
  });
});
