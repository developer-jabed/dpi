const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],   // ✅ readonly — accepts both mutable and "as const" arrays
): Partial<T> => {
  const finalObject: Partial<T> = {};

  for (const key of keys) {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      finalObject[key] = obj[key];
    }
  }

  return finalObject;
};

export default pick;