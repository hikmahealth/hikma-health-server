import { test, expect } from "./fixtures/auth";

test.describe("Authentication Flow", () => {
  test("should sign in, access dashboard, and sign out", async ({ page }) => {
    test.slow();
    // Get credentials from environment variables
    const email = process.env.VITE_ADMIN_EMAIL;
    const password = process.env.VITE_ADMIN_PASS;

    page.on("dialog", (dialog) => console.log(dialog.message()));
    page.on("dialog", (dialog) => dialog.accept());

    if (!email || !password) {
      throw new Error(
        "VITE_ADMIN_EMAIL and VITE_ADMIN_PASS environment variables must be set",
      );
    }

    // Clear cookies
    await page.context().clearCookies();

    // Navigate to the login page
    await page.goto("/");

    // Verify we're on the login page
    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toContainText(
      "Hikma Health Administrators",
    );

    // Check that the login form elements are present
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#login-button")).toBeVisible();

    // Fill in the login form
    // await page.waitForTimeout(3000);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);

    expect(page.locator("#email")).toHaveValue(email);
    expect(page.locator("#password")).toHaveValue(password);

    // Wait for the button to be enabled and click it
    const loginButton = page.locator("#login-button");
    await expect(loginButton).toBeEnabled();

    // Click and wait for either navigation or error
    await Promise.all([
      // Wait for either navigation to /app or an API response
      page
        .waitForResponse(
          (response) =>
            response.url().includes("/api/auth/sign-in") &&
            response.status() === 200,
          { timeout: 10000 },
        )
        .catch(() => console.log("Sign-in API response timeout")),
      loginButton.click(),
    ]);

    // Wait for navigation to the dashboard with explicit timeout
    await page.waitForURL("/app", { timeout: 3000 });

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // // Verify we're on the dashboard
    await expect(page).toHaveURL("/app");

    // Check for dashboard elements
    await expect(page.getByText("Clinic Users")).toBeVisible();
    await expect(page.getByText("Total Patients")).toBeVisible();
    await expect(page.getByText("Total Visits")).toBeVisible();
    await expect(page.getByText("Total Forms")).toBeVisible();

    // Verify the sign out button is visible
    await expect(page.getByTestId("sign-out-button")).toBeVisible();

    // Click the sign out button
    await page.getByTestId("sign-out-button").click({ force: true });

    // Wait for redirect back to login page
    await page.waitForURL("/", { timeout: 3000 });

    // Verify we're back on the login page
    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toContainText(
      "Hikma Health Administrators",
    );
  });

  // test("should redirect to login when not authenticated", async ({ page }) => {
  //   // Try to access the dashboard directly without authentication
  //   await page.goto("/app");

  //   // Should be redirected to login page
  //   await expect(page).toHaveURL("/");
  //   await expect(page.locator("h1")).toContainText(
  //     "Hikma Health Administrators",
  //   );
  // });

  // test("should persist authentication across page refreshes", async ({
  //   page,
  // }) => {
  //   // Get credentials from environment variables
  //   const email = process.env.VITE_ADMIN_EMAIL;
  //   const password = process.env.VITE_ADMIN_PASS;

  //   if (!email || !password) {
  //     throw new Error(
  //       "VITE_ADMIN_EMAIL and VITE_ADMIN_PASS environment variables must be set",
  //     );
  //   }

  //   // Sign in
  //   await page.goto("/");
  //   await page.fill("#email", email);
  //   await page.fill("#password", password);

  //   // Wait for button to be enabled before clicking
  //   const loginButton = page.locator("#login-button");
  //   await expect(loginButton).toBeEnabled();

  //   // Click and wait for navigation
  //   await Promise.all([
  //     page
  //       .waitForResponse(
  //         (response) =>
  //           response.url().includes("/api/auth/sign-in") &&
  //           response.status() === 200,
  //         { timeout: 10000 },
  //       )
  //       .catch(() => console.log("Sign-in API response timeout")),
  //     loginButton.click(),
  //   ]);

  //   await page.waitForURL("/app", { timeout: 10000 });
  //   await page.waitForLoadState("networkidle");

  //   // Refresh the page
  //   await page.reload();

  //   // Should still be on the dashboard
  //   await expect(page).toHaveURL("/app");
  //   await expect(page.getByText("Clinic Users")).toBeVisible();

  //   // Clean up: sign out
  //   await page.locator("#sign-out-button").click();
  //   await page.waitForURL("/");
  // });
});

// test.describe("Authenticated Dashboard Tests", () => {
//   test("should display dashboard stats", async ({ authenticatedPage }) => {
//     // The authenticatedPage fixture handles sign in/out automatically

//     // Verify all stats cards are present
//     await expect(authenticatedPage.getByText("Clinic Users")).toBeVisible();
//     await expect(authenticatedPage.getByText("Total Patients")).toBeVisible();
//     await expect(authenticatedPage.getByText("Total Visits")).toBeVisible();
//     await expect(authenticatedPage.getByText("Total Forms")).toBeVisible();

//     // Check for stats card descriptions
//     await expect(
//       authenticatedPage.getByText("Total users in your clinic's account"),
//     ).toBeVisible();
//     await expect(
//       authenticatedPage.getByText("Total patients registered to your clinic"),
//     ).toBeVisible();
//     await expect(
//       authenticatedPage.getByText("Total visits to your clinic"),
//     ).toBeVisible();
//     await expect(
//       authenticatedPage.getByText("Total forms created in your clinic"),
//     ).toBeVisible();

//     // Check for Recent Activity section
//     await expect(authenticatedPage.getByText("Recent Activity")).toBeVisible();
//   });

//   test("should have working navigation sidebar", async ({
//     authenticatedPage,
//   }) => {
//     // Verify the sidebar is visible
//     await expect(authenticatedPage.locator("#sign-out-button")).toBeVisible();

//     // The nav should be accessible
//     const signOutButton = authenticatedPage.locator("#sign-out-button");
//     await expect(signOutButton).toBeEnabled();
//   });
// });
