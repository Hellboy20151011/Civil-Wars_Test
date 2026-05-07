import { describe, expect, it } from 'vitest';
import { append, clear, el, render } from '../../scripts/ui/component.js';

describe('ui/component el()', () => {
  it('creates element with text safely', () => {
    const node = el('div', { text: 'Hallo' });
    expect(node.tagName).toBe('DIV');
    expect(node.textContent).toBe('Hallo');
  });

  it('throws when html option is provided', () => {
    expect(() => el('div', { html: '<b>unsafe</b>' })).toThrow(
      'Unsafe option "html" is disabled. Use text/content-safe DOM APIs instead.'
    );
  });
});

describe('ui/component helpers', () => {
  it('append handles primitive and node children', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    child.textContent = 'X';

    append(parent, ['A', 2, child]);

    expect(parent.textContent).toBe('A2X');
  });

  it('render clears target and appends new children', () => {
    const target = document.createElement('div');
    target.textContent = 'old';

    render(target, [el('span', { text: 'new' })]);

    expect(target.textContent).toBe('new');
    clear(target);
    expect(target.textContent).toBe('');
  });
});
