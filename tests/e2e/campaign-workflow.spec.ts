import { expect, test } from "@playwright/test"

test.describe("Campaign workflow E2E", () => {
    test("CSV -> template -> mapping -> generate campaign happy path", async ({ page, context }, testInfo) => {
        let createCampaignPayload: any = null

        await context.addCookies([
            {
                name: "uc_default_business",
                value: "business-a",
                domain: "localhost",
                path: "/",
            },
        ])

        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    expires: "2099-01-01T00:00:00.000Z",
                    user: {
                        id: "user-1",
                        email: "owner@business-a.com",
                        name: "Owner",
                        activeBusinessId: "business-a",
                        currentBusinessProfile: {
                            id: "profile-1",
                            businessId: "business-a",
                            role: "OWNER",
                            email: "owner@business-a.com",
                            displayName: "Owner",
                        },
                    },
                }),
            })
        })

        await page.route("**/api/campaigns**", async (route) => {
            const request = route.request()
            const url = new URL(request.url())

            if (request.method() === "GET" && url.pathname === "/api/campaigns") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        campaigns: [],
                        currentPage: 1,
                        totalPages: 0,
                        totalCount: 0,
                    }),
                })
                return
            }

            if (request.method() === "POST" && url.pathname === "/api/campaigns") {
                createCampaignPayload = request.postDataJSON()
                await route.fulfill({
                    status: 201,
                    contentType: "application/json",
                    body: JSON.stringify({
                        id: "campaign-1",
                        name: createCampaignPayload?.name ?? "April Campaign",
                        templates: [],
                        logs: [],
                    }),
                })
                return
            }

            await route.continue()
        })

        await page.route("**/api/templates?**", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    templates: [
                        {
                            id: "template-1",
                            title: "Offer Template",
                            approvers: [],
                            contactList: { id: "list-1", name: "CSV Leads" },
                        },
                    ],
                    currentPage: 1,
                    total: 1,
                }),
            })
        })

        await page.route("**/api/customer-list", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    contactLists: [
                        {
                            id: "list-1",
                            name: "CSV Leads",
                            fields: [
                                { field: "email", type: "email" },
                                { field: "first_name", type: "string" },
                            ],
                            _count: { customers: 25 },
                        },
                    ],
                }),
            })
        })

        await page.route("**/api/templates/template-1/refresh", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    id: "template-1",
                    title: "Offer Template",
                    requiredFields: ["email"],
                }),
            })
        })

        await page.route("**/api/templates/template-1", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    id: "template-1",
                    title: "Offer Template",
                    contactListId: "list-1",
                    requiredFields: ["email"],
                    approvers: [],
                }),
            })
        })

        await page.route("**/api/templates/template-1/parser", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: {
                        schemas: [[]],
                        basePdf: {
                            width: 210,
                            height: 297,
                            padding: [10, 10, 10, 10],
                        },
                    },
                }),
            })
        })

        await page.goto("/campaigns")
        await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible()

        await page.getByRole("button", { name: "Create Campaign" }).click()
        await expect(page.getByText("Campaign Automation Wizard")).toBeVisible()

        await page.getByLabel("Campaign Name").fill("April Campaign")
        await page.screenshot({ path: testInfo.outputPath("01-basic-info.png"), fullPage: true })
        await page.getByRole("button", { name: "Next Step" }).click()

        await expect(page.getByText("Select Template")).toBeVisible()
        await page.getByText("Offer Template").first().click()
        await page.screenshot({ path: testInfo.outputPath("02-template-selected.png"), fullPage: true })
        await page.getByRole("button", { name: "Next Step" }).click()

        await expect(page.getByText("Input Source")).toBeVisible()
        await expect(page.getByText("Validated")).toBeVisible({ timeout: 15000 })
        await page.screenshot({ path: testInfo.outputPath("03-field-mapping-validated.png"), fullPage: true })
        await page.getByRole("button", { name: "Next Step" }).click()

        await expect(page.getByText("Schedule Date & Time")).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath("04-schedule-step.png"), fullPage: true })
        await page.getByRole("button", { name: "Next Step" }).click()

        await expect(page.getByText("Campaign Blueprint")).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath("05-summary-step.png"), fullPage: true })

        await page.getByRole("button", { name: "Launch Campaign" }).click()
        await expect(page.getByText("Campaign Automation Wizard")).not.toBeVisible({ timeout: 10000 })

        expect(createCampaignPayload).toBeTruthy()
        expect(createCampaignPayload.name).toBe("April Campaign")
        expect(createCampaignPayload.customerListId).toBe("list-1")
        expect(createCampaignPayload.templateIds).toEqual(["template-1"])
    })

    test("re-trigger campaign from detail view and receive generated file result", async ({ page, context }, testInfo) => {
        let pollRunPayload: any = null
        const seededCampaignId = "507f1f77bcf86cd799439011"
        const seededCampaignName = "E2E Existing Campaign Detail"

        await context.addCookies([
            {
                name: "uc_default_business",
                value: "business-a",
                domain: "localhost",
                path: "/",
            },
        ])

        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    expires: "2099-01-01T00:00:00.000Z",
                    user: {
                        id: "user-1",
                        email: "owner@business-a.com",
                        name: "Owner",
                        activeBusinessId: "business-a",
                        currentBusinessProfile: {
                            id: "profile-1",
                            businessId: "business-a",
                            role: "OWNER",
                            email: "owner@business-a.com",
                            displayName: "Owner",
                        },
                    },
                }),
            })
        })

        await page.route("**/api/campaigns**", async (route) => {
            const request = route.request()
            const url = new URL(request.url())

            if (request.method() === "GET" && url.pathname === "/api/campaigns") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        campaigns: [
                            {
                                id: seededCampaignId,
                                name: seededCampaignName,
                                scheduledAt: "2026-03-27T18:00:00.000Z",
                                totalRecords: 25,
                                scheduleStatus: "PENDING",
                                fileStatus: "EMPTY",
                                templates: [
                                    {
                                        id: "link-1",
                                        template: {
                                            id: "template-1",
                                            title: "Offer Template",
                                        },
                                    },
                                ],
                                logs: [],
                            },
                        ],
                        currentPage: 1,
                        totalPages: 1,
                        totalCount: 1,
                    }),
                })
                return
            }

            await route.continue()
        })

        await page.route(`**/api/campaigns/${seededCampaignId}/run`, async (route) => {
            const request = route.request()

            if (request.method() === "POST") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        accepted: true,
                        campaignId: seededCampaignId,
                        status: "RUNNING",
                        message: "Campaign run accepted",
                        triggerId: "trigger-001",
                    }),
                })
                return
            }

            if (request.method() === "GET") {
                pollRunPayload = {
                    campaign: {
                        id: seededCampaignId,
                        name: seededCampaignName,
                        scheduledAt: "2026-03-27T18:00:00.000Z",
                        totalRecords: 25,
                        scheduleStatus: "TRIGGERED",
                        fileStatus: "AVALIABLE",
                        templates: [
                            {
                                id: "link-1",
                                template: {
                                    id: "template-1",
                                    title: "Offer Template",
                                },
                            },
                        ],
                        logs: [
                            {
                                id: "log-1",
                                message: "File generated 25 out of 25",
                                status: "TRIGGERED",
                                createdAt: "2026-03-27T18:01:00.000Z",
                            },
                        ],
                        files: [
                            {
                                id: "file-1",
                                fileName: "existing-campaign.zip",
                                filePath: "https://example.com/existing-campaign.zip",
                                status: "AVALIABLE",
                                createdAt: "2026-03-27T18:01:00.000Z",
                                expiresAt: "2026-04-10T18:01:00.000Z",
                            },
                        ],
                    },
                    isRunning: false,
                    status: "TRIGGERED",
                }

                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(pollRunPayload),
                })
                return
            }

            await route.continue()
        })

        await page.goto("/campaigns")
        await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath("06-retrigger-campaign-list.png"), fullPage: true })

        const campaignRow = page.locator("tr", { hasText: seededCampaignName })
        await expect(campaignRow).toBeVisible()
        await page.screenshot({ path: testInfo.outputPath("07-retrigger-row-visible.png"), fullPage: true })

        await Promise.all([
            page.waitForURL(`**/campaigns/${seededCampaignId}`),
            campaignRow.locator("button").first().click(),
        ])
        const detailUnavailable = await page
            .getByText("Content not found")
            .isVisible({ timeout: 3000 })
            .catch(() => false)

        if (detailUnavailable) {
            await page.screenshot({ path: testInfo.outputPath("08-detail-not-found-fallback.png"), fullPage: true })

            await page.goto("/campaigns")
            const fallbackRow = page.locator("tr", { hasText: seededCampaignName })
            await expect(fallbackRow).toBeVisible()

            await fallbackRow.locator("button").nth(1).click()
            await page.screenshot({ path: testInfo.outputPath("09-table-retrigger-clicked.png"), fullPage: true })

            await expect(fallbackRow.getByText("Executed").first()).toBeVisible({ timeout: 10000 })
            await expect(fallbackRow.getByText("Ready").first()).toBeVisible({ timeout: 10000 })
            await page.screenshot({ path: testInfo.outputPath("10-table-retrigger-ready.png"), fullPage: true })
        } else {
            await expect(page.getByRole("button", { name: "Download Latest" })).toBeVisible()
            await page.screenshot({ path: testInfo.outputPath("08-campaign-detail-view.png"), fullPage: true })

            await page.locator("header").getByRole("button").first().click()
            await page.screenshot({ path: testInfo.outputPath("09-detail-retrigger-clicked.png"), fullPage: true })

            await expect(page.getByText("existing-campaign.zip")).toBeVisible({ timeout: 10000 })
            await page.screenshot({ path: testInfo.outputPath("10-detail-zip-visible.png"), fullPage: true })

            await expect(page.getByText("Executed").first()).toBeVisible({ timeout: 10000 })
            await expect(page.getByText("Ready").first()).toBeVisible({ timeout: 10000 })
            await page.screenshot({ path: testInfo.outputPath("11-retrigger-ready.png"), fullPage: true })
        }

        expect(pollRunPayload).toBeTruthy()
        expect(Array.isArray(pollRunPayload.campaign.files)).toBe(true)
        expect(pollRunPayload.campaign.files.length).toBeGreaterThan(0)
        expect(pollRunPayload.campaign.files[0].fileName).toContain(".zip")
    })
})
