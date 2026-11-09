import type { SystemModelMessage } from "ai";
import type { AgentConfig, AgentThinking } from "../agents/types";
import { ANTHROPIC_CACHE_1H } from "./models";

export function conversationModelOptions(
	_modelId: string,
	thinking?: AgentThinking
): Pick<AgentConfig, "temperature" | "providerOptions"> & {
	systemProviderOptions?: SystemModelMessage["providerOptions"];
} {
	const effort = thinking && thinking !== "off" ? thinking : undefined;
	return {
		systemProviderOptions: ANTHROPIC_CACHE_1H,
		providerOptions: effort ? { anthropic: { effort } } : undefined,
	};
}
