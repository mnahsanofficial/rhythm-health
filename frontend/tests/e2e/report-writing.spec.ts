import { expect, test } from "@playwright/test";
import { experiment, labReport, writtenLabReport } from "../support/fixtures";
import { API, answerOnboardingWithMouse, createAccountAndSaveProfile, installApiMocks } from "./helpers";

for (const width of [390, 768, 1440]) {
  test(`finish, see the analysis, write the report and run the next experiment at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const counts = await installApiMocks(page);
    await answerOnboardingWithMouse(page);
    await createAccountAndSaveProfile(page, counts);

    let written = false;
    let posts = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`${API}/api/experiments/${experiment.id}/report**`, async route => {
      if (route.request().method() === "POST") {
        posts += 1;
        expect(new URL(route.request().url()).searchParams.has("regenerate")).toBe(false);
        await gate;
        written = true;
        await route.fulfill({ json: writtenLabReport });
        return;
      }
      await route.fulfill({ json: written ? writtenLabReport : labReport });
    });

    await page.goto(`/experiments/${experiment.id}/report`);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    // The analysis is there straight away; the written report waits for the person.
    await expect(page.getByRole("region", { name: "Likely signal" })).toContainText("+21%");
    const write = page.getByRole("button", { name: "Write my report" });
    await write.dblclick();
    await expect(page.getByRole("button", { name: "Writing your report…" })).toBeDisabled();
    if (process.env.CAPTURE_REPORT) await page.screenshot({ path: `../docs/screenshots/lab-report-v2/${width}-writing.png`, fullPage: true });
    release();

    const learning = page.getByRole("region", { name: "What you learned about you" });
    await expect(learning.getByText(writtenLabReport.narrative!.summary)).toBeVisible();
    await expect(page.getByRole("heading", { name: "What you learned about you" })).toBeFocused();
    expect(posts).toBe(1);
    if (process.env.CAPTURE_REPORT) await page.screenshot({ path: `../docs/screenshots/lab-report-v2/${width}-written.png`, fullPage: true });

    // Reloading reads the stored narrative; it doesn't write it again.
    await page.reload();
    await expect(page.getByText(writtenLabReport.narrative!.summary)).toBeVisible();
    expect(posts).toBe(1);

    const run = page.getByRole("link", { name: "Run this experiment" });
    await run.click();
    await expect(page.getByRole("textbox", { name: "Your question or goal" })).toHaveValue(writtenLabReport.narrative!.next_experiment.question);
    expect(counts.proposals).toBe(0);
  });
}
