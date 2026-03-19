import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Heart,
  Activity,
  Thermometer,
  Droplets,
  Wind,
  Brain,
  Ruler,
  Weight,
} from "lucide-react";
import { format } from "date-fns";
import type PatientVital from "@/models/patient-vital";

type VitalEncoded = typeof PatientVital.PatientVitalSchema.Encoded;

type Props = {
  vital: VitalEncoded | null;
};

/** Format a vital value for display. Returns "—" when nil. */
export const formatVital = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "—" : String(value);

type VitalDef = {
  key: string;
  label: string;
  unit: string;
  icon: React.ElementType;
  iconColor: string;
  getValue: (v: VitalEncoded) => string;
};

const vitalDefs: VitalDef[] = [
  {
    key: "bp",
    label: "Blood Pressure",
    unit: "mmHg",
    icon: Heart,
    iconColor: "text-red-500",
    getValue: (v) =>
      v.systolic_bp && v.diastolic_bp
        ? `${v.systolic_bp}/${v.diastolic_bp}`
        : "—",
  },
  {
    key: "hr",
    label: "Heart Rate",
    unit: "bpm",
    icon: Activity,
    iconColor: "text-pink-500",
    getValue: (v) => formatVital(v.heart_rate),
  },
  {
    key: "temp",
    label: "Temperature",
    unit: "\u00B0C",
    icon: Thermometer,
    iconColor: "text-orange-500",
    getValue: (v) => formatVital(v.temperature_celsius),
  },
  {
    key: "o2",
    label: "O\u2082 Saturation",
    unit: "%",
    icon: Droplets,
    iconColor: "text-blue-500",
    getValue: (v) => formatVital(v.oxygen_saturation),
  },
  {
    key: "rr",
    label: "Respiratory Rate",
    unit: "breaths/min",
    icon: Wind,
    iconColor: "text-teal-500",
    getValue: (v) => formatVital(v.respiratory_rate),
  },
  {
    key: "weight",
    label: "Weight",
    unit: "kg",
    icon: Weight,
    iconColor: "text-purple-500",
    getValue: (v) => formatVital(v.weight_kg),
  },
  {
    key: "height",
    label: "Height",
    unit: "cm",
    icon: Ruler,
    iconColor: "text-green-500",
    getValue: (v) => formatVital(v.height_cm),
  },
  {
    key: "bmi",
    label: "BMI",
    unit: "kg/m\u00B2",
    icon: Brain,
    iconColor: "text-indigo-500",
    getValue: (v) =>
      v.bmi ? parseFloat(v.bmi as string).toFixed(1) : "—",
  },
];

function VitalTile({ def, vital }: { def: VitalDef; vital: VitalEncoded }) {
  const Icon = def.icon;
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center mb-2">
        <Icon className={`h-4 w-4 ${def.iconColor} mr-2`} />
        <span className="text-sm font-medium">{def.label}</span>
      </div>
      <p className="text-2xl font-bold">{def.getValue(vital)}</p>
      <p className="text-xs text-muted-foreground">{def.unit}</p>
    </div>
  );
}

export function PatientVitalsCard({ vital }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Current Vitals</CardTitle>
          {vital && (
            <span className="text-sm text-muted-foreground">
              Last recorded:{" "}
              {format(new Date(vital.timestamp), "MMM dd, yyyy HH:mm")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {vital ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {vitalDefs.map((def) => (
              <VitalTile key={def.key} def={def} vital={vital} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No vitals recorded yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
