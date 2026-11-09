import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

const anthropicApiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();

export const isAiConfigured = anthropicApiKey.length > 0;

export function hasAiKey(): boolean {
	return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export const CLAUDE_MODEL_ID = "claude-haiku-5-5";

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
				tools: params.tools?.map((tool) =>
					tool.type === "function" ? { ...tool, strict: undefined } : tool
				),
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
	tiny: CLAUDE_MODEL_ID,
	quick: CLAUDE_MODEL_ID,
	balanced: CLAUDE_MODEL_ID,
	deep: CLAUDE_MODEL_ID,
} as const;

export type AgentModelKey = "quick" | "balanced" | "deep";
export type AgentSource = "api" | "dashboard" | "mcp" | "slack";

export const models = {
	tiny: claudeModel(true),
	quick: claudeModel(),
	balanced: claudeModel(),
	deep: claudeModel(),
} as const;

export const ANTHROPIC_CACHE_1H = {
	anthropic: {
		cacheControl: { type: "ephemeral", ttl: "1h" },
	},
} as const;

export const AI_MODEL_MAX_RETRIES = 3;

export function createModelFromId(_modelId?: string) {
	return claudeModel();
}

export function getDefaultAgentModelId(_source?: AgentSource): string {
	return CLAUDE_MODEL_ID;
}
