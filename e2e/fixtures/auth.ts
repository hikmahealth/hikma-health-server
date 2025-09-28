import { test as base, expect, type Page } from "@playwright/test";

// Define the fixtures type
type AuthFixtures = {
  authenticatedPage: Page;
};

// Extend the base test with our authentication fixture
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Get credentials from environment variables
    const email = process.env.VITE_ADMIN_EMAIL;
    const password = process.env.VITE_ADMIN_PASS;

    if (!email || !password) {
      throw new Error(
        "VITE_ADMIN_EMAIL and VITE_ADMIN_PASS environment variables must be set",
      );
    }

    // Clear cookies
    await page.context().clearCookies();

    // Navigate to the login page
    await page.goto("/");

    // Wait for the login form to be visible
    await expect(page.locator("#email")).toBeVisible();

    // Fill in the login form
    await page.fill("#email", email);
    await page.fill("#password", password);

    // Wait for the button to be enabled
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
    await page.waitForURL("/app", { timeout: 10000 });

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Verify we're logged in by checking for the dashboard content
    await expect(page).toHaveURL("/app");

    // Use the authenticated page in the test
    await use(page);

    // After the test, sign out
    try {
      // Click the sign out button in the nav
      await page.locator("#sign-out-button").click();

      // Wait for redirect back to login page
      await page.waitForURL("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
      // Even if sign out fails, we continue to not block other tests
    }
  },
});

// Re-export expect for convenience
export { expect } from "@playwright/test";
