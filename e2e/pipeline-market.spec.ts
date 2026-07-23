import { expect, type Page, test } from "@playwright/test";

const preferences = {
  locale: "en",
  theme: "light",
  selectedProfileIds: ["software-development", "hardware-supply"],
  selectedCountryCodes: ["BG", "RO"],
  includeInternationalSources: true,
  selectedInternationalSourceIds: ["eu-ted", "worldbank"]
};

const documentIntelligence = {
  status: "ready",
  eligibilityCriteria: [],
  requiredDocuments: [],
  certifications: [],
  risks: []
};

const dashboard = {
  pipeline: [
    {
      opportunity: {
        id: "bg-software-1",
        source: "cais-eop",
        sourceId: "bg-cais-eop",
        sourceDisplayName: "CAIS EOP / AOP Bulgaria",
        sourceCountryCode: "BG",
        buyerCountryCode: "BG",
        title: "Bulgarian e-services platform",
        buyerName: "Ministry of Electronic Governance",
        status: "open",
        cpvCodes: ["72200000"],
        sourceUrl: "https://example.test/bg",
        profileScores: [
          {
            profileId: "software-development",
            profileName: "Software Development",
            totalScore: 88,
            recommendation: "apply",
            components: []
          }
        ]
      },
      savedState: {
        stage: "reviewing",
        owner: "Toni",
        nextAction: "Validate requirements",
        dueDate: "2026-08-15"
      },
      documentIntelligence
    },
    {
      opportunity: {
        id: "ro-hardware-1",
        source: "ted",
        sourceId: "eu-ted",
        sourceDisplayName: "TED",
        sourceCountryCode: "RO",
        buyerCountryCode: "RO",
        title: "Romania data center refresh",
        buyerName: "Bucharest IT Agency",
        status: "open",
        cpvCodes: ["30200000"],
        sourceUrl: "https://example.test/ro",
        profileScores: [
          {
            profileId: "hardware-supply",
            profileName: "Hardware Supply",
            totalScore: 81,
            recommendation: "review",
            components: []
          }
        ]
      },
      savedState: {
        stage: "preparing",
        owner: "Toni",
        nextAction: "Price hardware bundle",
        dueDate: "2026-08-20"
      },
      documentIntelligence
    },
    {
      opportunity: {
        id: "global-cloud-1",
        source: "ted",
        sourceId: "worldbank",
        sourceDisplayName: "World Bank Procurement",
        title: "Global cloud procurement framework",
        buyerName: "International Development Program",
        status: "open",
        cpvCodes: ["72400000"],
        sourceUrl: "https://example.test/global",
        profileScores: [
          {
            profileId: "cloud-infrastructure",
            profileName: "Cloud Infrastructure",
            totalScore: 76,
            recommendation: "review",
            components: []
          }
        ]
      },
      savedState: {
        stage: "submitted",
        owner: "Toni",
        nextAction: "Wait for clarification",
        dueDate: "2026-09-01"
      },
      documentIntelligence
    }
  ],
  documents: [],
  contracts: [],
  buyers: [],
  suppliers: [],
  sources: [
    {
      source: "eu-ted",
      sourceDisplayName: "TED",
      status: "succeeded",
      startedAt: "2026-07-23T08:00:00.000Z",
      finishedAt: "2026-07-23T08:03:00.000Z",
      fetchedCount: 25,
      insertedCount: 8,
      updatedCount: 17,
      skippedCount: 0,
      failedCount: 0,
      recentErrorCount: 0
    },
    {
      source: "de-evergabe",
      sourceDisplayName: "Germany e-Vergabe / service.bund",
      sourceCountryCode: "DE",
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      recentErrorCount: 0
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test("deep linked pipeline supports market scoped work queues", async ({ page }) => {
  await page.goto("/#pipeline");

  await expect(page).toHaveURL(/#pipeline$/);
  await expect(page.getByRole("link", { name: "Pipeline" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(page.getByRole("heading", { name: "Application Pipeline" })).toBeVisible();

  await expect(page.getByText("Bulgarian e-services platform")).toBeVisible();
  await expect(page.getByText("Romania data center refresh")).toBeVisible();
  await expect(page.getByText("Global cloud procurement framework")).toHaveCount(0);

  await page.getByRole("button", { name: "Global records paused" }).click();

  await expect(page.getByText("Global cloud procurement framework")).toBeVisible();

  await page.getByLabel("Market", { exact: true }).selectOption("RO");

  await expect(page.getByText("Romania data center refresh")).toBeVisible();
  await expect(page.getByText("Bulgarian e-services platform")).toHaveCount(0);
  await expect(page.getByText("Global cloud procurement framework")).toHaveCount(0);

  await page.getByRole("link", { name: "Documents" }).click();
  await expect(page).toHaveURL(/#documents$/);
  await expect(page.getByRole("link", { name: "Documents" })).toHaveAttribute(
    "aria-current",
    "page"
  );

  await page.goBack();

  await expect(page).toHaveURL(/#pipeline$/);
  await expect(page.getByRole("link", { name: "Pipeline" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("sources explain western europe coverage", async ({ page }) => {
  await page.goto("/#profile");

  await expect(page.getByText("Western Europe markets")).toBeVisible();
  await expect(page.getByText("Germany")).toBeVisible();
  await expect(page.getByText("France")).toBeVisible();

  await page.getByRole("link", { name: "Sources" }).click();

  await expect(page).toHaveURL(/#sources$/);
  await expect(page.getByText("TED", { exact: true })).toBeVisible();
  await expect(page.getByText("Active fetcher")).toBeVisible();
  await expect(page.getByText("Germany e-Vergabe / service.bund")).toBeVisible();
  await expect(
    page.getByText("TED high-value coverage; national connector planned")
  ).toBeVisible();
});

async function mockApi(page: Page): Promise<void> {
  await page.route(/\/api\/auth\/session$/, async (route) => {
    await route.fulfill({
      json: {
        data: {
          user: {
            id: "admin-1",
            email: "admin@example.test",
            role: "admin"
          }
        }
      }
    });
  });

  await page.route(/\/api\/preferences$/, async (route) => {
    await route.fulfill({ json: { data: preferences } });
  });

  await page.route(/\/api\/profiles$/, async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: "software-development",
            name: "Software Development",
            kind: "software",
            cpvPrefixes: ["722"],
            keywords: ["software"],
            excludedKeywords: [],
            requiredCertifications: []
          },
          {
            id: "hardware-supply",
            name: "Hardware Supply",
            kind: "hardware",
            cpvPrefixes: ["302"],
            keywords: ["hardware"],
            excludedKeywords: [],
            requiredCertifications: []
          }
        ]
      }
    });
  });

  await page.route(/\/api\/opportunities\?/, async (route) => {
    await route.fulfill({ json: { data: [] } });
  });

  await page.route(/\/api\/dashboard(\?|$)/, async (route) => {
    await route.fulfill({ json: { data: dashboard } });
  });

  await page.route(/\/api\/apply-studio(\?|$)/, async (route) => {
    await route.fulfill({
      json: {
        data: {
          evidenceItems: [],
          complianceItems: []
        }
      }
    });
  });

  await page.route(/\/api\/alerts\/rules$/, async (route) => {
    await route.fulfill({ json: { data: [] } });
  });
}
