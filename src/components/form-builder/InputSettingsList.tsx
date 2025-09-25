// @ts-nocheck
import {
  Box,
  Button,
  Checkbox,
  rem,
  Text,
  Textarea,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";
import { createStyles } from "@mantine/emotion";
import { IconGripVertical, IconTrash } from "@tabler/icons-react";
import uniq from "lodash/uniq";
import upperFirst from "lodash/upperFirst";
import React from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import CreatableSelect from "react-select/creatable";
import {
  DoseUnit,
  FieldOption,
  HHFieldWithPosition,
  MeasurementUnit,
} from "../../types/Inputs";
import { listToFieldOptions } from "../../utils/form-builder";
import If from "../If";

let YesNoOptions: FieldOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const measurementOptions: MeasurementUnit[] = uniq([
  "cm",
  "m",
  "kg",
  "lb",
  "in",
  "ft",
  "mmHg",
  "cmH2O",
  "mmH2O",
  "°C",
  "°F",
  "BPM",
  "P",
  "mmol/L",
  "mg/dL",
  "%",
  "units",
]);

const useStyles = createStyles((theme, _, u) => ({
  item: {
    display: "flex",
    alignItems: "center",
    borderRadius: theme.radius.md,

    [u.dark]: {
      border: `${rem(1)} solid ${theme.colors.dark[5]}`,
      backgroundColor: theme.colors.dark[5],
    },
    [u.light]: {
      border: `${rem(1)} solid ${theme.colors.gray[2]}`,
      backgroundColor: theme.white,
    },
    // border: `${rem(1)} solid ${
    // theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2]
    // }`,
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    paddingLeft: `calc(${theme.spacing.xl} - ${theme.spacing.md})`, // to offset drag handle
    // backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[5] : theme.white,
    marginBottom: theme.spacing.sm,
  },

  itemDragging: {
    boxShadow: theme.shadows.sm,
  },

  symbol: {
    fontSize: rem(30),
    fontWeight: 700,
    width: rem(60),
  },

  dragHandle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    [u.dark]: {
      color: theme.colors.dark[1],
    },
    [u.light]: {
      color: theme.colors.gray[6],
    },
    // color: theme.colorScheme === 'dark' ? theme.colors.dark[1] : theme.colors.gray[6],
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
  },
}));

type DndListHandleProps = {
  fields: HHFieldWithPosition[];
  onRemoveField: (ix: number) => void;
  onFieldChange: (ix: number, key: string, value: any) => void;
  onFieldOptionChange: (ix: number, options: FieldOption[]) => void;
  onFieldUnitChange: (ix: number, units: DoseUnit[] | false) => void;
  onReorder: (ixs: number[]) => void;
};

export function InputSettingsList({
  fields, // query this from the hook
  onRemoveField,
  onFieldChange,
  onFieldOptionChange,
  onFieldUnitChange,
  onReorder,
}: DndListHandleProps) {
  const { classes, cx } = useStyles();
  const { colorScheme } = useMantineColorScheme();

  const items = React.useMemo(
    () =>
      fields.map((item, index) => {
        return (
          <Draggable
            key={index}
            index={index}
            draggableId={item.id + "_" + index}
          >
            {(provided, snapshot) => {
              return (
                <div
                  className={cx(classes.item, {
                    [classes.itemDragging]: snapshot.isDragging,
                  })}
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                >
                  <div
                    {...provided.dragHandleProps}
                    className={classes.dragHandle}
                  >
                    <IconGripVertical size="1.05rem" stroke={1.5} />
                  </div>
                  <div className="w-full">
                    <h3 className="text-lg font-bold">
                      {upperFirst(item.inputType)} Input
                    </h3>
                    <TextInput
                      label={"Name"}
                      value={item.name}
                      onChange={(e) =>
                        onFieldChange(index, "name", e.currentTarget.value)
                      }
                    />
                    <TextInput
                      label="Description (Optional)"
                      value={item.description}
                      onChange={(e) =>
                        onFieldChange(
                          index,
                          "description",
                          e.currentTarget.value,
                        )
                      }
                    />
                    <Text color="dimmed" size="sm">
                      Type: {item.inputType}
                    </Text>

                    {/* IF the field type is medicine, then show the textarea for medication options the doctor can choose from. This is optional. */}
                    <If show={item.fieldType === "medicine"}>
                      <Textarea
                        rows={4}
                        value={item.options?.join("; ") || " "}
                        onChange={(e) =>
                          onFieldOptionChange(
                            index,
                            e.currentTarget.value
                              .split(";")
                              .map((opt) => opt.trim())
                              .filter((option) => option.trim() !== ""),
                          )
                        }
                        label="Medication options, separated by semicolon (;1)"
                        placeholder="Enter the options - Leave empty if not applicable"
                      />
                    </If>

                    {/* IF the field type is a select, dropdown, checkbox, or radio, then show the options input */}
                    <If
                      show={
                        ["select", "dropdown", "checkbox", "radio"].includes(
                          item.inputType,
                        ) && item.fieldType !== "diagnosis"
                      }
                    >
                      <Box py={4}>
                        <Text size="sm">Add Options</Text>
                        <CreatableSelect
                          value={item.options}
                          isMulti
                          isSearchable
                          onChange={(newValue, _) =>
                            onFieldOptionChange(index, newValue)
                          }
                          name="colors"
                          options={fieldOptionsUnion(
                            YesNoOptions,
                            item.options || [],
                          )}
                          className={
                            colorScheme === "light"
                              ? "light-select-container"
                              : "dark-select-container"
                          }
                          classNamePrefix={
                            colorScheme === "light"
                              ? "light-select"
                              : "dark-select"
                          }
                        />
                      </Box>
                    </If>

                    {item.inputType === "number" && (
                      <Checkbox
                        className="py-2"
                        onChange={(e) =>
                          onFieldUnitChange(
                            index,
                            e.currentTarget.checked
                              ? listToFieldOptions(measurementOptions)
                              : false,
                          )
                        }
                        checked={item.units && item.units.length > 0}
                        label="Has Units"
                      />
                    )}

                    {item.fieldType === "options" &&
                      item.inputType === "select" && (
                        <Checkbox
                          className="py-2"
                          onChange={(e) =>
                            onFieldChange(
                              index,
                              "multi",
                              e.currentTarget.checked,
                            )
                          }
                          checked={item.multi}
                          label="Supports multiple options"
                        />
                      )}

                    <Checkbox
                      className="py-2"
                      onChange={(e) =>
                        onFieldChange(
                          index,
                          "required",
                          e.currentTarget.checked,
                        )
                      }
                      checked={item.required}
                      label="Required Field"
                    />

                    <div className="pt-4">
                      <Button
                        onClick={() => onRemoveField(index)}
                        variant="subtle"
                        size="compact-xs"
                        color="red"
                        leftIcon={<IconTrash size="1rem" />}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </Draggable>
        );
      }),
    [fields],
  );

  return (
    <DragDropContext
      onDragEnd={({ destination, source }) => {
        if (destination === null) {
          // content was dragged to drop zone. ignore this
          // to force use to click on 'Remove'
          return;
        }
        onReorder(
          moveString(
            Object.keys(fields).map(Number),
            source.index,
            destination.index,
          ),
        );
      }}
    >
      <Droppable droppableId="dnd-list" direction="vertical">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {items}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

// Return the union of two field options arrays
function fieldOptionsUnion(
  options1: FieldOption[],
  options2: FieldOption[],
): FieldOption[] {
  const options1Map = options1.reduce(
    (acc, option) => ({ ...acc, [option.value]: option }),
    {},
  );
  const options2Map = options2.reduce(
    (acc, option) => ({ ...acc, [option.value]: option }),
    {},
  );

  return Object.values({ ...options1Map, ...options2Map });
}

function moveString(arr, sourceIndex, destIndex) {
  // Check if indices are valid
  if (
    sourceIndex < 0 ||
    sourceIndex >= arr.length ||
    destIndex < 0 ||
    destIndex > arr.length
  ) {
    throw new Error("Invalid source or destination index");
  }

  // Create a copy of the array
  const newArr = [...arr];

  // Remove the item from the source index
  const [removed] = newArr.splice(sourceIndex, 1);

  // Insert the item at the destination index
  newArr.splice(destIndex, 0, removed);

  return newArr;
}
