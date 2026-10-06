export function randomIntInclusive(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new Error("min and max must be integers");
  }
  if (max < min) {
    throw new Error("max must be greater than or equal to min");
  }
  if (max === min) {
    return min;
  }

  const range = max - min;
  const bitsNeeded = Math.max(1, Math.ceil(Math.log2(range + 1)));
  const mask = (2 ** bitsNeeded) - 1;

  let value = 0;
  let attempts = 0;

  do {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    value = randomArray[0] & mask;
    attempts += 1;
  } while (value > range && attempts < 1000);

  if (value > range) {
    return min + (range - (value % (range + 1))) % (range + 1);
  }

  return min + value;
}
