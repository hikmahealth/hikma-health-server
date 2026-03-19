import { Inbox } from "lucide-react";
import { nanoid } from "nanoid";
import React from "react";

/**
 * Describing the fields the are required when
 * defining the filed
 */
export type BaseFieldDescription = {
  id: string;
  fieldType: string;
  inputType: string;
  name: string;
  description: string;
  required: boolean;
};

// As the name suggest, makes the intered types look nice
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export const withRequiredFields = <
  R extends Record<string, any> & { id?: string }
>() =>
  function <
    D extends Optional<Required<R> & Omit<BaseFieldDescription, keyof R>, "id">
  >(inp: D) {
    const base = {
      required: false,
      name: "",
      description: "",
    };

    if (!("id" in inp) || typeof inp["id"] !== "string") {
      inp["id"] = nanoid() as R["id"] & string;
    }

    return { ...base, ...inp } as Prettify<
      { id: R["id"] & string } & typeof inp
    >;
  };

export const field = withRequiredFields();

export const createComponent = function <
  FieldDescription extends ReturnType<typeof field<BaseFieldDescription>>
>(
  field: FieldDescription,
  opts: {
    label: string;
    icon?: React.ReactNode;
    render: React.FC<{ field: FieldDescription }>;
  }
) {
  if (!opts.render) {
    throw new Error("missing `opts.render` please define or remove component");
  }

  return {
    id: String(Math.random() * 10000 + 1), // NOTE: might remove this
    field,
    button: {
      label: opts.label ?? field.fieldType,
      // NOTE: might move this default definition out
      icon: opts.icon ?? <Inbox />,
    },
    render: opts.render,
  };
};
