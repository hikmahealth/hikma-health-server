import { abcTools } from "./hh/tools.js";

async function main() {
  //

  const output = await abcTools["count_expression_from_form"].action({
    input: {
      formKey: ["b972d000-a3db-11f0-82bb-816e1f4626f7"],
      conditions: [
        ["name", "=", "Medicine Input"],
        ["value", "@>", { dose: 100 }],
      ],
    },
  });

  console.log(output);

  const output2 = await abcTools["group_count_expression_from_form"].action({
    input: {
      // formKey: "b972d000-a3db-11f0-82bb-816e1f4626f7",
      groups: [
        {
          name: "patient_gave_consent",
          filter: [
            ["name", "=", "Patient has provided consent"],
            ["value", "=", true],
          ],
        },
        // {
        //   name: "with_malaria",
        //   filter: [
        //     ["name", "=", "ICD 11 Diagnosis"],
        //     ["value", "@>", { code: "1F4Z" }],
        //   ],
        // },
        {
          name: "early_referrals",
          filter: [
            ["name", "=", "Date of referral"],
            ["value", ">=", new Date(2025, 5, 15)],
          ],
        },

        // {
        //   name: "over_eight",
        //   filter: [
        //     ["name", "=", "Weight (kg)"],
        //     ["value", ">=", 7],
        //     ["inputType", "=", "number"],
        //   ],
        // },
        // {
        //   name: "fasting_blood_sugar",
        //   filter: [
        //     ["name", "=", "Fasting Blood Sugar"],
        //     ["value", ">=", 80],
        //   ],
        // },
        // {
        //   name: "with malaria and consent",
        //   filter: [
        //     {
        //       and: [
        //         ["name", "=", "Patient has provided consent"],
        //         ["value", "=", true],
        //       ],
        //     },
        //     {
        //       and: [
        //         ["name", "=", "ICD 11 Diagnosis"],
        //         ["value", "@>", { code: "1F4Z" }],
        //       ],
        //     },
        //   ],
        // },
      ],
    },
  });

  console.log(output2);
}

main().catch((err) => {
  console.log(err);
});
