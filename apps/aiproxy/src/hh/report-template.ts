import { z } from "zod/v3";

const schemaLineChart = z
  .array(
    z
      .number()
      .array()
      .min(2)
      .max(2)
      .describe(
        "A tuple of numbers, containing [x, y] values to plot the chart",
      ),
  )
  .describe("Array of tuples of numbers to plot the graph");

const schemaBlock = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    value: z
      .string()
      .describe("Contains the contents for when only text should be rendered"),
  }),
  z.object({
    type: z.enum(["line", "bar"]),
    value: schemaLineChart,
  }),
  z.object({
    type: z.literal("pie"),
    value: z
      .number()
      .array()
      .describe("array of numbers to plot the pie chart"),
  }),
]);

export default {
  // blocks used in making the report
  blocks: schemaBlock.array(),
};
