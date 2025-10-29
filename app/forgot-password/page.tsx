import Image from "next/image";
import ResetPasswordRequestForm from "@/components/login/ResetPasswordRequestForm";
import ResetPasswordForm from "@/components/login/ResetPasswordForm";
import prisma from "@/lib/prisma-main";
import { ReferencePurpose } from "../generated/main/prisma";
// import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
    const params = await searchParams;
    const ref: string | undefined = params?.ref;
    let errorMsg: string | undefined;
    let reference
    if (ref) {
        reference = await prisma.references.findUnique({
            where: {
                id: ref,
            },
        });

        // if reference is invalid or expired, show error message server-side
        if (!reference || reference.purpose !== ReferencePurpose.PASSWORD_RESET) {
            errorMsg = 'Oops! The password reset link is invalid. Please request a new one.';
        } else if (reference.expiresAt < new Date()) {
            errorMsg = 'Oops! The password reset link has expired. Please request a new one.';
        }
    }

    return (
        <div className="flex flex-col-reverse md:flex-row min-h-svh p-8">
            <div className="flex-1 flex items-center justify-center">
                <Image
                    src="/images/login-image.svg"
                    width={500}
                    height={500}
                    alt="login image"
                    className="w-full"
                />
            </div>
            <div className="flex-1 flex justify-center items-center">
                <div className="flex flex-col max-w-[37.5rem] py-8 md:p-12 gap-8">
                    <div className="flex flex-col gap-4">
                        <Image
                            src="/images/logos/Big Logo.svg"
                            width={254}
                            height={52}
                            className="aspect-[127/26]"
                            alt="UniComm Logo"
                        />
                        <p className="text-default-400">
                            Please enter your email registered with UniComm to receive a password reset link.
                        </p>
                    </div>
                    {ref && !errorMsg ? (
                        <ResetPasswordForm email={reference?.refEmails?.[0]} refId={reference?.id} />
                    ) : (
                        <ResetPasswordRequestForm errorMsg={errorMsg} />
                    )}
                    
                </div>
            </div>
        </div>
    );
}
