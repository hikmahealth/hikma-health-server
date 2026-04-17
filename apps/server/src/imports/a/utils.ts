import { parse } from "csv-parse";
import z from "zod";

const specialRowSchema = z.object({
  mtd: z.string().transform(Number),
  sno: z.string().transform(Number),
  name: z.string(),
  gender: z
    .string()
    .toLowerCase()
    .pipe(z.enum(["male", "female"])),
  age: z.string().transform((v) => {
    const monthMatch = v.match(/^(\d+)\s*m$/i);
    if (monthMatch) {
      return parseInt(monthMatch[1]) * 30;
    }

    const years = Number(v);
    return years * 365;
  }),

  contact: z.string().optional(),
  old_new: z
    .string()
    .toLowerCase()
    .pipe(z.enum(["old", "new"])),
  height: z.string().transform(Number).optional(), // in cm
  weight: z.string().transform(Number).optional(), // in kg
  doctor: z.string().optional(),
  area: z.string(),
  venue: z.string(),
  date: z
    .string()
    .transform(function (v) {
      if (!v) {
        // no date
        return null;
      }

      const values = v.split("/");
      if (values.length !== 3) {
        throw new Error("invalid date");
      }

      return new Date(`${values[2]}/${values[1]}/${values[0]}`);
    })
    .optional()
    .nullable(),
  diagnosis: z.string(),
  medicines: z.string().transform((v) => v.split(",")),
  counseling: z.string().optional(),
  refer: z.string().optional(),
  remarks: z.string().optional(),
});

export type SpecialEntry = z.output<typeof specialRowSchema>;

export async function readEntriesFromRequest(request: Request) {
  const form = await request.formData();
  const file = form.get("file") as File;
  const csvText = await file.text();

  // process the csv file into object
  const records = await new Promise<Array<SpecialEntry>>((resolve, reject) => {
    const rx: SpecialEntry[] = [];

    const parser = parse({
      columns: (v) => v.map((c) => c.toLowerCase()),
      skip_empty_lines: true,
    });

    parser.on("readable", function () {
      let record;
      while ((record = parser.read()) !== null) {
        if (!record["name"]) {
          // skip if name is missing
          continue;
        }

        console.log(record);
        rx.push(
          specialRowSchema.parse({
            ...record,
            old_new: record["old/new"],
            sno: record["s.no"],
          }),
        );
      }
    });

    parser.on("close", () => {
      console.log("close");
    });

    parser.on("finish", () => {
      console.log("finish");
      resolve(rx);
    });

    parser.on("end", () => {
      console.log("end");
      resolve(rx);
    });

    parser.on("error", reject);
    parser.write(csvText);
    parser.end();
  });

  return records;
}
