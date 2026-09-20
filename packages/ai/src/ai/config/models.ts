import { createOpenAI } from "@ai-sdk/openai";
import { hasAiProviderKey } from "@databuddy/env/boolean";

const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";

export function isAiConfigured(): boolean {
	return hasAiProviderKey();
}

export const modelNames = {
	tiny: "openai/gpt-oss-120b",
	quick: "google/gemini-2.5-flash-lite",
	balanced: "openai/gpt-5.6-luna",
	deep: "deepseek/deepseek-v4-flash",
} as const;

export type AgentModelKey = "quick" | "balanced" | "deep";
export type AgentSource = "dashboard" | "mcp" | "slack";

export function toOpenAiModelId(modelId: string): string {
	switch (modelId) {
		case "openai/gpt-5.6-luna":
		case "gpt-5.6-luna":
			return "gpt-5.6-luna";
		case "openai/gpt-5.6-terra":
		case "gpt-5.6-terra":
			return "gpt-5.6-terra";
		case "openai/gpt-5.6-sol":
		case "gpt-5.6-sol":
			return "gpt-5.6-sol";
		default:
			return DEFAULT_OPENAI_MODEL;
	}
}

function openaiClient() {
	return createOpenAI({
		apiKey:
			process.env.OPENAI_API_KEY?.trim() ||
			process.env.AI_GATEWAY_API_KEY?.trim() ||
			"",
	});
}

export function createModelFromId(modelId: string) {
	return openaiClient()(toOpenAiModelId(modelId));
}

export const models = {
	tiny: createModelFromId(modelNames.tiny),
	quick: createModelFromId(modelNames.quick),
	balanced: createModelFromId(modelNames.balanced),
	deep: createModelFromId(modelNames.deep),
} as const;

export const ANTHROPIC_CACHE_1H = {
	anthropic: {
		cacheControl: { type: "ephemeral", ttl: "1h" },
	},
} as const;

/** OpenAI defaults to strict tool/output schemas, which reject z.union and optional records. */
export const OPENAI_PROVIDER_OPTIONS = {
	openai: { strictJsonSchema: false },
} as const;

export function openaiProviderOptions(effort?: "low" | "medium" | "high") {
	return effort
		? {
				openai: {
					strictJsonSchema: false,
					reasoningEffort: effort,
				},
			}
		: OPENAI_PROVIDER_OPTIONS;
}

export const AI_MODEL_MAX_RETRIES = 3;

export function getDefaultAgentModelId(_source?: AgentSource): string {
	return modelNames.balanced;
}
