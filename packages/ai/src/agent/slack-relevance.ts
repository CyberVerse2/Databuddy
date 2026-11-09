import { evaluateQuestions, isEvaluationAvailable } from "../ai/evaluation";
import type { DatabuddyAgentSlackMessage } from "../ai/mcp/slack-context";
import { SLACK_REPLY_RELEVANCE_INSTRUCTIONS } from "../ai/prompts/analytics";

const DEFAULT_TIMEOUT_MS = 6000;
const MAX_THREAD_MESSAGES = 30;
const MAX_THREAD_MESSAGE_CHARS = 1000;
const REPLY_THRESHOLD = 0.5;

export interface SlackThreadReplyRelevance {
	confidence: number;
	reason: "relevant" | "irrelevant";
	shouldReply: boolean;
}

export interface SlackThreadReplyRelevanceInput {
	botUserId?: string;
	currentUserId?: string;
	text: string;
	threadMessages?: DatabuddyAgentSlackMessage[];
	timeoutMs?: number;
}

export async function classifySlackThreadReplyRelevance({
	botUserId,
	currentUserId,
	text,
	threadMessages = [],
	timeoutMs = DEFAULT_TIMEOUT_MS,
}: SlackThreadReplyRelevanceInput): Promise<SlackThreadReplyRelevance | null> {
	if (!isEvaluationAvailable()) {
		return null;
	}

	const signal = AbortSignal.timeout(timeoutMs);

	try {
		const { answers } = await evaluateQuestions({
			abortSignal: signal,
			questions: {
				reply: {
					type: "boolean",
					instructions: SLACK_REPLY_RELEVANCE_INSTRUCTIONS,
				},
			},
			state: {
				botUserId: botUserId ?? null,
				latestMessage: { userId: currentUserId ?? null, text },
				threadMessages: threadMessages
					.slice(-MAX_THREAD_MESSAGES)
					.map((message) => ({
						userId: message.userId ?? null,
						authorName: message.authorName ?? null,
						text: message.text.slice(0, MAX_THREAD_MESSAGE_CHARS),
					})),
			},
		});
		signal.throwIfAborted();
		const reply = answers.reply;
		if (reply?.type !== "boolean") {
			return null;
		}

		const probability = reply.probability;
		const shouldReply = probability >= REPLY_THRESHOLD;
		return {
			confidence: shouldReply ? probability : 1 - probability,
			reason: shouldReply ? "relevant" : "irrelevant",
			shouldReply,
		};
	} catch {
		return null;
	}
}
