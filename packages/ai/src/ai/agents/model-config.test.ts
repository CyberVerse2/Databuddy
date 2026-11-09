import { describe, expect, it, mock } from "bun:test";

mock.module("../tools/toolkit", () => ({ createToolkit: () => ({}) }));
mock.module("../mcp/agent-tools", () => ({ createMcpAgentTools: () => ({}) }));
const { createConfig } = await import("./analytics");
const { createMcpAgentConfig } = await import("./mcp");
const { modelNames } = await import("../config/models");

const context = {
	userId: "user-synthetic",
	chatId: "chat-synthetic",
	timezone: "UTC",
};

describe("native conversational model configuration", () => {
	it("gives dashboard and MCP the same defaults for the same model", () => {
		for (const tier of ["quick", "balanced", "deep"] as const) {
			const dashboard = createConfig(context, tier);
			const mcp = createMcpAgentConfig({
				...context,
				apiKey: null,
				requestHeaders: new Headers(),
				modelOverride: modelNames[tier],
			});
			expect(dashboard.model.modelId).toBe(mcp.model.modelId);
			expect(dashboard.providerOptions).toEqual(mcp.providerOptions);
			expect(dashboard.system.providerOptions).toEqual(
				mcp.system.providerOptions
			);
			expect(dashboard.temperature).toBe(mcp.temperature);
		}
	});
});
