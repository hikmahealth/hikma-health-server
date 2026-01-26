import React, { useCallback, useMemo } from "react";
import { useImmerReducer } from "use-immer";
import { type FormBuildAction, reducer } from "./reducer";
import {
  FormBuilderOptionsInit,
  formBuilderOptionsSchema,
  FormBuildOutputForm,
  FormBuildState,
  FormField,
  schemaFormField,
} from "./types";

const FormBuildContext = React.createContext<
  [FormBuildState, React.Dispatch<FormBuildAction>] | null
>(null);

/**
 * Creates the state required to render the form for use, or on a form creator.
 * Should be a state that can be pulled from database all good
 */
export const createFormBuild = function (opts: {
  name: string;
}): FormBuildState {
  return {
    /**
     * Preview configurations
     */
    previewOptions: {
      language: "en",
    },

    form: {
      name: opts?.name,
      version: "0.1",
      fields: [
        schemaFormField.parse({
          baseField: true,
          name: "given_name",
          label: { en: "First Name" }, // { [language: string]: string }
          fieldType: "text",
          required: true,
        }),
      ],
      created_at: new Date(),
    },
  };
};

const convertOutputFormToContextState = function (
  outputform: FormBuildOutputForm,
  previewOptions: FormBuilderOptionsInit,
): FormBuildState {
  const opts = formBuilderOptionsSchema.parse(previewOptions);
  const { fields, ...others } = outputform;

  const field_map: Record<string, FormField> = {};
  const field_positions: string[] = [];

  for (let f of fields) {
    field_map[f.id] = schemaFormField.parse(f);
    field_positions.push(f.id);
  }

  return {
    previewOptions: opts,
    form: { ...others, field_map, field_positions },
  };
};

// 1. create reducer
// 2. attach to provider
// 3. use state to render the form on the "registration form section"
// 4. use state to also render the form in the register new patient
// 5. think about test suite + zero runtime error philosophy (building towards it)

export const FormBuildContextProvider = function ({
  previewOptions,
  form,
  children,
}: {
  previewOptions: FormBuilderOptionsInit;
  form: FormBuildOutputForm;
  children: React.ReactNode;
}) {
  const ctx = useImmerReducer(
    reducer,
    convertOutputFormToContextState(form, previewOptions),
  );

  return (
    <FormBuildContext.Provider value={ctx}>
      {children}
    </FormBuildContext.Provider>
  );
};

export const useFormBuildContext = function () {
  const ctx = React.useContext(FormBuildContext);
  if (!ctx) {
    throw new Error(
      "FormBuildContext is not available. Make sure to use under <FormBuildContextProvider />",
    );
  }

  return ctx;
};

export const useFormBuildFields = function () {
  const [state] = useFormBuildContext();
  return state.form.field_positions;
};

export const useFormBuildState = function () {
  const [state] = useFormBuildContext();
  const getForm = useCallback(() => {
    return state.form;
  }, [state]);

  const getFieldIds = useCallback(() => {
    return state.form.field_positions;
  }, [state]);

  return { getForm, getFieldIds };
};

export const useFormBuildOptions = function () {
  const [state] = useFormBuildContext();
  return state.previewOptions;
};

export function useFormBuildField(id: string) {
  const [state] = useFormBuildContext();
  return state.form.field_map[id];
}

export function useFormBuildFieldByIndex(index: number) {
  const [state] = useFormBuildContext();
  const id = useMemo(() => state.form.field_positions[index], [state, index]);
  return state.form.field_map[id];
}

export const useFormBuildDispatch = function () {
  const [, dispatch] = useFormBuildContext();
  return dispatch;
};
