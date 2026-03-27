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
})
