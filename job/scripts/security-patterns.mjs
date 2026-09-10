export const CREDENTIAL_RULES = Object.freeze([
  { id: 'credential-github-classic', pattern: /(^|[^A-Za-z0-9_])ghp_[A-Za-z0-9]{30,}/m },
  { id: 'credential-github-fine-grained', pattern: /(^|[^A-Za-z0-9_])github_pat_[A-Za-z0-9_]{40,}/m },
  { id: 'credential-openai-style', pattern: /(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}/m },
  { id: 'credential-private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
]);

export function findCredentialRule(text) {
  for (const rule of CREDENTIAL_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) return rule.id;
  }
  return null;
}
