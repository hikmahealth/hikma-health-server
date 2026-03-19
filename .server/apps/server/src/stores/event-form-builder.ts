import EventForm from "@/models/event-form";
import { arrayMove } from "@dnd-kit/sortable";
import { createStore } from "@xstate/store";
import { Either, Option } from "effect";
import type { Mutable } from "effect/Types";
import { produce } from "immer";
import { nanoid } from "nanoid";
import { v1 as uuidV1 } from "uuid";

type State = EventForm.EncodedT;

const INITIAL_FORM_BUILDER_CONTEXT: State = {
  id: uuidV1(),
  name: "",
  description: "",
  language: "en",
  is_editable: false,
  is_snapshot_form: false,
  form_fields: [],
  metadata: {},
  clinic_ids: [],
  translations: [],
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  last_modified: new Date(),
  server_created_at: new Date(),
  deleted_at: null,
};

const eventFormStore = createStore({
  context: { ...INITIAL_FORM_BUILDER_CONTEXT },
  on: {
    "set-form-name": (context, event: { payload: string }) => {
      return produce(context, (draft) => {
        draft.name = event.payload;
        draft.translations = EventForm.upsertFieldTranslation(
          draft.translations,
          EventForm.FORM_NAME_FIELD_ID,
          draft.language,
          "name",
          event.payload,
        );
      });
    },
    "set-form-description": (context, event: { payload: string }) => {
      return produce(context, (draft) => {
        draft.description = event.payload;
        draft.translations = EventForm.upsertFieldTranslation(
          draft.translations,
          EventForm.FORM_DESCRIPTION_FIELD_ID,
          draft.language,
          "name",
          event.payload,
        );
      });
    },
    "set-form-state": (context, event: { payload: State }) => {
      return produce(context, (draft) => {
        draft.id = event.payload.id;
        draft.name = event.payload.name;
        draft.description = event.payload.description;
        draft.language = event.payload.language;
        draft.is_editable = event.payload.is_editable;
        draft.is_snapshot_form = event.payload.is_snapshot_form;
        draft.form_fields = event.payload.form_fields;
        draft.metadata = event.payload.metadata;
        draft.clinic_ids = event.payload.clinic_ids ?? [];
        draft.translations = event.payload.translations ?? [];
        draft.is_deleted = event.payload.is_deleted;
        draft.created_at = event.payload.created_at;
        draft.updated_at = event.payload.updated_at;
        draft.last_modified = event.payload.last_modified;
        draft.server_created_at = event.payload.server_created_at;
        draft.deleted_at = event.payload.deleted_at;
      });
    },
    "set-form-fields": (context, event: { payload: EventForm.Field[] }) => {
      return produce(context, (draft) => {
        draft.form_fields = event.payload;
      });
    },
    "toggle-form-editable": (context) => {
      return produce(context, (draft) => {
        draft.is_editable = !draft.is_editable;
      });
    },
    "toggle-form-snapshot": (context) => {
      return produce(context, (draft) => {
        draft.is_snapshot_form = !draft.is_snapshot_form;
      });
    },
    "set-clinic-ids": (context, event: { payload: string[] }) => {
      return produce(context, (draft) => {
        draft.clinic_ids = event.payload;
      });
    },
    "set-form-language": (context, event: { payload: string }) => {
      return produce(context, (draft) => {
        draft.language = event.payload;
      });
    },
    "add-field": (context, event: { payload: EventForm.FieldData }) => {
      return produce(context, (draft) => {
        Either.match(EventForm.toSchema(event.payload), {
          onLeft: (error) => {
            console.error("Invalid field data", { error });
          },
          onRight: (field) => {
            draft.form_fields.push(field);
          },
        });
      });
    },
    "remove-field": (context, event: { payload: string }) => {
      return produce(context, (draft) => {
        draft.form_fields.splice(
          draft.form_fields.findIndex((f) => f.id === event.payload),
          1,
        );
        draft.translations = EventForm.removeFieldTranslation(
          draft.translations,
          event.payload,
        );
      });
    },
    "set-dropdown-options": (
      context,
      event: { payload: { fieldId: string; value: EventForm.FieldOption[] } },
    ) => {
      return produce(context, (draft) => {
        const { fieldId, value } = event.payload;
        draft.form_fields.find((f) => f.id === fieldId).options = value;
      });
    },
    "set-field-key-value": (
      context,
      event: { payload: { fieldId: string; key: string; value: any } },
    ) => {
      const { fieldId, key, value } = event.payload;
      return produce(context, (draft) => {
        draft.form_fields.find((f) => f.id === fieldId)[key] = value;
        if (key === "name" || key === "description") {
          draft.translations = EventForm.upsertFieldTranslation(
            draft.translations,
            fieldId,
            draft.language,
            key,
            value,
          );
        }
        // TextDisplay fields store their translatable text in "content",
        // so seed the English translation under the "name" key.
        if (key === "content") {
          draft.translations = EventForm.upsertFieldTranslation(
            draft.translations,
            fieldId,
            draft.language,
            "name",
            value,
          );
        }
      });
    },
    "add-units": (
      context,
      event: { payload: { fieldId: string; value: EventForm.DoseUnit[] } },
    ) => {
      return produce(context, (draft) => {
        const { fieldId, value } = event.payload;
        draft.form_fields.find((f) => f.id === fieldId).units = value;
      });
    },
    "remove-units": (context, event: { payload: { fieldId: string } }) => {
      return produce(context, (draft) => {
        const { fieldId } = event.payload;
        draft.form_fields.find((f) => f.id === fieldId).units = undefined;
      });
    },
    /**
     * @deprecated use reorder-two-fields method
     */
    "reorder-fields": (context, event: { payload: { indices: number[] } }) => {
      const { indices } = event.payload;
      return produce(context, (draft) => {
        draft.form_fields = indices.map((ix) => draft.form_fields[ix]);
      });
    },
    "reorder-two-fields": (
      context,
      event: { payload: { fieldIds: string[] } },
    ) => {
      const { fieldIds } = event.payload;
      return produce(context, (draft) => {
        const oldIndex = draft.form_fields.findIndex(
          (f) => f.id === fieldIds[0],
        );
        const newIndex = draft.form_fields.findIndex(
          (f) => f.id === fieldIds[1],
        );
        draft.form_fields = arrayMove(draft.form_fields, oldIndex, newIndex);
      });
    },
    "set-translation": (
      context,
      event: {
        payload: {
          fieldId: string;
          lang: string;
          key: "name" | "description";
          value: string;
        };
      },
    ) => {
      const { fieldId, lang, key, value } = event.payload;
      return produce(context, (draft) => {
        draft.translations = EventForm.upsertFieldTranslation(
          draft.translations,
          fieldId,
          lang,
          key,
          value,
        );
      });
    },
    "set-option-translation": (
      context,
      event: {
        payload: {
          fieldId: string;
          optionId: string;
          lang: string;
          value: string;
        };
      },
    ) => {
      const { fieldId, optionId, lang, value } = event.payload;
      return produce(context, (draft) => {
        draft.translations = EventForm.upsertOptionTranslation(
          draft.translations,
          fieldId,
          optionId,
          lang,
          value,
        );
      });
    },
    reset: (context) => {
      return produce(context, (draft) => {
        draft.id = uuidV1();
        draft.name = "";
        draft.description = "";
        draft.language = "en";
        draft.is_editable = false;
        draft.is_snapshot_form = false;
        draft.form_fields = [];
        draft.metadata = {};
        draft.clinic_ids = [];
        draft.translations = [];
        draft.is_deleted = false;
        draft.created_at = new Date();
        draft.updated_at = new Date();
        draft.last_modified = new Date();
        draft.server_created_at = new Date();
        draft.deleted_at = null;
      });
    },
  },
});

export default eventFormStore;
