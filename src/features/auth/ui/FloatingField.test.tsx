import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FloatingField } from './FloatingField';

const render = (props: Partial<Parameters<typeof FloatingField>[0]> = {}) =>
  renderToStaticMarkup(<FloatingField name="email" label="メールアドレス" {...props} />);

describe('FloatingField', () => {
  it('ラベルは入力の id に for で結びつき、入力は空の placeholder を持つ', () => {
    const html = render();
    expect(html).toContain('<label for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain('placeholder=" "');
    expect(html).toContain('メールアドレス</label>');
    expect(html).not.toContain('aria-invalid');
    expect(html).not.toContain('role="alert"');
  });

  it('誤りがあると 入力が aria-invalid で、誤りの文に aria-describedby で結びつく', () => {
    const html = render({ error: '形式を確認してください' });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toMatch(
      /<p id="email-error"[^>]*class="[^"]*text-danger[^"]*">形式を確認してください<\/p>/,
    );
  });

  it('announce のとき 誤りの文は role="alert" で出る', () => {
    expect(render({ error: '誤り', announce: true })).toContain('role="alert"');
  });

  it('文を持たない invalid は 枠だけを赤くし、describedBy をそのまま結ぶ', () => {
    const html = render({ invalid: true, describedBy: 'form-error' });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="form-error"');
    expect(html).not.toContain('email-error');
  });

  it('input の属性（type・name・autoComplete・defaultValue）が入力に渡る', () => {
    const html = render({ type: 'password', autoComplete: 'current-password', defaultValue: 'x' });
    expect(html).toContain('type="password"');
    expect(html).toContain('name="email"');
    expect(html).toContain('autoComplete="current-password"');
  });
});
