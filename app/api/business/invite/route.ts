import { requireAuth } from "@/lib/api-auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma-main";
import { getBusinessPrisma } from "@/lib/prisma-business";
import { ReferencePurpose } from "@/app/generated/main/prisma";
import bcrypt from "bcryptjs";
import { sentMailService } from "@/utils/mail";
import { toAbsoluteUrl } from "@/utils/serverUrlHandler";
import { UserRole } from "@/app/generated/business/prisma";

// Generate a random password
const generateRandomPassword = (length: number = 16): string => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

export const POST = async (request: NextRequest) => {
    try {
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const { email, displayName, role } = await request.json();

        // Validate input
        if (!email || !displayName || !role) {
            return NextResponse.json(
                { error: "Missing required fields: email, displayName, role" },
                { status: 400 }
            );
        }

        if  (UserRole[(role as UserRole)] === undefined) {
            return NextResponse.json(
                { error: "Invalid role specified" },
                { status: 400 }
            );
        }

        // Check if user exists in main database
        let user = await prisma.user.findUnique({
            where: { email },
        });

        const businessPrisma = await getBusinessPrisma(auth.businessId!);

        let inviter = await businessPrisma.businessUser.findUnique({
            where: { id: auth.userId! },
        });

        // If user doesn't exist, create new user with random password
        if (!user) {
            const randomPassword = generateRandomPassword();
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                },
            });
        }

        // Fetch business name for email context
        let businessName = "your business";
        const businessRecord = await prisma.business.findUnique({ where: { id: auth.businessId! } });
        if (businessRecord?.name) {
            businessName = businessRecord.name;
        }

        // Create invitation reference with 1 day expiration
        const reference = await prisma.references.create({
            data: {
                purpose: ReferencePurpose.BUSINESS_INVITE,
                refEmails: [email],
                businessId: auth.businessId!,
                expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
            },
        });

        // Prepare and send invitation email
        const absURL = await toAbsoluteUrl("/");
        const inviteLink = `${absURL}business/invite?ref=${reference.id}`;

        const emailHTML = `
        <body style="margin: 0; padding: 0; min-width: 100%; background-color: #f7f7f7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f7f7f7" role="presentation" style="border-collapse: collapse !important;">
                <tr>
                    <td align="center" style="padding: 20px 0;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border-collapse: collapse !important;" role="presentation">
                            
                            <tr>
                                <td align="center" style="padding: 30px 0 20px 0;">
                                    <img 
                                        src="${absURL}images/logos/Big%20Logo.png" 
                                        alt="UniComm Logo" 
                                        width="150" 
                                        style="display: block; outline: none; border: none; height: auto;"
                                        onerror="this.onerror=null; this.src='https://placehold.co/180x40/7828C8/ffffff?text=UniComm';"
                                    >
                                </td>
                            </tr>

                            <tr>
                                <td style="padding: 0 40px 30px 40px;">
                                    <h1 style="font-size: 24px; line-height: 32px; color: #333333; margin: 0; text-align: center;">
                                        Join the ${businessName} workspace
                                    </h1>
                                    <p style="font-size: 16px; line-height: 24px; color: #555555; padding-top: 20px; margin: 0;">
                                        Hi ${displayName},<br><br>
                                        <strong>${inviter?.displayName}</strong> has invited you to collaborate on the <strong>${businessName}</strong> team via UniComm. UniComm helps teams streamline communication and document management.
                                    </p>

                                    <div style="text-align: center; padding: 30px 0;">
                                        <a href="${inviteLink}" target="_blank" style="font-size: 16px; font-weight: bold; text-decoration: none; color: #ffffff; background-color: #7828C8; padding: 14px 30px; display: inline-block; border-radius: 6px;">
                                            Accept Invitation
                                        </a>
                                    </div>

                                    <p style="font-size: 14px; line-height: 20px; color: #777777; margin: 0; text-align: center;">
                                        For security, this link will remain active for the next 24 hours. If it expires, you can request a new one from your team administrator.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td align="center" style="background-color: #fafafa; padding: 30px 40px; border-radius: 0 0 8px 8px; border-top: 1px solid #eeeeee;">
                                    <p style="font-size: 12px; line-height: 18px; color: #999999; margin: 0;">
                                        Sent by <strong>UniComm</strong> on behalf of ${businessName}.<br>
                                        If you weren't expecting this invitation, you can safely ignore this email.
                                    </p>
                                    <p style="font-size: 11px; color: #bbbbbb; margin-top: 15px;">
                                        UniComm Project &bull; Glasgow, UK
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        `;

        await sentMailService(
            [email],
            `${inviter?.displayName} invited you to the ${businessName} workspace`,
            emailHTML
        );

        return NextResponse.json(
            {
                success: true,
                message: "Invitation sent successfully",
                referenceId: reference.id,
                userCreated: !user,
            },
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error in business invitation:", err);
        return NextResponse.json(
            { error: err?.message || "Failed to send invitation" },
            { status: 500 }
        );
    }
};
