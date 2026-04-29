export interface PrettyResult {
  isJson: boolean;
  text: string;
}

export function tryPrettyJson(input: string): PrettyResult {
  if (!input) return { isJson: false, text: "" };
  try {
    const parsed = JSON.parse(input);
    return { isJson: true, text: JSON.stringify(parsed, null, 2) };
  } catch {
    return { isJson: false, text: input };
  }
}
