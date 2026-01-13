import prisma from "@/lib/prisma-main";
import { ReferencePurpose } from "@/app/generated/main/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AcceptInviteClient from "./AcceptInviteClient";
import ValidationUI from "./ValidationUI"; // Import the client UI
import SignOutSwitchButton from "./SignOutSwitchButton";
import { SearchX, Clock, UserRoundX, AlertTriangle } from "lucide-react";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
    const { ref: refId } = await searchParams;

    if (!refId) {
        return <ValidationUI title="Invalid Link" description="Missing reference code." iconName="search" />;
    }

    const reference = await prisma.references.findUnique({ where: { id: refId } });
    
    if (!reference || reference.purpose !== ReferencePurpose.BUSINESS_INVITE) {
        return <ValidationUI title="Not Found" description="This invitation does not exist." iconName="search" />;
    }

    if (reference.expiresAt && new Date(reference.expiresAt).getTime() < Date.now()) {
        return <ValidationUI title="Expired" description="This link is no longer valid." iconName="clock" iconColor="text-warning" />;
    }

    const inviteEmail = reference.refEmails?.[0];
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email?.toLowerCase();

    if (!sessionEmail) {
        redirect(`/?callbackUrl=/business/invite?ref=${refId}`);
    }

    if (sessionEmail !== inviteEmail?.toLowerCase()) {
        return (
            <ValidationUI 
                title="Wrong Account" 
                iconName="user"
                iconColor="text-danger"
                description={`Invite is for ${inviteEmail}, but you are ${sessionEmail}.`}
                action={<SignOutSwitchButton callbackUrl={`/business/invite?ref=${refId}`} />}
            />
        );
    }

    const business = await prisma.business.findUnique({ where: { id: reference.businessId! } });

    return (
        <AcceptInviteClient
            referenceId={reference.id}
            inviteEmail={inviteEmail}
            businessName={business?.name}
        />
    );
}