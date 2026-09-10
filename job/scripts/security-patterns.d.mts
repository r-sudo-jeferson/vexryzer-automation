export interface CredentialRule {
  readonly id: 'credential-github-classic' | 'credential-github-fine-grained' | 'credential-openai-style' | 'credential-private-key';
  readonly pattern: RegExp;
}

export const CREDENTIAL_RULES: readonly CredentialRule[];
export function findCredentialRule(text: string): CredentialRule['id'] | null;
