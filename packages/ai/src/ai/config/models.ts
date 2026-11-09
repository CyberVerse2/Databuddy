import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createGateway, wrapLanguageModel } from "ai";

const apiKey = (process.env.AI_GATEWAY_API_KEY ?? "").trim();
const anthropicApiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();

export const isAiGatewayConfigured = apiKey.length > 0;
export const isAnthropicConfigured = anthropicApiKey.length > 0;
export const isAiConfigured = isAiGatewayConfigured || isAnthropicConfigured;

export const CLAUDE_MODEL_ID = "claude-haiku-5-5";

const gateway = createGateway({
	apiKey,
	headers: {
		"HTTP-Referer": "https://www.databuddy.cc/",
		"X-Title": "Databuddy",
	},
});

const anthropic = createAnthropic({ apiKey: anthropicApiKey });

function claudeModel(thinkingOff = false): LanguageModelV3 {
	return wrapLanguageModel({
		model: anthropic.messages(CLAUDE_MODEL_ID),
		middleware: {
			specificationVersion: "v3",
			transformParams: async ({ params }) => ({
				...params,
				temperature: undefined,
				topP: undefined,
				topK: undefined,
				providerOptions: thinkingOff
					? {
							...params.providerOptions,
							anthropic: {
								...params.providerOptions?.anthropic,
								thinking: { type: "disabled" },
							},
						}
					: params.providerOptions,
			}),
		},
	});
}

export const modelNames = {
	tiny: "openai/gpt-oss-120b",
	quick: "google/gemini-2.5-flash-lite",
	balanced: "openai/gpt-6.1-sol",
	deep: "deepseek/deepseek-v4-flash",
} as const;

export type AgentModelKey = "quick" | "balanced" | "deep";
export type AgentSource = "api" | "dashboard" | "mcp" | "slack";

export const models = isAnthropicConfigured
	? ({
			tiny: claudeModel(true),
			quick: claudeModel(),
			balanced: claudeModel(),
			deep: claudeModel(),
		} as const)
	: ({
			tiny: gateway.chat(modelNames.tiny),
			quick: gateway.chat(modelNames.quick),
			balanced: gateway.chat(modelNames.balanced),
			deep: gateway.chat(modelNames.deep),
		} as const);

export const ANTHROPIC_CACHE_1H = {
	anthropic: {
		cacheControl: { type: "ephemeral", ttl: "1h" },
	},
} as const;

export const AI_MODEL_MAX_RETRIES = 3;

export function createModelFromId(modelId: string) {
	return isAnthropicConfigured ? claudeModel() : gateway.chat(modelId);
}

export function getDefaultAgentModelId(_source?: AgentSource): string {
	return modelNames.balanced;
}
