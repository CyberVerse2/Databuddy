export function readBooleanEnv(
	name: string,
	environment: Record<string, string | undefined> = process.env
): boolean {
	return environment[name]?.trim().toLowerCase() === "true";
}

export function hasAiProviderKey(
	environment: Record<string, string | undefined> = process.env
): boolean {
	return Boolean(
		environment.OPENAI_API_KEY?.trim() || environment.AI_GATEWAY_API_KEY?.trim()
	);
}
