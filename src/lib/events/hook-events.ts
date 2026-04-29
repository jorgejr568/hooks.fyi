import { EventEmitter } from "node:events";

export interface HookEvent {
  type: "request.created";
  requestId: string;
}

class HookEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  subscribe(hookId: string, listener: (event: HookEvent) => void): () => void {
    const wrapped = (e: HookEvent) => listener(e);
    this.emitter.on(this.channel(hookId), wrapped);
    return () => this.emitter.off(this.channel(hookId), wrapped);
  }

  publish(hookId: string, event: HookEvent): void {
    this.emitter.emit(this.channel(hookId), event);
  }

  private channel(hookId: string): string {
    return `hook:${hookId}`;
  }
}

const globalForEvents = globalThis as unknown as { hookEvents?: HookEventBus };
export const hookEvents: HookEventBus =
  globalForEvents.hookEvents ?? new HookEventBus();
if (process.env.NODE_ENV !== "production")
  globalForEvents.hookEvents = hookEvents;
