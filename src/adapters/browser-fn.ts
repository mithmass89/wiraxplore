/**
 * Drivers treat a string argument differently: Puppeteer evaluates one string as an
 * expression, Playwright accepts either a body or a function. `"(a) => ..."` then
 * evaluates to a function object, which is truthy, so a wait resolves immediately.
 *
 * This normalises any user string into a real function before it reaches a driver:
 *   "() => x > 1"            -> that arrow function
 *   "function () { ... }"    -> that function
 *   "document.title === 'x'" -> () => document.title === 'x'
 */
export function toBrowserFunction(source: string): (...args: unknown[]) => unknown {
  const text = source.trim();
  const isFunctionLiteral = /^(async\s+)?(function\b|\([\s\S]*?\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/.test(text);
  if (isFunctionLiteral) {
    return new Function(`return (${text});`)() as (...args: unknown[]) => unknown;
  }
  return new Function(`return (${text});`) as (...args: unknown[]) => unknown;
}

/** Accepts either a function or a string; always returns something a driver can serialise. */
export function asBrowserFunction(fnOrExpression: string | ((...args: never[]) => unknown)): (...args: unknown[]) => unknown {
  if (typeof fnOrExpression === 'function') return fnOrExpression as (...args: unknown[]) => unknown;
  return toBrowserFunction(fnOrExpression);
}
