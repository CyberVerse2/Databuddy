export const AGENT_CREDITS_PER_USD = 10;
export const AGENT_CREDIT_MARKUP_PERCENT = 100;
export const AGENT_CREDIT_MARKUP = 1 + AGENT_CREDIT_MARKUP_PERCENT / 100;
export const MIN_AGENT_CREDIT_CHECK_BALANCE = 0.01;

export interface AgentModelCostUsdPerMillion {
	cache_read: number;
	cache_write: number;
	input: number;
	output: number;
	reasoning?: number;
}

export interface ResolvedAgentModelCost {
	cost: AgentModelCostUsdPerMillion;
	fallback: boolean;
	id: string;
}

export const AGENT_PRICING_BASELINE_MODEL_ID =
	"anthropic/claude-sonnet-4.6" as const;

const AGENT_PRICING_BASELINE_COST: AgentModelCostUsdPerMillion = {
	input: 3,
	output: 15,
	cache_read: 0.3,
	cache_write: 6,
};

export const AGENT_MODEL_COSTS_USD_PER_MILLION: Record<
	string,
	AgentModelCostUsdPerMillion
> = {
	[AGENT_PRICING_BASELINE_MODEL_ID]: AGENT_PRICING_BASELINE_COST,
	"claude-haiku-5-5": {
		input: 0.1,
		output: 0.5,
		cache_read: 0.01,
		cache_write: 0.2,
	},
};

export function lookupAgentModelCost(
	modelId: string,
	inputTokens = 0
): ResolvedAgentModelCost | null {
	if (modelId === "claude-haiku-5-5" && inputTokens > 100_000) {
		return {
			cost: { input: 0.5, output: 2.5, cache_read: 0.05, cache_write: 1 },
			fallback: false,
			id: modelId,
		};
	}
	const cost = AGENT_MODEL_COSTS_USD_PER_MILLION[modelId];
	return cost ? { cost, fallback: false, id: modelId } : null;
}

export function resolveAgentModelCost(modelId: string): ResolvedAgentModelCost {
	return (
		lookupAgentModelCost(modelId) ?? {
			cost: AGENT_PRICING_BASELINE_COST,
			fallback: true,
			id: AGENT_PRICING_BASELINE_MODEL_ID,
		}
	);
}

function clean(value: number): number {
	return Number.isFinite(value) && value > 0
		? Number.parseFloat(value.toPrecision(12))
		: 0;
}

export function usdToAgentCredits(usd: number): number {
	return clean(usd * AGENT_CREDIT_MARKUP * AGENT_CREDITS_PER_USD);
}

export function usdPerMillionTokensToAgentCreditsPerToken(
	usdPerMillion: number
): number {
	return usdToAgentCredits(usdPerMillion / 1_000_000);
}
