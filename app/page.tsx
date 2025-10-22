import Image from "next/image";
import LoginForm from "@/components/login/loginForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {

    const params = await searchParams;

    // if server session exists, redirect to dashboard
    const session = await getServerSession(authOptions);
    if (session) {
        console.log("Session exists, redirecting to dashboard:", session);
        redirect('/dashboard');
    }

    return (
        <div className="flex min-h-svh p-8">
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
                <div className="flex flex-col max-w-[37.5rem] p-12 gap-8">
                    <div className="flex flex-col gap-4">
                        <Image
                            src="/images/logos/Big Logo.svg"
                            width={254}
                            height={52}
                            className="aspect-[127/26]"
                            alt="UniComm Logo"
                        />
                        <p className="text-default-400">
                            Log in to your account to access the UniComm platform
                        </p>
                    </div>
                    {
                        params.error && params.error === 'CredentialsSignin' && (
                            <div className="text-danger">
                                Invalid email or password. Please try again.
                            </div>
                        )
                    }
                    <LoginForm />
                </div>
            </div>
        </div>
    ); 
}
