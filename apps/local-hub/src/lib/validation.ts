// Shared input validation — pure functions, no side effects.

const MIN_PASSPHRASE_LENGTH = 8;

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Validates a new passphrase with confirmation. */
export function validateNewPassphrase(
  passphrase: string,
  confirm: string,
): ValidationResult {
  if (!passphrase) {
    return { valid: false, error: "Please enter a passphrase" };
  }
  if (passphrase !== confirm) {
    return { valid: false, error: "Passphrases do not match" };
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return {
      valid: false,
      error: `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
    };
  }
  return { valid: true };
}

/** Validates a passphrase for key rotation (current + new + confirm). */
export function validateKeyRotation(
  current: string,
  newPass: string,
  confirm: string,
): ValidationResult {
  if (!current || !newPass) {
    return { valid: false, error: "Please fill in all passphrase fields" };
  }
  if (newPass !== confirm) {
    return { valid: false, error: "New passphrases do not match" };
  }
  if (newPass.length < MIN_PASSPHRASE_LENGTH) {
    return {
      valid: false,
      error: `New passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
    };
  }
  return { valid: true };
}

/** Validates device registration fields. */
export function validateRegistration(
  serverUrl: string,
  apiKey: string,
): ValidationResult {
  if (!serverUrl.trim()) {
    return { valid: false, error: "Please enter the cloud server URL" };
  }
  if (!apiKey.trim()) {
    return { valid: false, error: "Please enter the API key" };
  }
  return { valid: true };
}
