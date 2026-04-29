import { describe, it, expect } from "vitest";
import { hookEvents } from "@/lib/events/hook-events";

describe("hookEvents", () => {
  it("delivers a published event to subscribers for the same hook", async () => {
    const hookId = "hook-1";
    const received: unknown[] = [];
    const unsubscribe = hookEvents.subscribe(hookId, (e) => received.push(e));

    hookEvents.publish(hookId, { type: "request.created", requestId: "r1" });
    hookEvents.publish("other", { type: "request.created", requestId: "rX" });

    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([{ type: "request.created", requestId: "r1" }]);
    unsubscribe();
  });

  it("stops delivering after unsubscribe", async () => {
    const received: unknown[] = [];
    const unsubscribe = hookEvents.subscribe("h2", (e) => received.push(e));
    unsubscribe();
    hookEvents.publish("h2", { type: "request.created", requestId: "x" });
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toEqual([]);
  });
});
