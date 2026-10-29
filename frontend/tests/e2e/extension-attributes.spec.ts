import { expect, test } from "@playwright/test";
import { installApiMocks } from "./helpers";

// Some browser extensions (ColorZilla, Grammarly, password managers) add attributes to <body>
// before React hydrates. That must not be reported as our hydration mismatch.
test("an extension attribute on <body> doesn't cause a hydration warning", async ({ page }) => {
  await page.addInitScript(() => {
    // Mark <body> the moment the parser creates it, before any app script runs.
    new MutationObserver(() => {
      if (document.body && !document.body.hasAttribute("cz-shortcut-listen")) document.body.setAttribute("cz-shortcut-listen", "true");
    }).observe(document, { childList: true, subtree: true });
  });
  const warnings: string[] = [];
  page.on("console", message => {
    if (/hydrat|didn't match|did not match/i.test(message.text())) warnings.push(message.text());
  });
  await installApiMocks(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Stop guessing/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(warnings).toEqual([]);
});
