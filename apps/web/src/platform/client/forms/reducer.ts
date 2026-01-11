import { type ImmerReducer } from "use-immer";
import { FormBuild, FormBuildState } from "./types";
import { produce } from "immer";

export type FormBuildAction = { type: "add-field" } | { type: "remove-field" };

export const reducer: ImmerReducer<FormBuildState, FormBuildAction> = (
  state: FormBuildState,
  action: FormBuildAction,
) => {
  switch (action.type) {
    case "add-field": {
      //
    }
  }
};
