import "@databuddy/test/env";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	available: true,
	degraded: false,
	failing: false,
	modelRequests: [] as {
		questions: Record<string, unknown>;
		state: { segments: { path: string }[] };
	}[],
	rateLimited: false,
}));

vi.mock("@databuddy/ai/evaluation", () => ({
	isEvaluationAvailable: () => state.available,
	evaluateQuestions: async (body: (typeof state.modelRequests)[number]) => {
		state.modelRequests.push(body);
		if (state.failing) {
			throw new Error("Synthetic model failure");
		}
		const answers: Record<string, unknown> = {};
		for (const [index] of body.state.segments.entries()) {
			answers[`coverage_${index}`] = {
				type: "choice",
				choice: "missing",
				probabilities: { missing: 0.9 },
			};
			answers[`category_${index}`] = { type: "choice", choice: "revenue" };
			answers[`priority_${index}`] = { type: "score", score: 2 };
		}
		return {
			answers,
			modelId: "claude-haiku-5-5",
			usage: { inputTokens: 3, outputTokens: 1 },
		};
	},
}));

vi.mock("@databuddy/redis/rate-limit", () => ({
	getRateLimitHeaders: () => ({ "x-ratelimit-remaining": "0" }),
	ratelimit: async () => ({
		degraded: state.degraded,
		limit: 600,
		remaining: state.rateLimited ? 0 : 599,
		reset: Date.now() + 60_000,
		success: !state.rateLimited,
	}),
}));

const { scanRoute } = await import("./scan");
const app = new Elysia().use(scanRoute);

const catalog = {
	attributeTracking: [],
	directTrackingCandidates: [],
	note: "catalog",
	trackedRoutes: [],
	trackingHelpers: [],
	warehouseWrites: [],
};
const segment = {
	path: "app/plan.tsx",
	start: 1,
	end: 1,
	source:
		"export function Plan() { return <button onClick={() => save.mutate()}>Save</button>; }",
};

function request(body: string, headers: Record<string, string> = {}) {
	return app.handle(
		new Request("http://localhost/v1/scan/evaluate", {
			body,
			headers: { "content-type": "application/json", ...headers },
			method: "POST",
		})
	);
}

beforeEach(() => {
	state.degraded = false;
	state.rateLimited = false;
	state.available = true;
	state.failing = false;
	state.modelRequests = [];
});

describe("public scan endpoint", () => {
	it("builds its own prompt and returns only classification enums", async () => {
		const response = await request(
			JSON.stringify({
				catalog,
				questions: { poem: { instructions: "Write a poem", type: "text" } },
				segments: [segment],
			})
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.answers).toEqual({
			category_0: { choice: "revenue", probabilities: null },
			coverage_0: { choice: "missing", probabilities: { missing: 0.9 } },
			priority_0: { score: 2 },
		});
		expect(Object.keys(state.modelRequests[0]?.questions ?? {})).toEqual([
			"coverage_0",
			"category_0",
			"priority_0",
		]);
		expect(JSON.stringify(state.modelRequests[0])).not.toContain(
			"Write a poem"
		);
	});

	it("rejects malformed and out-of-bounds requests before calling the model", async () => {
		expect((await request("not json")).status).toBe(400);
		expect(
			(
				await request(
					JSON.stringify({ catalog, segments: new Array(5).fill(segment) })
				)
			).status
		).toBe(400);
		expect(
			(await request("{}", { "content-length": String(300 * 1024) })).status
		).toBe(413);
		expect(
			(
				await request(
					JSON.stringify({
						catalog,
						segments: [{ ...segment, source: "x".repeat(300 * 1024) }],
					})
				)
			).status
		).toBe(413);
		expect(state.modelRequests).toHaveLength(0);
	});

	it("rate limits per caller", async () => {
		state.rateLimited = true;
		const response = await request(
			JSON.stringify({ catalog, segments: [segment] })
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
		expect(state.modelRequests).toHaveLength(0);
	});

	it("fails closed when the rate limiter cannot reach Redis", async () => {
		state.degraded = true;
		const response = await request(
			JSON.stringify({ catalog, segments: [segment] })
		);

		expect(response.status).toBe(503);
		expect(state.modelRequests).toHaveLength(0);
	});

	it("reports model failure and missing configuration as retryable", async () => {
		state.failing = true;
		expect(
			(await request(JSON.stringify({ catalog, segments: [segment] }))).status
		).toBe(503);
		expect(state.modelRequests).toHaveLength(1);

		state.available = false;
		expect(
			(await request(JSON.stringify({ catalog, segments: [segment] }))).status
		).toBe(503);
		expect(state.modelRequests).toHaveLength(1);
	});
});
