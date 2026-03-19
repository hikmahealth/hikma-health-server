// Representing state information expected of the
// form builder
import React from "react";
// import { DoseUnit, FieldOption, HHField } from '../types/Inputs';
import EventForm from "@/models/event-form";
import type { BaseFieldDescription } from "./utils";

import { produce } from "immer";

const FormBuilderContext = React.createContext<
  null | [State, React.Dispatch<Action>]
>(null);

type State = {
  // order of the field defines its render position
  fields: BaseFieldDescription[];
};

type Action =
  /** Method used to override all internal fields with new fields. usefull for syncing with server/db */
  | { type: "set-form-state"; payload: { fields: EventForm.HHField[] } }
  | { type: "add-field"; payload: EventForm.HHField }
  | { type: "remove-field"; payload: number }
  /** For a drop down, update its options that are rendered in a select */
  | {
      type: "set-dropdown-options";
      payload: { index: number; value: EventForm.FieldOption[] };
    }
  | {
      type: "set-field-key-value";
      payload: { index: number; key: string; value: any };
    }
  | {
      type: "add-units";
      payload: { index: number; value: EventForm.DoseUnit[] };
    }
  | { type: "remove-units"; payload: { index: number } }
  | { type: "reorder-fields"; payload: { indices: number[] } };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "set-form-state":
      // @ts-expect-error type mismatch
      return { fields: action.payload };
    case "add-field":
      return produce(state, (df) => {
        df.fields.push(action.payload);
        return df;
      });
    case "remove-field": {
      return produce(state, (df) => {
        df.fields.splice(action.payload, 1);
      });
    }
    case "set-field-key-value": {
      const { index, value, key } = action.payload;
      // console.log(`fire change[${index}].${key} = VALUE(${value})`);
      return produce(state, (df) => {
        // @ts-expect-error
        df.fields[index][key] = value;
        return df;
      });
    }
    case "set-dropdown-options": {
      const { index } = action.payload;
      return produce(state, (df) => {
        if (!df.fields[index]) {
          // @ts-expect-error
          df.fields[index] = {};
        }

        // @ts-expect-error
        df.fields[index].options = action.payload.value;
        return df;
      });
    }
    case "add-units": {
      const { index } = action.payload;

      return produce(state, (df) => {
        // @ts-expect-error
        df.fields[index].units = action.payload.value;
        return df;
      });
    }
    case "remove-units": {
      const { index } = action.payload;
      return produce(state, (df) => {
        // @ts-expect-error
        delete df.fields[index].units;
        return df;
      });
    }
    case "reorder-fields":
      const { indices } = action.payload;
      return produce(state, (df) => {
        df.fields = indices.map((ix) => df.fields[ix]);
        return df;
      });
    default:
      return state;
  }
};

const INITIAL_FORM_BUILDER_CONTEXT: State = { fields: [] };

export const FormBuilderContextProvider = function ({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  const ctx = React.useReducer(
    reducer,
    initialState ?? INITIAL_FORM_BUILDER_CONTEXT
  );
  return (
    <FormBuilderContext.Provider value={ctx}>
      {children}
    </FormBuilderContext.Provider>
  );
};

export const useFormBuilderContext = function () {
  const ctx = React.useContext(FormBuilderContext);
  if (ctx == null) {
    throw new Error(
      "invalid use of useFormBuilderContext. make sure <FormBuilderContextProvider> is being used"
    );
  }

  return ctx;
};
