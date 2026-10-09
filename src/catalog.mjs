import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function catalogArguments(env) {
  if (!env.PASEO_JEV_MODEL_CATALOG) return [];
  const path = resolve(env.PASEO_JEV_MODEL_CATALOG);
  let catalog;
  try { catalog = JSON.parse(await readFile(path, 'utf8')); }
  catch {
    throw new Error('Unable to load the explicit Codex model catalog');
  }
  if (!Array.isArray(catalog.models) || catalog.models.length === 0 || catalog.models.some(model => typeof model.slug !== 'string' || !model.slug)) {
    throw new Error('Codex model catalog must contain model metadata with nonempty slugs');
  }
  return ['-c', `model_catalog_json=${JSON.stringify(path)}`];
}
