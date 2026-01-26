import { getPatientRegistrationForm } from "@/lib/server-functions/patient-registration-forms";
import {
  FormBuildContextProvider,
  useFormBuildContext,
  useFormBuildDispatch,
  useFormBuildOptions,
} from "@/platform/client/forms/context";
import { FormEditor } from "@/platform/client/forms/editor";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@hh/ui/components/select";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute(
  "/app/patients/customize-registration-form",
)({
  component: CustomRegistrationFormPage,
  loader: async () => ({
    patientRegistrationForm: await getPatientRegistrationForm(),
  }),
});

function LangaugePicker() {
  const [, dispatch] = useFormBuildContext();
  const { language } = useFormBuildOptions();

  const onChangeLanguage = React.useCallback(
    (lang: string) => {
      dispatch({ type: "set-form-options", payload: { language: lang } });
    },
    [dispatch],
  );

  return (
    <Select value={language} onValueChange={onChangeLanguage}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Languages</SelectLabel>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="ar">Arabic</SelectItem>
          <SelectItem value="es">Spanish</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CustomRegistrationFormPage() {
  const { patientRegistrationForm } = Route.useLoaderData();
  if (!patientRegistrationForm) {
    return <div>There's no form to show. Create one? (not implemented)</div>;
  }

  return (
    <FormBuildContextProvider
      previewOptions={{ language: "en" }}
      form={patientRegistrationForm}
    >
      <LangaugePicker />
      <FormEditor className="max-w-lg space-y-4 pt-6" />
    </FormBuildContextProvider>
  );
}
