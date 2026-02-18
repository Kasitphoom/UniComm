import Image from "next/image";
import LoginForm from "@/components/login/loginForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {

    const params = await searchParams;

    const session = await getServerSession(authOptions);
    if (session) {
        const jar = await cookies();
        const preferred = jar.get('uc_default_business')?.value;

        const userBizIds: string[] = (session.user as any)?.businessIds || [];
        if (preferred && userBizIds.includes(preferred)) {
            redirect(`/dashboard`);
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
                        <Link href="/">
                            <Image
                                src="/images/logos/Big Logo.svg"
                                width={254}
                                height={52}
                                className="aspect-[127/26]"
                                alt="UniComm Logo"
                            />
                        </Link>
                        <p className="text-default-400">
                            Log in to your account to access the UniComm platform
                        </p>
                    </div>
                    {
                        params.error && params.error === 'CredentialsSignin' ? (
                            <div className="text-danger">
                                Invalid email or password. Please try again.
                            </div>
                        ) :
                        params.error && params.error === 'AccessDenied' ? (
                            <div className="text-danger">
                                Access denied. This can also mean your email isn&apos;t registered or doesn&apos;t have access. If you think this is a mistake, please contact support.
                            </div>
                        ) :
                        params.error ? (
                            <div className="text-danger">
                                Something went wrong. Please try again.
                            </div>
                        ) : null
                    }                        
                    <LoginForm />
                </div>
            </div>
        </div>
    ); 
}
