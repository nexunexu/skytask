import { describe, expect, it } from "vitest";
import { answerCopilot } from "@/lib/copilot.server";
import { createResponsesCall } from "@/lib/responses.server";
import { validateLiveUpgrade } from "@/lib/live-relay.server";

describe("AI server module compatibility", () => {
  it("loads the copilot and Responses handlers with the installed SDK", () => {
    expect(typeof answerCopilot).toBe("function");
    expect(typeof createResponsesCall).toBe("function");
  });

  it("loads the voice relay and accepts a same-origin WebSocket request", () => {
    const request = new Request("https://ultra.example/api/live", {
      headers: { origin: "https://ultra.example", upgrade: "websocket" },
    });
    expect(validateLiveUpgrade(request)).toBeNull();
  });
});