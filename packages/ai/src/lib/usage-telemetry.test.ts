import { describe, expect, test } from "bun:test";
import type { LanguageModelUsage } from "ai";
import { summarizeAgentUsage } from "./usage-telemetry";

const emptyUsage: LanguageModelUsage = {
	inputTokens: undefined,
	outputTokens: undefined,
	totalTokens: undefined,
	inputTokenDetails: {
		noCacheTokens: undefined,
		cacheReadTokens: undefined,
		cacheWriteTokens: undefined,
	},
	outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
};

describe("summarizeAgentUsage", () => {
	test.each([
		{ missing: false },
		{ missing: true },
	])("counts steps: $missing", ({ missing }) => {
		const summary = summarizeAgentUsage("claude-haiku-5-5", {
			...emptyUsage,
			inputTokens: missing ? undefined : 200_000,
			inputTokenDetails: {
				...emptyUsage.inputTokenDetails,
				noCacheTokens: missing ? undefined : 100_000,
			},
			stepUsages: [
				{
					...emptyUsage,
					inputTokens: 100_000,
					inputTokenDetails: {
						...emptyUsage.inputTokenDetails,
						noCacheTokens: 100_000,
					},
				},
				{ ...emptyUsage, inputTokens: 100_000, outputTokens: 1000 },
			],
		});
		expect(summary.input_tokens).toBe(200_000);
		expect(summary.fresh_input_tokens).toBe(200_000);
		expect(summary.output_tokens).toBe(1000);
		expect(summary.total_tokens).toBe(201_000);
		expect(summary.cost_total_usd).toBeCloseTo(0.0205, 9);
		expect(summary.agent_steps).toBe(2);
	});
	test("preserves explicitly zero fresh input", () => {
		const summary = summarizeAgentUsage("claude-haiku-5-5", {
			...emptyUsage,
			inputTokens: 1000,
			inputTokenDetails: { ...emptyUsage.inputTokenDetails, noCacheTokens: 0 },
		});
		expect(summary.fresh_input_tokens).toBe(0);
		expect(summary.cost_total_usd).toBe(0);
	});
	test.each([
		{ model: "xai/grok-3-mini", output: 0.0003, reasoning: 0.0002 },
		{ model: "claude-haiku-5-5", output: 0.0005, reasoning: 0 },
		{ model: "unknown/model", output: 0.015, reasoning: 0 },
	])("charges reasoning once: $model", ({ model, output, reasoning }) => {
		const summary = summarizeAgentUsage(model, {
			...emptyUsage,
			outputTokens: 1000,
			outputTokenDetails: { textTokens: 600, reasoningTokens: 400 },
		});
		expect(summary.cost_output_usd).toBe(output);
		expect(summary.cost_reasoning_usd).toBe(reasoning);
		expect(summary.cost_total_usd).toBeCloseTo(output + reasoning, 9);
		expect(summary.agent_credits_used).toBeCloseTo(
			(output + reasoning) * 20,
			9
		);
		expect(summary.cost_fallback).toBe(model === "unknown/model");
	});
	test("bills cache-write tokens at the Sonnet 1-hour cache-write rate", () => {
		const summary = summarizeAgentUsage("anthropic/claude-sonnet-4.6", {
			...emptyUsage,
			inputTokens: 1_000_000,
			outputTokens: 0,
			inputTokenDetails: {
				...emptyUsage.inputTokenDetails,
				cacheWriteTokens: 1_000_000,
			},
		});

		expect(summary.fresh_input_tokens).toBe(0);
		expect(summary.cost_input_usd).toBe(0);
		expect(summary.cost_cache_write_usd).toBe(6);
		expect(summary.cost_total_usd).toBe(6);
		expect(summary.agent_credits_used).toBe(120);
	});
});
