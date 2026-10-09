import { readFile } from 'node:fs/promises';

export function literalProfileKey(profile) {
  const matches = [...profile.matchAll(/^\s*(?:export\s+)?TYPESAFE_AI_KEY=(.*)$/gm)];
  if (matches.length !== 1) return undefined;
  const value = matches[0][1].trim();
  const literal = /^(?:'([^'\r\n]+)'|"([^"$`\\\r\n]+)"|([^\s$`\\'"#;]+))\s*(?:#.*)?$/.exec(value);
  return validKey(literal?.[1] ?? literal?.[2] ?? literal?.[3]);
}

function validKey(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 8192 && !/[\s\x00-\x1f\x7f]/.test(value) ? value : undefined;
}

export async function resolveKey(env, profilePath) {
  const inherited = validKey(env.TYPESAFE_AI_KEY) ?? validKey(env.TYPESAFE_API_KEY);
  if (inherited) return { key: inherited, source: 'environment' };
  try {
    const key = literalProfileKey(await readFile(profilePath, 'utf8'));
    return key ? { key, source: 'profile-literal' } : { source: 'missing' };
  } catch (error) {
    if (error.code === 'ENOENT') return { source: 'missing' };
    throw new Error('Unable to read the configured key profile', { cause: error });
  }
}
