import {
  FormBuildContextProvider,
  FormEditor,
  useFormBuildState,
  useStateSelector,
} from "@/platform/client/forms/context";
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
import { useState } from "react";

export const Route = createFileRoute(
  "/app/patients/customize-registration-form",
)({
  component: CustomRegistrationFormPage,
});

function LangaugePicker() {
  const state = useFormBuildState();
  const [lang, setLang] = useState(state.language);
  return (
    <Select value={lang} onValueChange={setLang}>
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
  return (
    <FormBuildContextProvider>
      <LangaugePicker />
      <FormEditor className="max-w-lg space-y-4 pt-6" />
    </FormBuildContextProvider>
  );
}
