import { pathToFileURL } from 'node:url';
import path from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '../lib/supabase' || specifier.endsWith('/lib/supabase')) {
    return {
      url: pathToFileURL(path.resolve(process.cwd(), 'test/mocks/supabase.mjs')).href,
      shortCircuit: true,
    };
  }
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && !path.extname(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return await nextResolve(specifier + '.js', context);
    }
  }
  return nextResolve(specifier, context);
}
