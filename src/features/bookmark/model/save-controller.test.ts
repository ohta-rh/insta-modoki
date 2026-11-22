import { describe, expect, it } from 'vitest';
import { createSaveController, type SaveSendResult, type SaveSnapshot } from './save-controller';

const NOT_FOUND: SaveSendResult = {
  ok: false,
  code: 'NOT_FOUND',
  message: 'ページが見つかりません',
};

function setup(send: (saved: boolean) => Promise<SaveSendResult>, saved = false) {
  const seen: SaveSnapshot[] = [];
  const controller = createSaveController({
    initial: { saved },
    send,
    onChange: (s) => seen.push(s),
  });
  return { controller, seen };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createSaveController', () => {
  it('押した瞬間に状態が変わり、成功すると確かめた状態になる', async () => {
    const sent: boolean[] = [];
    const { controller, seen } = setup(async (s) => {
      sent.push(s);
      return { ok: true, saved: s };
    });
    controller.press();
    expect(controller.snapshot().saved).toBe(true);
    expect(controller.snapshot().touched).toBe(1);
    await tick();
    expect(sent).toEqual([true]);
    expect(seen.at(-1)).toMatchObject({ saved: true, error: null, needsLogin: false });
  });

  it('失敗したら最後に確かめた状態に戻す', async () => {
    const { controller } = setup(async () => NOT_FOUND);
    controller.press();
    expect(controller.snapshot().saved).toBe(true);
    await tick();
    expect(controller.snapshot().saved).toBe(false);
    expect(controller.snapshot().error).toBe('ページが見つかりません');
    expect(controller.snapshot().needsLogin).toBe(false);
  });

  it('UNAUTHENTICATED の失敗は needsLogin になる', async () => {
    const { controller } = setup(async () => ({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'ログインしてください',
    }));
    controller.press();
    await tick();
    expect(controller.snapshot()).toMatchObject({ saved: false, needsLogin: true });
  });

  it('送って例外になったときは固定の文言で戻す', async () => {
    const { controller } = setup(async () => {
      throw new Error('network');
    });
    controller.press();
    await tick();
    expect(controller.snapshot()).toMatchObject({
      saved: false,
      error: 'エラーが発生しました。しばらくしてからもう一度お試しください',
    });
  });

  it('送信中に押しても要求は 1 つで、終わった後に望む状態と違うときだけ送り直す', async () => {
    const sent: boolean[] = [];
    const releases: (() => void)[] = [];
    const { controller } = setup(
      (s) =>
        new Promise((resolve) => {
          sent.push(s);
          releases.push(() => resolve({ ok: true, saved: s }));
        }),
    );
    controller.press(); // want true, request 1 (true)
    controller.press(); // want false
    controller.press(); // want true again
    controller.press(); // want false
    expect(sent).toEqual([true]);
    releases[0]!();
    await tick();
    // The server says true, but false is wanted: one more request.
    expect(sent).toEqual([true, false]);
    releases[1]!();
    await tick();
    expect(sent).toEqual([true, false]);
    expect(controller.snapshot().saved).toBe(false);

    // Pressed twice more while sending: the wanted state equals the answer, nothing is re-sent.
    controller.press();
    controller.press();
    controller.press();
    expect(sent).toEqual([true, false, true]);
    releases[2]!();
    await tick();
    expect(sent).toEqual([true, false, true]);
    expect(controller.snapshot().saved).toBe(true);
  });
});
