/**
 * Saves the env variables a test changes; the returned function puts back exactly those, deleting
 * the ones that were unset (assigning `undefined` would store the string "undefined").
 */
export function saveEnv(...names: string[]): () => void {
  const saved = names.map((name) => [name, process.env[name]] as const);
  return () => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}
