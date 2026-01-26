import { type ImmerReducer } from "use-immer";
import {
  FormBuilderOptionsInit,
  FormBuildState,
  FormField,
  FormFieldInit,
} from "./types";

export type FormBuildAction =
  | { type: "add-field"; payload: { index?: number; value: FormFieldInit } }
  | { type: "remove-field"; payload: { index: number } }
  | {
      type: "field/set-state";
      payload: {
        id: string;
        set: Partial<FormField>;
      };
    }
  | { type: "set-form-options"; payload: Partial<FormBuilderOptionsInit> }
  | {
      type: "field/select/set-label-option";
      payload: {
        id: string;
        optionIndex: number;
        set: { [lang: string]: string };
      };
    };

export const reducer: ImmerReducer<FormBuildState, FormBuildAction> = (
  state: FormBuildState,
  action: FormBuildAction,
) => {
  switch (action.type) {
    case "add-field": {
      //
      return;
    }

    case "remove-field": {
      const ids = state.form.field_positions.splice(action.payload.index, 1);
      for (let id of ids) {
        delete state.form.field_map[id];
      }

      return state;
    }

    case "field/select/set-label-option": {
      const { id, optionIndex, set } = action.payload;
      const field = state.form.field_map[id];
      if (!field) return state;

      if (field.fieldType !== "select") {
        console.warn("invalid field type");
        break;
      }

      console.log(action.type, id, set);
      for (const [lang, value] of Object.entries(set)) {
        field.options[optionIndex][lang] = value;
      }

      break;
    }

    case "field/set-state": {
      const { id, set } = action.payload;
      for (let [key, value] of Object.entries(set)) {
        state.form.field_map[id][key] = value;
      }
      // state.form.fields[index] = set(state.form.fields[index]);

      break;
    }

    case "set-form-options": {
      for (let [key, value] of Object.entries(action.payload)) {
        state.previewOptions[key] = value;
      }
      return state;
    }
  }

  return state;
};
