import Image from "next/image";
import LoginForm from "@/components/login/loginForm";

export default function Home() {
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
                    <LoginForm />
                    <div className="flex gap-4 items-center">
                        <div className="w-full h-[1px] bg-default-300"/>
                        <p className="text-default-400">OR</p>
                        <div className="w-full h-[1px] bg-default-300"/>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex py-2 px-4 border border-default-300 rounded-lg items-center gap-2 cursor-pointer hover:bg-default-100 transition">
                            <Image
                                src="/images/logos/Google Logo.png"
                                width={20}
                                height={20}
                                alt="Google Logo"
                            />
                            <p className="w-full text-default-400 text-center">
                                Continue with Google
                            </p>
                        </div>
                        <div className="flex py-2 px-4 border border-default-300 rounded-lg items-center gap-2 cursor-pointer hover:bg-default-100 transition">
                            <Image
                                src="/images/logos/Salesforce-logo.png"
                                width={20}
                                height={20}
                                alt="Google Logo"
                                className="w-auto h-[20px]"
                            />
                            <p className="w-full text-default-400 text-center">
                                Continue with Salesforce
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ); 
}
