import { createModelFromId, isAiConfigured } from "@databuddy/ai/config/models";
import { getAILogger } from "@databuddy/ai/lib/ai-logger";
import type { BusinessContext } from "@databuddy/ai/lib/business-context";
import { investigationSelectionInstructions } from "@databuddy/ai/prompts/investigation";
import type { InvestigationSignal } from "@databuddy/shared/insights";
import { PROFILE_ORIGIN_PROVENANCE } from "@databuddy/shared/organization-business-context";
import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import { INSIGHTS_MODEL_ID } from "./agent";

export function investigationSelectionSchema(keys: string[], limit: number) {
	return z.strictObject({
		selections: z
			.array(
				z.strictObject({
					signalKey: z.enum(keys),
					objective: z
						.string()
						.trim()
						.min(1)
						.max(500)
						.describe(
							"Brief sourced reason to investigate this signal and what needs checking."
						),
				})
			)
			.max(limit)
			.describe("Signals to investigate, most business-relevant first.")
			.transform((items) =>
				items.filter(
					(item, index) =>
						items.findIndex((other) => other.signalKey === item.signalKey) ===
						index
				)
			),
	});
}

interface InvestigationSelectionInput {
	businessContext: BusinessContext;
	candidates: {
		signal: InvestigationSignal;
		definition?: string;
		investigationObjective?: string;
	}[];
	limit: number;
}

export async function chooseInvestigationSignals(
	input: InvestigationSelectionInput,
	model?: LanguageModel
) {
	const { businessContext, candidates } = input;
	if (
		!(model || isAiConfigured) ||
		candidates.length <= 1 ||
		!businessContext.sources.length ||
		!["ready", "partial"].includes(businessContext.status) ||
		JSON.stringify(candidates).length > 48_000
	) {
		return null;
	}
	const keys = candidates.map((candidate) => candidate.signal.signalKey);
	// Keep whole source records. Exact, recent team explanations precede pages;
	// a separate page budget prevents an oversized homepage displacing corrections.
	const replies = businessContext.sources
		.filter((source) => source.kind === "team_reply")
		.sort(
			(a, b) =>
				Number(keys.includes(b.subjectKey ?? "")) -
					Number(keys.includes(a.subjectKey ?? "")) ||
				Date.parse(b.observedAt) - Date.parse(a.observedAt)
		);
	const ordered = [
		...businessContext.sources.filter(
			(source) => source.kind === "organization_profile"
		),
		...replies,
		...businessContext.sources.filter((source) => source.kind === "website"),
	].map(
		({ id, kind, content, observedAt, subjectKey, author, origin, url }) => ({
			id,
			kind,
			content,
			observedAt,
			subjectKey,
			author,
			provenance: origin && PROFILE_ORIGIN_PROVENANCE[origin].meaning,
			url,
		})
	);
	// Keep the complete saved document and the newest relevant correction.
	// Bibliography stays on the investigation snapshot; it is not needed to rank work.
	const characterLimit = Math.max(
		18_000,
		ordered
			.filter(
				(source) =>
					source.kind === "organization_profile" || source.id === replies[0]?.id
			)
			.reduce((total, source) => total + JSON.stringify(source).length, 0)
	);
	if (characterLimit > 32_000) {
		return null;
	}
	const sources: typeof ordered = [];
	let pageCharacters = 0;
	let characters = 0;
	for (const source of ordered) {
		const size = JSON.stringify(source).length;
		if (
			sources.some((item) => item.id === source.id) ||
			characters + size > characterLimit ||
			(source.kind === "website" && pageCharacters + size > 8000)
		) {
			continue;
		}
		sources.push(source);
		characters += size;
		if (source.kind === "website") {
			pageCharacters += size;
		}
	}
	if (!sources.length) {
		return null;
	}
	const omittedSourceCount = businessContext.sources.length - sources.length;
	const modelId = INSIGHTS_MODEL_ID;
	const result = await generateText({
		model: model ?? getAILogger().wrap(createModelFromId(modelId)),
		maxRetries: 0,
		maxOutputTokens: 1200,
		timeout: { totalMs: 15_000 },
		output: Output.object({
			schema: investigationSelectionSchema(keys, input.limit),
		}),
		system: investigationSelectionInstructions(omittedSourceCount > 0),
		prompt: JSON.stringify({
			candidates,
			limit: input.limit,
			businessContext: {
				capturedAt: businessContext.capturedAt,
				status: businessContext.status,
				sources,
				omittedSourceCount,
			},
		}),
	});
	// Keep usage accessible even when structured output validation fails.
	return {
		modelId,
		usage: result.totalUsage,
		get output() {
			return result.output;
		},
	};
}
