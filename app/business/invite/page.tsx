import prisma from "@/lib/prisma-main";
import { ReferencePurpose } from "@/app/generated/main/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AcceptInviteClient from "./AcceptInviteClient";
import Link from "next/link";
import SignOutSwitchButton from "./SignOutSwitchButton";

const Message = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-default-100 via-white to-default-200">
        <div className="max-w-xl w-full bg-white shadow-lg rounded-xl p-8 flex flex-col gap-4 text-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-default-500">{description}</p>
            {action && <div className="pt-2 flex justify-center">{action}</div>}
        </div>
    </div>
);

type InvitePageProps = {
    searchParams: { ref?: string; authRetry?: string };
};

export default async function InvitePage({ searchParams }: InvitePageProps) {
    const refId = (await searchParams)?.ref;
    if (!refId) {
        return (
            <Message
                title="Invitation not found"
                description="This invitation link is missing a reference."
                action={<Link className="text-secondary" href="/">Return home</Link>}
            />
        );
    }

    const reference = await prisma.references.findUnique({ where: { id: refId } });
    if (!reference || reference.purpose !== ReferencePurpose.BUSINESS_INVITE) {
        return (
            <Message
                title="Invitation not found"
                description="We could not find this invitation. It may have been revoked."
                action={<Link className="text-secondary" href="/">Return home</Link>}
            />
        );
    }

    const expired = reference.expiresAt && new Date(reference.expiresAt).getTime() < Date.now();
    if (expired) {
        return (
            <Message
                title="Invitation expired"
                description="This invitation link has expired. Request a new one from your administrator."
                action={<Link className="text-secondary" href="/">Return home</Link>}
            />
        );
    }

    const inviteEmail = reference.refEmails?.[0];
    if (!inviteEmail) {
        return (
            <Message
                title="Invitation is incomplete"
                description="This invitation is missing the target email."
                action={<Link className="text-secondary" href="/">Return home</Link>}
            />
        );
    }

    const session = await getServerSession(authOptions);
    const sessionEmail = (session?.user as any)?.email?.toLowerCase?.();
    const expectedEmail = inviteEmail.toLowerCase();

    const callbackTarget = `/business/invite?ref=${encodeURIComponent(refId)}&authRetry=1`;

    if (!sessionEmail) {
        redirect(`/?callbackUrl=${encodeURIComponent(callbackTarget)}`);
    }

    if (sessionEmail !== expectedEmail) {
        return (
            <Message
                title="Signed in as a different user"
                description={`You are signed in as ${sessionEmail}. This invitation is for ${inviteEmail}.`}
                action={
                    <SignOutSwitchButton callbackUrl={callbackTarget} />
                }
            />
        );
    }

    if (!reference.businessId) {
        return (
            <Message
                title="Invitation is incomplete"
                description="This invitation is missing the target workspace."
                action={<Link className="text-secondary" href="/">Return home</Link>}
            />
        );
    }

    const business = await prisma.business.findUnique({ where: { id: reference.businessId } });

    return (
        <AcceptInviteClient
            referenceId={reference.id}
            inviteEmail={inviteEmail}
            businessName={business?.name ?? undefined}
        />
    );
}
