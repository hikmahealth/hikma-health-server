import { clsx, type ClassValue } from "clsx";
import toLower from "lodash/toLower";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
Utility function that processes the values of an object

@param {Object} obj
@oaram {(v: any) => any} func
@returns {Object}
*/
export function mapObjectValues<T>(obj: T, func: (v: any) => any): T {
  return Object.fromEntries(
    Object.entries(obj as any).map(([k, v]) => [k, func(v)])
  ) as T;
}

/**
 * Recursively converts all user-defined keys in an object to camelCase
 * @param obj The object to convert
 * @returns A new object with all user-defined keys in camelCase
 */
export const camelCaseKeys = <T extends Record<string, any>>(obj: T): T => {
  if (typeof obj !== "object" || obj === null) return obj;
  try {
    // prevent circular references
    JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.error(e);
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(camelCaseKeys) as unknown as T;
  }

  return Object.entries(obj).reduce(
    (acc: Record<string, any>, [key, value]) => {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/([-_][a-z])/gi, ($1) =>
          $1.toUpperCase().replace("-", "").replace("_", "")
        );
        acc[camelKey] = camelCaseKeys(value);
      }
      return acc;
    },
    {}
  ) as T;
};

/**
 * Deduplicates an array of options based on their `value` field.
 *
 * @param {Array<{ label: string, value: string }>} options - The array of options to deduplicate.
 * @returns {Array<{ label: string, value: string }>} The deduplicated array of options.
 */
export function deduplicateOptions(
  options: Array<{ label: string; value: string }>
): Array<{ label: string; value: string }> {
  const seenValues = new Set<string>();
  const deduplicatedOptions: Array<{ label: string; value: string }> = [];

  for (const option of options.filter((o) => o)) {
    if (!seenValues.has(option.value)) {
      seenValues.add(option.value);
      deduplicatedOptions.push(option);
    }
  }

  return deduplicatedOptions;
}

/**
 * Reorders a list of strings based on a second list that specifies the desired order.
 *
 * @param list1 The list of strings to be reordered.
 * @param list2 The list of strings specifying the desired order.
 *              Can include "_" as a placeholder to skip a position.
 *              Strings not present in `list1` are ignored.
 *
 * @returns A new array with the strings from `list1` reordered according to `list2`.
 */
export function orderedList(list1: string[], list2: string[]): string[] {
  if (!Array.isArray(list1)) {
    return [];
  }
  if (!Array.isArray(list2) && Array.isArray(list1)) {
    return list1;
  }
  const result: string[] = [];
  const remaining = list1.filter((item) => item);
  const countMap = new Map<string, number>();

  remaining.forEach((item) => {
    countMap.set(item, (countMap.get(item) || 0) + 1);
  });

  for (const item of list2) {
    if (item === "_") {
      continue; // Skip the "_" placeholder
    }
    if (countMap.has(item)) {
      result.push(item);
      const count = countMap.get(item)!;
      if (count > 1) {
        countMap.set(item, count - 1);
      } else {
        countMap.delete(item);
      }
    }
  }

  // Add any remaining items from list1 in their original order
  remaining.forEach((item) => {
    if (countMap.has(item)) {
      result.push(item);
      const count = countMap.get(item)!;
      if (count > 1) {
        countMap.set(item, count - 1);
      } else {
        countMap.delete(item);
      }
    }
  });

  return result;
}

/**
 * Safely parses a JSON string or returns the input if it's already of the expected type.
 * If parsing fails or the input doesn't match the expected type, it returns the provided default value.
 *
 * @template T The expected type of the parsed object
 * @param {unknown} input The input to parse or return
 * @param {T} defaultValue The default value to return if parsing fails or type doesn't match
 * @returns {T} The parsed object, the input if it's already of type T, or the default value
 */
export function safeJSONParse<T>(input: unknown, defaultValue: T): T {
  if (input === undefined || input === null) {
    return defaultValue;
  }
  if (
    typeof input === typeof defaultValue &&
    (Array.isArray(input) ? Array.isArray(defaultValue) : true)
  ) {
    return input as T;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return typeof parsed === typeof defaultValue ? parsed : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }

  return defaultValue;
}

/**
 * Safely stringifies an object or returns the input if it's already a string.
 * If input is a string that appears to be JSON, it will be parsed and re-stringified.
 *
 * @param {unknown} input - The input to stringify or return
 * @param {string} defaultValue - The default value to return if stringification fails
 * @returns {string} The stringified object or the default value
 */
export function safeStringify(input: unknown, defaultValue: string): string {
  if (input === undefined || input === null) {
    return defaultValue;
  }

  if (typeof input === "string") {
    try {
      // Check if the string is valid JSON by attempting to parse it
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed);
    } catch (error) {
      // If it's not valid JSON, return the original string
      return input;
    }
  }

  try {
    return JSON.stringify(input);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Attempts to parse a date from various input types.
 *
 * @param {unknown} input - The input to parse as a date. Can be a Date object, string, or number.
 * @param {Date} [defaultDate] - An optional default date to return if parsing fails.
 * @returns {Date} The parsed date or the default date.
 * @throws {Error} If parsing fails and no valid default date is provided.
 */
export const tryParseDate = (input: unknown, defaultDate?: Date): Date => {
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }

  if (typeof input === "string" || typeof input === "number") {
    const parsedDate = new Date(input);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  if (defaultDate instanceof Date && !isNaN(defaultDate.getTime())) {
    return defaultDate;
  }

  throw new Error("Invalid date input and no valid default date provided");
};

/**
 * Returns a truncated object containing the top N key-value pairs sorted by value,
 * with an "other" key summing the remaining values.
 *
 * @param {Record<string, number>} obj - The input object to be truncated.
 * @param {number} topN - The number of top entries to keep.
 * @returns {Record<string, number>} A new object with the top N entries and an "other" key.
 */
export function getTopNWithOther(
  obj: Record<string, number>,
  topN: number
): Record<string, number> {
  const sortedEntries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const topEntries = sortedEntries.slice(0, topN);
  const otherSum = sortedEntries
    .slice(topN)
    .reduce((sum, [, value]) => sum + value, 0);

  const result: Record<string, number> = Object.fromEntries(topEntries);
  if (otherSum > 0) {
    result.other = otherSum;
  }

  return result;
}

/**
 * Converts a list of strings to an array of field options with label and value properties.
 * The label is the original string and value is the lowercase version of the string.
 *
 * @param {string[]} list - The array of strings to convert to field options
 * @returns {Array<{label: string, value: string}>} An array of field option objects
 */
export function listToFieldOptions(
  list: string[]
): { label: string; value: string }[] {
  return list.map((item) => ({
    label: item,
    value: toLower(item),
  }));
}

// Return the union of two field options arrays
export function fieldOptionsUnion(
  options1: { label: string; value: string }[],
  options2: { label: string; value: string }[]
): { label: string; value: string }[] {
  const options1Map = options1.reduce(
    (acc, option) => ({ ...acc, [option.value]: option }),
    {}
  );
  const options2Map = options2.reduce(
    (acc, option) => ({ ...acc, [option.value]: option }),
    {}
  );

  return Object.values({ ...options1Map, ...options2Map });
}

// getFieldOptionsValues
export function getFieldOptionsValues(
  options: { label: string; value: string }[]
): string[] {
  return options.map((option) => option.value);
}

/**
 * Checks if a string is a valid UUID. Checks for uuid v1 and v4
 * @param {string} str - The string to check
 * @returns {boolean} True if the string is a valid UUID, false otherwise
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str
  );
}
