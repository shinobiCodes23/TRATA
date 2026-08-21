import { PriorityIncidentInput, PriorityQueueEntry } from './types';

export class PriorityQueue {
  private queue: PriorityQueueEntry[] = [];
  private sequenceCounter = 0;

  enqueue(incident: PriorityIncidentInput): void {
    const existing = this.queue.find((entry) => entry.incidentId === incident.incidentId);
    if (existing) {
      throw new Error(`Duplicate incident ID: ${incident.incidentId}`);
    }

    this.queue.push({
      ...incident,
      arrivalSequence: this.sequenceCounter++,
    });
    this.queue.sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) {
        return b.priorityScore - a.priorityScore;
      }
      return a.arrivalSequence - b.arrivalSequence;
    });
  }

  dequeue(): PriorityQueueEntry | undefined {
    return this.queue.shift();
  }

  peek(): PriorityQueueEntry | undefined {
    return this.queue[0];
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.sequenceCounter = 0;
  }

  getAll(): PriorityQueueEntry[] {
    return [...this.queue];
  }
}
