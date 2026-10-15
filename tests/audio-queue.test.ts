import { describe, expect, it } from 'vitest';
import { LatestJobQueue } from '../src/main/audio-queue';

describe('LatestJobQueue', () => {
  it('drops chunks that arrive while an older one is still running, except the newest', async () => {
    const done: number[] = [];
    let release: (() => void) | undefined;
    const queue = new LatestJobQueue<number>(async (item) => {
      if (item === 1) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      done.push(item);
    });

    queue.push(1);
    queue.push(2);
    queue.push(3);
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(done).toEqual([1, 3]);
  });
});
