/**
 * Match-day saves on a bad connection: a tap that timed out may still have reached the server, and
 * tapping again would save the game, scorer or card twice. Each add gets a key that's kept until
 * the server answers OK, so trying the same thing again sends the same key and the server saves
 * it once. Once it succeeds the key is dropped, so adding a second, genuine save of the same kind
 * gets a new one.
 */
export function retryKeys<A extends Record<string, (...args: any[]) => Promise<unknown>>>(api: A, adds: (keyof A)[]): A {
  const pending = new Map<string, string>();
  const wrapped = { ...api };
  for (const name of adds) {
    const call = api[name];
    wrapped[name] = (async (...args: any[]) => {
      const intent = `${String(name)}:${JSON.stringify(args)}`;
      const clientKey = pending.get(intent) ?? newKey();
      pending.set(intent, clientKey);
      const last = args.length - 1;
      const result = await call(...args.slice(0, last), { ...args[last], clientKey });
      pending.delete(intent);
      return result;
    }) as A[keyof A];
  }
  return wrapped;
}

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
