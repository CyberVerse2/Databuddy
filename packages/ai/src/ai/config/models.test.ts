import { lookupAgentModelCost } from "@databuddy/shared/agent-credits";
import { describe, expect, it } from "bun:test";
import {
	modelNames,
	openaiProviderOptions,
	toOpenAiModelId,
} from "./models";

describe("agent model defaults", () => {
	it("has prices for every configured model", () => {
		for (const modelId of Object.values(modelNames)) {
			expect(lookupAgentModelCost(modelId), modelId).not.toBeNull();
		}
	});

	it("sends OpenAI gpt-5.6-luna by default", () => {
		expect(modelNames.balanced).toBe("openai/gpt-5.6-luna");
		expect(toOpenAiModelId(modelNames.balanced)).toBe("gpt-5.6-luna");
		expect(toOpenAiModelId(modelNames.quick)).toBe("gpt-5.6-luna");
		expect(toOpenAiModelId("openai/gpt-5.6-terra")).toBe("gpt-5.6-terra");
	});

	it("disables OpenAI strict JSON schemas so unions and optional records stay valid", () => {
		expect(openaiProviderOptions()).toEqual({
			openai: { strictJsonSchema: false },
		});
		expect(openaiProviderOptions("high")).toEqual({
			openai: { strictJsonSchema: false, reasoningEffort: "high" },
		});
	});
});
