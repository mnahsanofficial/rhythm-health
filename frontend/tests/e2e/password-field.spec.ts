import { expect, test, type Locator } from "@playwright/test";
import { installApiMocks } from "./helpers";

const look = (field: Locator) => field.evaluate(el => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    height: Math.round(r.height), border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
    radius: s.borderTopLeftRadius, background: s.backgroundColor, paddingLeft: s.paddingLeft,
    font: `${s.fontSize} ${s.fontFamily}`, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
  };
});

for (const width of [320, 390, 1440]) {
  test(`the password field matches the email field and has an eye toggle at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApiMocks(page);
    await page.goto("/sign-in");
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const email = page.getByLabel("Email", { exact: true });
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("autocomplete", "current-password");

    expect(await look(password)).toEqual(await look(email));
    const emailLabel = await page.locator(`label[for="${await email.getAttribute("id")}"]`).evaluate(el => getComputedStyle(el).font);
    const passwordLabel = await page.locator(`label[for="${await password.getAttribute("id")}"]`).evaluate(el => getComputedStyle(el).font);
    expect(passwordLabel).toBe(emailLabel);
    const emailBox = (await email.boundingBox())!;
    const passwordBox = (await password.boundingBox())!;
    expect(passwordBox.width).toBeCloseTo(emailBox.width, 0);

    const toggle = page.getByRole("button", { name: "Show password" });
    const toggleBox = (await toggle.boundingBox())!;
    expect(toggleBox.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox.height).toBeGreaterThanOrEqual(44);
    expect(toggleBox.x).toBeGreaterThanOrEqual(passwordBox.x);
    expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(passwordBox.x + passwordBox.width + 0.5);
    expect(toggleBox.y).toBeGreaterThanOrEqual(passwordBox.y);
    expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(passwordBox.y + passwordBox.height + 0.5);
    expect(toggleBox.x + toggleBox.width / 2).toBeGreaterThan(passwordBox.x + passwordBox.width / 2);

    // Same focus ring on both fields.
    await email.focus();
    const emailFocus = await look(email);
    await password.focus();
    expect(await look(password)).toEqual(emailFocus);

    // Typing, then clicking the eye, keeps the cursor where it was.
    await password.fill("fake-test-password");
    await password.evaluate((el: HTMLInputElement) => el.setSelectionRange(4, 4));
    await toggle.click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toBeFocused();
    expect(await password.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([4, 4]);
    expect((await password.boundingBox())!).toEqual(passwordBox);

    // Keyboard: Tab reaches the eye, and Enter hides the password again.
    await page.keyboard.press("Tab");
    const hide = page.getByRole("button", { name: "Hide password" });
    await expect(hide).toBeFocused();
    await expect(hide).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();

    if (process.env.CAPTURE_PASSWORD) {
      await page.getByRole("button", { name: "Show password" }).click();
      await page.screenshot({ path: `../docs/screenshots/password-field/${width}-shown.png` });
      await page.getByRole("button", { name: "Hide password" }).click();
      await page.screenshot({ path: `../docs/screenshots/password-field/${width}-hidden.png` });
    }
  });
}
