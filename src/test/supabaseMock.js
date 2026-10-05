// Chainable stand-in for a supabase-js query: records every call and resolves
// to `result` when awaited, whatever the chain looks like.
export function createQueryRecorder(result) {
  const calls = [];
  const builder = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve, reject) =>
            Promise.resolve(result).then(resolve, reject);
        }

        return (...args) => {
          calls.push([property, ...args]);
          return builder;
        };
      },
    },
  );

  return { builder, calls };
}
