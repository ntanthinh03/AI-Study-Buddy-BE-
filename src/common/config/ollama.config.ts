export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

export function normalizeOllamaBaseUrl(
  value: string | undefined | null,
): string {
  const resolvedValue = value?.trim() ? value : DEFAULT_OLLAMA_BASE_URL;
  return resolvedValue.replace(/\/$/, '');
}
