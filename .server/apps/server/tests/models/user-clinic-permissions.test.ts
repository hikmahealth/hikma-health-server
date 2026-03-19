import { describe, it, expect } from "vitest";
import UserClinicPermissions from "@/models/user-clinic-permissions";

const ALL_PERMISSION_KEYS: UserClinicPermissions.UserPermissionsT[] = [
  "can_register_patients",
  "can_view_history",
  "can_edit_records",
  "can_delete_records",
  "is_clinic_admin",
  "can_edit_other_provider_event",
  "can_download_patient_reports",
  "can_prescribe_medications",
  "can_dispense_medications",
  "can_delete_patient_visits",
  "can_delete_patient_records",
];

describe("userPermissions constant", () => {
  it("should contain all expected permission string values", () => {
    expect(UserClinicPermissions.userPermissions).toEqual({
      CAN_REGISTER_PATIENTS: "can_register_patients",
      CAN_VIEW_HISTORY: "can_view_history",
      CAN_EDIT_RECORDS: "can_edit_records",
      CAN_DELETE_RECORDS: "can_delete_records",
      IS_CLINIC_ADMIN: "is_clinic_admin",
      CAN_EDIT_PROVIDER_EVENT: "can_edit_other_provider_event",
      CAN_DOWNLOAD_PATIENT_REPORTS: "can_download_patient_reports",
      CAN_PRESCRIBE_MEDICATIONS: "can_prescribe_medications",
      CAN_DISPENSE_MEDICATIONS: "can_dispense_medications",
      CAN_DELETE_PATIENT_VISITS: "can_delete_patient_visits",
      CAN_DELETE_PATIENT_RECORDS: "can_delete_patient_records",
    });
  });

  it("should have values matching ALL_PERMISSION_KEYS", () => {
    const values = Object.values(UserClinicPermissions.userPermissions);
    for (const key of ALL_PERMISSION_KEYS) {
      expect(values).toContain(key);
    }
  });
});

describe("rolePermissions", () => {
  const roles = ["super_admin", "admin", "provider", "registrar"] as const;

  it("every role should have an entry for each permission key", () => {
    for (const role of roles) {
      const perms = UserClinicPermissions.rolePermissions[role];
      for (const key of ALL_PERMISSION_KEYS) {
        expect(perms).toHaveProperty(key);
        expect(typeof perms[key]).toBe("boolean");
      }
    }
  });

  it("super_admin should have all permissions set to true", () => {
    const perms = UserClinicPermissions.rolePermissions.super_admin;
    for (const key of ALL_PERMISSION_KEYS) {
      expect(perms[key]).toBe(true);
    }
  });

  it("admin should have all permissions set to true", () => {
    const perms = UserClinicPermissions.rolePermissions.admin;
    for (const key of ALL_PERMISSION_KEYS) {
      expect(perms[key]).toBe(true);
    }
  });

  it("provider should have specific permissions", () => {
    const perms = UserClinicPermissions.rolePermissions.provider;
    expect(perms.can_register_patients).toBe(true);
    expect(perms.can_view_history).toBe(true);
    expect(perms.can_edit_records).toBe(true);
    expect(perms.can_delete_records).toBe(false);
    expect(perms.is_clinic_admin).toBe(false);
    expect(perms.can_edit_other_provider_event).toBe(false);
    expect(perms.can_download_patient_reports).toBe(true);
    expect(perms.can_prescribe_medications).toBe(true);
    expect(perms.can_dispense_medications).toBe(false);
    expect(perms.can_delete_patient_visits).toBe(false);
    expect(perms.can_delete_patient_records).toBe(false);
  });

  it("registrar should have minimal permissions", () => {
    const perms = UserClinicPermissions.rolePermissions.registrar;
    expect(perms.can_register_patients).toBe(true);
    expect(perms.can_view_history).toBe(false);
    expect(perms.can_edit_records).toBe(false);
    expect(perms.can_delete_records).toBe(false);
    expect(perms.is_clinic_admin).toBe(false);
    expect(perms.can_edit_other_provider_event).toBe(false);
    expect(perms.can_download_patient_reports).toBe(false);
    expect(perms.can_prescribe_medications).toBe(false);
    expect(perms.can_dispense_medications).toBe(false);
    expect(perms.can_delete_patient_visits).toBe(false);
    expect(perms.can_delete_patient_records).toBe(false);
  });
});

describe("getRolePermissions", () => {
  it("should return the correct permissions for a given role", () => {
    const perms = UserClinicPermissions.getRolePermissions("provider");
    expect(perms).toEqual(UserClinicPermissions.rolePermissions.provider);
  });
});
