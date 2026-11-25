import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as icons from './index';

const NAV = ['Home', 'Search', 'Compass', 'PlusSquare', 'Bell', 'User'] as const;

function render(name: string): string {
  const Component = (icons as unknown as Record<string, () => React.ReactElement>)[name];
  if (!Component) throw new Error(`${name} がアイコンの部品に無い`);
  return renderToStaticMarkup(<Component />);
}

describe('アイコン', () => {
  it('アイコンは 24px の格子・線 2px で、ナビの 6 つに塗りつぶしの版がある', () => {
    const names = Object.keys(icons).filter((k) => k.endsWith('Icon'));
    expect(names).toEqual(
      expect.arrayContaining(['HeartIcon', 'MoreIcon', 'CloseIcon', 'GridIcon', 'CarouselIcon']),
    );
    for (const name of names) {
      const html = render(name);
      expect(html, name).toContain('viewBox="0 0 24 24"');
      expect(html, name).toContain('stroke-width="2"');
      expect(html, name).toContain('aria-hidden="true"');
    }
    for (const base of NAV) {
      expect(render(`${base}FilledIcon`), base).toContain('data-filled="true"');
      expect(render(`${base}Icon`), base).not.toContain('data-filled');
    }
    for (const base of ['Grid', 'Carousel']) {
      const Component = (
        icons as unknown as Record<string, (p: { filled?: boolean }) => React.ReactElement>
      )[`${base}Icon`]!;
      expect(renderToStaticMarkup(<Component filled />), base).toContain('data-filled="true"');
      expect(renderToStaticMarkup(<Component />), base).not.toContain('data-filled');
    }
    for (const name of ['MenuIcon']) {
      expect(render(name), name).toContain('<svg');
    }
  });
});
