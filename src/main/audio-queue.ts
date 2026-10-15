/** Runs one job at a time and keeps only the newest job that arrived while busy. */
export class LatestJobQueue<T> {
  private running = false;
  private pending: T | null = null;

  constructor(private readonly work: (item: T) => Promise<void>) {}

  push(item: T): void {
    if (this.running) {
      this.pending = item;
      return;
    }
    void this.drain(item);
  }

  private async drain(item: T): Promise<void> {
    this.running = true;
    try {
      await this.work(item);
    } catch {
      // The job reports its own failure.
    } finally {
      this.running = false;
      const next = this.pending;
      this.pending = null;
      if (next !== null) void this.drain(next);
    }
  }
}
