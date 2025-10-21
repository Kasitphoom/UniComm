import { ReferencePurpose } from "@/app/generated/main/prisma";
import prisma from "@/lib/prisma-main";
import { toAbsoluteUrl } from "@/utils/apiCall";
import { sentMailService } from "@/utils/mail";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
    const emailHTML = `
    <body style="margin: 0; padding: 0; min-width: 100%; background-color: #f7f7f7; font-family: Arial, sans-serif;">

    <!-- 1. Master Table (Centers Content) -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f7f7f7" role="presentation" style="border-collapse: collapse !important;">
        <tr>
            <td align="center" style="padding: 20px 0;">

                <!-- 2. Email Container Table (Max Width 600px) -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border-collapse: collapse !important;" role="presentation">

                    <!-- Logo Section (Header) -->
                    <tr>
                        <td align="center" style="padding: 20px 0 20px 0; background-color: #ffffff; border-radius: 8px 8px 0 0;">
                            <!-- Link styling applied inline -->
                            <a href="#" target="_blank" style="text-decoration: none; color: #7828C8;">
                                <!-- The provided logo image (Updated to PNG URL) -->
                                <img 
                                    src="${toAbsoluteUrl('/')}images/logos/Big%20Logo.png" 
                                    alt="Company Logo" 
                                    width="180" 
                                    style="display: block; width: 180px; max-width: 100%; height: auto; outline: none; border: none; line-height: 100%;"
                                    onerror="this.onerror=null; this.src='https://placehold.co/180x40/7828C8/ffffff?text=LOGO';"
                                >
                            </a>
                        </td>
                    </tr>

                    <!-- Main Content/Hero Section -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse !important;">
                                <tr>
                                    <td align="left" style="font-size: 28px; line-height: 36px; color: #333333; font-weight: bold; padding-bottom: 20px;">
                                        <h1 style="font-size: 28px; line-height: 36px; color: #7828C8; margin: 0;">
                                            Reset Your Password
                                        </h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td align="left" style="font-size: 16px; line-height: 24px; color: #555555; padding-bottom: 20px;">
                                        <p style="margin: 0;">
                                            You recently requested to reset the password for your account. Click the button below to complete the process. This link is valid for a limited time.
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Button Section -->
                                <tr>
                                    <td align="center" style="padding: 20px 0 30px 0;">
                                        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse !important;">
                                            <tr>
                                                <td align="center" bgcolor="#7828C8" style="border-radius: 6px;">
                                                    <!-- Important: Inline styling for the link is crucial for button compatibility -->
                                                    <a href="[RESET_LINK_GOES_HERE]" target="_blank" style="font-size: 16px; font-weight: bold; text-decoration: none; color: #ffffff; background-color: #7828C8; border: 1px solid #7828C8; padding: 12px 25px; display: inline-block; border-radius: 6px;">
                                                        Reset My Password
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <tr>
                                    <td align="left" style="font-size: 16px; line-height: 24px; color: #555555; padding-bottom: 40px;">
                                        <p style="margin: 0;">
                                            If you are having trouble clicking the "Reset My Password" button, copy and paste the URL below into your web browser:<br>
                                            <a href="[RESET_LINK_GOES_HERE]" style="word-break: break-all; color: #7828C8;">[RESET_LINK_GOES_HERE]</a>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Sign-off Updated for System Email (UniComm) -->
                                <tr>
                                    <td align="left" style="font-size: 14px; line-height: 20px; color: #999999;">
                                        <p style="margin: 0;">
                                            Kind regards,<br>
                                            The UniComm Team
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer Section Updated for Transactional Message -->
                    <tr>
                        <td align="center" style="background-color: #e5e5e5; padding: 20px 40px; border-radius: 0 0 8px 8px;">
                            <p style="font-size: 12px; line-height: 18px; color: #777777; margin: 0;">
                                If you did not request a password reset, please ignore this email.
                            </p>
                        </td>
                    </tr>

                </table>
                <!-- End Email Container Table -->

            </td>
        </tr>
    </table>
    <!-- End Master Table -->

</body>
    `
    try {
        const body = await req.json();

        // if no user with this email exists, return success anyway to avoid email enumeration
        const user = await prisma.user.findUnique({
            where: {
                email: body.email,
            },
        });

        if (!user) {
            return NextResponse.json({ referenceId: null }, { status: 200 });
        }
    
        const reference = await prisma.references.create({
            data: {
                purpose: ReferencePurpose.PASSWORD_RESET,
                refEmails: [body.email],
                expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes from now
            },
        });
    
        await sentMailService([body.email], 'UniComm Account Password Reset', emailHTML.replaceAll('[RESET_LINK_GOES_HERE]', `${toAbsoluteUrl('/')}forgot-password?ref=${reference.id}`));
    
        return NextResponse.json({ referenceId: reference.id }, { status: 200 });
    } catch (error) {
        console.error('Error in reset password request:', error);
        return NextResponse.json({ msg: error }, { status: 500 });
    }
}