import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-main";
import { requireAuth } from "@/lib/api-auth";
import { ReferencePurpose, UserBusinessRole } from "@/app/generated/main/prisma";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { UserRole } from "@/app/generated/business/prisma";
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business";

/**
 * @swagger
 * /api/business/invite/accept:
 *   post:
 *     summary: Accept a business invitation
 *     tags:
 *       - Business
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referenceId
 *             properties:
 *               referenceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       400:
 *         description: Invalid request or invitation payload
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Signed-in user does not match invited email
 *       404:
 *         description: Invitation not found
 *       410:
 *         description: Invitation expired
 *       500:
 *         description: Failed to accept invitation
 */
export const POST = async (req: NextRequest) => {
    try {
        const auth = await requireAuth(req, { requireBusiness: false });
        if (!auth.ok) return auth.response;

        const body = await req.json().catch(() => ({}));
        const referenceId = body?.referenceId as string | undefined;

        if (!referenceId) {
            return NextResponse.json(
                { error: "referenceId is required" },
                { status: 400 }
            );
        }

        const reference = await prisma.references.findUnique({
            where: { id: referenceId },
        });

        if (!reference || reference.purpose !== ReferencePurpose.BUSINESS_INVITE) {
            return NextResponse.json(
                { error: "Invitation not found" },
                { status: 404 }
            );
        }

        const now = Date.now();
        if (reference.expiresAt && new Date(reference.expiresAt).getTime() < now) {
            return NextResponse.json(
                { error: "Invitation has expired" },
                { status: 410 }
            );
        }

        const invitedEmail = reference.refEmails?.[0]?.toLowerCase();
        if (!invitedEmail) {
            return NextResponse.json(
                { error: "Invitation email is missing" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: auth.mainUserId! },
        });

        if (!user) {
            return NextResponse.json(
                { error: "Authenticated user not found" },
                { status: 401 }
            );
        }

        const userEmail = user?.email?.toLowerCase();
        if (!userEmail) {
            return NextResponse.json(
                { error: "Unable to resolve signed-in user email" },
                { status: 401 }
            );
        }

        if (userEmail !== invitedEmail) {
            return NextResponse.json(
                {
                    error: "Signed in as a different user",
                    currentEmail: userEmail,
                    invitedEmail,
                },
                { status: 403 }
            );
        }

        if (!reference.businessId) {
            return NextResponse.json(
                { error: "Invitation is missing a business target" },
                { status: 400 }
            );
        }

        // Link user to business in the main database
        const membership = await prisma.usersOnBusinesses.upsert({
            where: {
                userId_businessId: {
                    userId: user.id,
                    businessId: reference.businessId,
                },
            },
            create: {
                userId: user.id,
                businessId: reference.businessId,
                role: UserBusinessRole.MEMBER,
            },
            update: {},
        });

        // Ensure BusinessUser exists in the business database
        const businessClient = await getBusinessPrisma(reference.businessId);
        const displayName = reference.displayName || user.email.split("@")[0];
        await businessClient.businessUser.upsert({
            where: { email: user.email },
            update: {},
            create: {
                email: user.email,
                displayName: displayName,
                role: UserRole.MEMBER,
            },
        });

        const response = NextResponse.json(
            {
                accepted: true,
                businessId: reference.businessId,
                membershipId: membership.id,
            },
            { status: 200 }
        );

        // Set the business ID cookie so server-side queries have access to it
        response.cookies.set(DEFAULT_BUSINESS_COOKIE, reference.businessId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365, // 1 year
        });

        return response;
    } catch (err: any) {
        console.error("Error accepting invitation:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to accept invitation" },
            { status: 500 }
        );
    }
};
