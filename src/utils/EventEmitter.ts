type EventListener = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventListener>>;
  private maxListeners: number;

  constructor() {
    this.events = new Map();
    this.maxListeners = 10;
  }

  /**
   * Add an event listener
   */
  on(event: string, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    const listeners = this.events.get(event)!;
    listeners.add(listener);

    if (listeners.size > this.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ` +
        `${listeners.size} ${event} listeners added. Use setMaxListeners() to increase limit`
      );
    }

    return this;
  }

  /**
   * Add a one-time event listener
   */
  once(event: string, listener: EventListener): this {
    const onceWrapper: EventListener = (...args: any[]) => {
      listener(...args);
      this.removeListener(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Remove an event listener
   */
  off(event: string, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
    return this;
  }

  /**
   * Remove a listener (alias for off)
   */
  removeListener(event: string, listener: EventListener): this {
    return this.off(event, listener);
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Emit an event
   */
  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }

    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    }

    return true;
  }

  /**
   * Get all listeners for an event
   */
  listeners(event: string): EventListener[] {
    const listeners = this.events.get(event);
    return listeners ? Array.from(listeners) : [];
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * Get all event names
   */
  eventNames(): string[] {
    return Array.from(this.events.keys());
  }

  /**
   * Set maximum listeners
   */
  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  /**
   * Get maximum listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }
}
