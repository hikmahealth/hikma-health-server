import { createServerFn } from "@tanstack/react-start";
import PatientRegistrationForm from "@/models/patient-registration-form";
import { Option } from "effect";

export const getPatientRegistrationForm = createServerFn({
  method: "GET",
}).handler(async () => {
  const forms = await PatientRegistrationForm.getAll();
  const form = forms[0];
  return form;
});
