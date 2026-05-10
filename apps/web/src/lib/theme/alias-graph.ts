import type { Primitives, TokenRef } from './types';

export class AliasResolutionError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(message);
  }
}

export function resolveRef(ref: string, primitives: Primitives): string | null {
  const parts = ref.split('.');
  if (parts[0] !== 'primitives') return null;
  const [, group, name, step] = parts;
  if (!group || !name) return null;
  if (group === 'colors') {
    const scale = primitives.colors[name];
    if (!scale) return null;
    if (step === undefined || step === '') return scale.base;
    return scale.steps[step] ?? null;
  }
  const bag = primitives[group as keyof Primitives] as Record<string, string> | undefined;
  if (!bag) return null;
  return bag[name] ?? null;
}

export function resolveToken(
  token: TokenRef,
  primitives: Primitives,
  visiting: Set<string> = new Set(),
): string {
  if ('value' in token) return token.value;
  if (visiting.has(token.ref)) {
    throw new AliasResolutionError(token.ref, `Circular alias: ${[...visiting, token.ref].join(' → ')}`);
  }
  const resolved = resolveRef(token.ref, primitives);
  if (resolved === null) {
    throw new AliasResolutionError(token.ref, `Unknown alias: ${token.ref}`);
  }
  return resolved;
}

export function listPrimitiveRefs(primitives: Primitives): string[] {
  const refs: string[] = [];
  for (const [name, scale] of Object.entries(primitives.colors)) {
    refs.push(`primitives.colors.${name}`);
    for (const step of Object.keys(scale.steps)) {
      refs.push(`primitives.colors.${name}.${step}`);
    }
  }
  for (const group of ['spacing', 'fontSize', 'radius', 'shadow'] as const) {
    for (const k of Object.keys(primitives[group])) {
      refs.push(`primitives.${group}.${k}`);
    }
  }
  return refs;
}

export function buildUsageMap(
  semantics: Record<string, TokenRef>,
): Record<string, string[]> {
  const usage: Record<string, string[]> = {};
  for (const [semKey, ref] of Object.entries(semantics)) {
    if ('ref' in ref) {
      (usage[ref.ref] ??= []).push(semKey);
    }
  }
  return usage;
}
