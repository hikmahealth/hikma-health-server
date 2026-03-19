import { test, expect } from "./fixtures/auth";

test.describe("Patient Registration", () => {
  test("should register a new patient and display in patients list", async ({
    authenticatedPage: page,
  }) => {
    // Step 1: Sign in is handled by the auth fixture

    // Step 2: Use the side nav to go to "Register New Patient"
    // First click on "Patients" in the sidebar to expand it
    // await page.click('text="Patients"'); // when this runs, it collapses an already expanded menu item

    // Wait for the submenu to be visible and click on "Register New Patient"
    await page.waitForSelector('text="Register New Patient"', {
      state: "visible",
    });
    await page.click('text="Register New Patient"');

    // Verify we're on the register page
    await page.waitForURL("/app/patients/register");
    await expect(page).toHaveURL("/app/patients/register");

    // Step 3: Fill in the patient form dynamically
    // Generate test data
    const testPatientData = {
      firstName: `TestPatient${Date.now()}`,
      lastName: `LastName${Date.now()}`,
      phone: "1234567890",
      dateOfBirth: "1990-01-15",
    };

    // Wait for the form to load
    await page.waitForSelector('[data-testid*="register-patient-"]');

    // Get all form fields and fill them based on their type
    const formFields = await page
      .locator('[data-testid*="register-patient-"]')
      .all();

    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i];
      const inputType = await field.getAttribute("data-inputtype");
      const column = await field.getAttribute("data-column");

      switch (inputType) {
        case "text":
          // Handle text inputs based on common field names
          if (
            column?.includes("given_name") ||
            column?.includes("first_name")
          ) {
            await field.fill(testPatientData.firstName);
          } else if (
            column?.includes("surname") ||
            column?.includes("last_name")
          ) {
            await field.fill(testPatientData.lastName);
          } else if (column?.includes("phone")) {
            await field.fill(testPatientData.phone);
          } else if (column?.includes("hometown") || column?.includes("city")) {
            await field.fill("Test City");
          } else if (column?.includes("citizenship")) {
            await field.fill("Test Country");
          } else {
            // Fill with generic test data for other text fields
            await field.fill("Test Value");
          }
          break;

        case "number":
          // Fill numeric fields with test data
          await field.fill("25");
          break;

        case "select":
          // For select fields, we need to handle the custom Select component
          await field.click();
          // Wait for dropdown options to appear and select the first available option
          const options = page.locator(
            '[data-testid]:not([data-testid*="register-patient-"])',
          );
          const firstOption = options.first();
          if (await firstOption.isVisible()) {
            await firstOption.click();
          }
          break;

        case "date":
          // Handle date picker - fill with a test date
          await field.fill(testPatientData.dateOfBirth);
          break;
      }

      // Small delay between fields to ensure proper form handling
      await page.waitForTimeout(100);
    }

    // Step 4: Submit the form
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();

    // Handle the alert that appears after successful submission
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("Patient registered successfully!");
      await dialog.accept();
    });

    await submitButton.click();

    // Wait for the alert and form submission
    await page.waitForTimeout(2000);

    // Step 5: Navigate back to patients list (this might be automatic or manual)
    // If not automatically redirected, navigate manually
    try {
      await page.waitForURL("/app/patients", { timeout: 5000 });
    } catch {
      // If not redirected automatically, navigate manually
      await page.click('text="Patients List"');
      await page.waitForURL("/app/patients");
    }

    // Step 6: Verify the new patient appears in the list
    await expect(page).toHaveURL("/app/patients");

    // Wait for the patients table to load
    await page.waitForSelector("table");

    // Look for the patient's name in the table
    // Since the form fields are dynamic, we'll search for any of our test data
    const tableContent = page.locator("table");

    // Check if our test patient data appears in the table
    await expect(tableContent).toContainText(testPatientData.firstName, {
      timeout: 10000,
    });

    // Alternative approach: check if any row contains our patient data
    const patientRow = page.locator("tr", {
      has: page.locator("text=" + testPatientData.firstName),
    });
    await expect(patientRow).toBeVisible();

    console.log(
      `✓ Successfully registered and found patient: ${testPatientData.firstName} ${testPatientData.lastName}`,
    );
  });

  test("should handle form validation errors gracefully", async ({
    authenticatedPage: page,
  }) => {
    // Navigate to register page
    // await page.click('text="Patients"'); // closes an aleady open menu item
    await page.waitForSelector('text="Register New Patient"', {
      state: "visible",
    });
    await page.click('text="Register New Patient"');
    await page.waitForURL("/app/patients/register");

    // Try to submit without filling required fields
    const submitButton = page.locator('[data-testid="submit-button"]');
    await expect(submitButton).toBeVisible();

    // This should trigger validation or show an error
    await submitButton.click();

    // The form should prevent submission or show validation errors
    // We check that we're still on the registration page
    await expect(page).toHaveURL("/app/patients/register");
  });
});
