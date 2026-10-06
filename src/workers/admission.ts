/** Global resource admission covers overlapping submissions and preview work. */
export const PROCESSING_BUDGET_BYTES = 512 * 1024 * 1024;
type Reservation = {
  id: string;
  bytes: number;
  priority: number;
  resolve: (release: (() => void) | null) => void;
};
export class ResourceAdmission {
  private used = 0;
  private active = 0;
  private queue: Reservation[] = [];
  acquire(id: string, bytes: number, priority = 10): Promise<(() => void) | null> {
    if (bytes > PROCESSING_BUDGET_BYTES)
      return Promise.reject(
        new Error(
          'This image needs too much processing memory. Reduce its dimensions and try again.',
        ),
      );
    return new Promise((resolve) => {
      this.queue.push({ id, bytes, priority, resolve });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.drain();
    });
  }
  cancel(id: string): void {
    this.queue = this.queue.filter((entry) => {
      if (entry.id !== id) return true;
      entry.resolve(null);
      return false;
    });
    this.drain();
  }
  private drain(): void {
    while (this.queue.length && this.active < 2) {
      const next = this.queue[0]!;
      if (this.used + next.bytes > PROCESSING_BUDGET_BYTES) return;
      this.queue.shift();
      this.used += next.bytes;
      this.active++;
      let released = false;
      next.resolve(() => {
        if (released) return;
        released = true;
        this.used -= next.bytes;
        this.active--;
        this.drain();
      });
    }
  }
}
export const processingAdmission = new ResourceAdmission();
