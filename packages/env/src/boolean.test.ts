import { describe, expect, it } from "bun:test";
import { hasAiProviderKey } from "./boolean";

describe("hasAiProviderKey", () => {
	it("accepts an OpenAI key", () => {
		expect(hasAiProviderKey({ OPENAI_API_KEY: "sk-test" })).toBe(true);
	});

	it("accepts a leftover gateway key", () => {
		expect(hasAiProviderKey({ AI_GATEWAY_API_KEY: "gw-test" })).toBe(true);
	});

	it("rejects empty keys", () => {
		expect(hasAiProviderKey({ OPENAI_API_KEY: "  ", AI_GATEWAY_API_KEY: "" })).toBe(
			false
		);
	});
});
