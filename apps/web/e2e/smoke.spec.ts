import { expect, type Page, test } from "@playwright/test";

const LOCALES = [
  { locale: "ar", dir: "rtl", calendar: "التقويم", upcoming: "العطل القادمة" },
  { locale: "fr", dir: "ltr", calendar: "Calendrier", upcoming: "Prochains jours fériés" },
  { locale: "en", dir: "ltr", calendar: "Calendar", upcoming: "Upcoming holidays" },
] as const;

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Vercel Analytics' script only exists when deployed on Vercel.
    if (m.type() === "error" && !m.location().url.includes("/_vercel/")) errors.push(m.text());
  });
  return errors;
}

for (const { locale, dir, upcoming } of LOCALES) {
  test.describe(locale, () => {
    test("home shows the next holiday with a live countdown", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", dir);

      await expect(page.locator("#next-holiday")).toBeVisible();
      const timer = page.getByRole("timer");
      await expect(timer).toBeVisible();
      await expect(timer).not.toContainText("––"); // hydrated and ticking
      await expect(page.getByRole("heading", { name: upcoming })).toBeVisible();
      await expect(page.locator("ol > li")).toHaveCount(6);
      expect(errors).toEqual([]);
    });

    test("year calendar links holidays to their pages", async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/${locale}/2027`);
      await expect(page.locator("section[aria-labelledby^='m-']")).toHaveCount(12);

      const adha = page.locator('[data-date="2027-05-16"]');
      await expect(adha).toHaveAttribute("data-status", "estimated");
      await adha.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/2027/eid-al-adha$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText("2027");
      await expect(page.locator('a[data-status="estimated"]').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

for (const { locale, dir } of LOCALES) {
  test(`${locale} school holidays page shows both calendars`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`/${locale}/school`);
    await expect(page.locator("html")).toHaveAttribute("dir", dir);
    await expect(page.locator("#school-public")).toBeVisible();
    await expect(page.locator("#school-aefe")).toBeVisible();
    await expect(page.locator("#school-public li")).toHaveCount(7);
    await expect(page.locator("#school-aefe li")).toHaveCount(4);
    await expect(page.locator('#school-public a[href*="men.gov.ma"]')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("RTL mirrors the header in Arabic only", async ({ page }) => {
  const logoX = async (locale: string) => {
    await page.goto(`/${locale}`);
    const box = await page.locator(`header a[href$='/${locale}']`).first().boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    return (box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2;
  };
  expect(await logoX("ar")).toBeGreaterThan(0); // logo on the right
  expect(await logoX("fr")).toBeLessThan(0); // logo on the left
});

test("language switcher keeps the current page", async ({ page }) => {
  await page.goto("/fr/2027");
  await page.getByRole("button", { name: "Langue" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/2027$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("subscribe menu offers Google, Apple and copy", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: "Subscribe" }).first().click();
  const google = page.getByRole("menuitem", { name: "Google Calendar" });
  await expect(google).toHaveAttribute(
    "href",
    /calendar\.google\.com\/calendar\/render\?cid=webcal/,
  );
  await expect(page.getByRole("menuitem", { name: "Apple Calendar" })).toHaveAttribute(
    "href",
    /^webcal:\/\/.+\/api\/v1\/calendars\/all\.ics\?lang=en$/,
  );
  await expect(page.getByRole("menuitem", { name: "Copy link" })).toBeVisible();
});

test("unknown pages return 404", async ({ page }) => {
  const res = await page.goto("/fr/2027/not-a-holiday");
  expect(res?.status()).toBe(404);
});
