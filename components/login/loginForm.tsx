"use client"
import { Button, Input, Link, Image, addToast, useDisclosure } from "@heroui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";
import SelectBusinessModal from "./SelectBusinessModal";

const schema = yup.object().shape({
    email: yup.string().email("Invalid email format").required("Email is required"),
    password: yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
});

const LoginForm = () => {
    const { isOpen, onOpenChange, onOpen } = useDisclosure();
    const router = useRouter();
    const { status, data: session } = useSession();
    const searchParams = useSearchParams();

    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const isInviteFlow = callbackUrl.includes('/business/invite');
    const oauthCallbackUrl = isInviteFlow ? callbackUrl : '/';

    const { handleSubmit, control } = useForm({
        resolver: yupResolver(schema),
    });

    const maybeStoreCredential = async (email: string, password: string) => {
        try {
            const navAny = navigator as any
            const WinAny = window as any
            if (navAny?.credentials && WinAny?.PasswordCredential) {
                const cred = new WinAny.PasswordCredential({ id: email, name: email, password })
                await navAny.credentials.store(cred)
            }
        } catch {}
    }

    const onSubmit = async (data: any) => {
        // Prevent full-page navigation; handle redirect manually
        const res = await signIn('credentials', {
            email: data.email,
            password: data.password,
            callbackUrl,
            redirect: false,
        });

        if (res?.ok) {
            // Ask Google Password Manager to store the credential (works on https or localhost)
            await maybeStoreCredential(data.email, data.password)
            // Only show business select modal if not on invitation flow
            if (isInviteFlow) {
                router.push(callbackUrl);
            } else {
                onOpen();
            }
        } else if (res?.error) {
            const message = res.error === 'CredentialsSignin'
                ? 'Invalid email or password'
                : res.error === 'AccessDenied'
                    ? "Access denied. This may mean your email isn't registered or lacks access."
                    : 'Sign in failed. Please try again.';
            addToast({ title: 'Sign in', description: message, color: 'danger' });
        }
    };

    const googleSignIn = async () => {
        await signOut({ redirect: false });
        await signIn('google', { callbackUrl: oauthCallbackUrl, redirect: true });
    };

    const salesforceSignIn = async () => {
        await signOut({ redirect: false });
        await signIn('salesforce', { callbackUrl: oauthCallbackUrl, redirect: true });
    };

    // After OAuth returns to '/', open the business select if authenticated and no active business set
    // But skip if this is for an invitation acceptance
    useEffect(() => {
        if (status === 'authenticated') {
            const active = (session?.user as any)?.activeBusinessId
            if (!active && !isInviteFlow) onOpen()
        }
         
    }, [status, session, callbackUrl])

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
                <Controller
                    name="email"
                    control={control}
                    render={({field , fieldState: {invalid, error}}) => (
                        <Input
                            {...field}
                            label="Email"
                            type="email"
                            autoComplete="username"
                            isRequired
                            validationBehavior="aria"
                            isInvalid={invalid}
                            errorMessage={error ? error.message : undefined}
                            labelPlacement="outside"
                            placeholder="example@email.com"
                        />
                    )}
                />
                <Controller
                    name="password"
                    control={control}
                    render={({field , fieldState: {invalid, error}}) => (
                        <Input
                            {...field}
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            isRequired
                            validationBehavior="aria"
                            isInvalid={invalid}
                            errorMessage={error ? error.message : undefined}
                            labelPlacement="outside"
                            placeholder="Enter your password"
                        />
                    )}
                />
                <div className="flex justify-end">
                    <Link color="secondary" className="text-sm" href="/forgot-password">
                        Forgot Password?
                    </Link>
                </div>
                <Button type="submit" color="secondary">
                    Log In
                </Button>
            </form>
            <div className="flex gap-4 items-center">
                <div className="w-full h-[1px] bg-default-300"/>
                <p className="text-default-400">OR</p>
                <div className="w-full h-[1px] bg-default-300"/>
            </div>
            <div className="flex flex-col gap-4">
                <div className="flex py-2 px-4 border border-default-300 rounded-lg items-center gap-2 cursor-pointer hover:bg-default-100 transition" onClick={googleSignIn}>
                    <Image
                        src="/images/logos/Google Logo.png"
                        style={{
                            height: '20px',
                            width: 'auto',
                        }}
                        sizes="100vw"
                        alt="Google Logo"
                    />
                    <p className="w-full text-default-400 text-center">
                        Continue with Google
                    </p>
                </div>
                <div className="flex py-2 px-4 border border-default-300 rounded-lg items-center gap-2 cursor-pointer hover:bg-default-100 transition" onClick={salesforceSignIn}>
                    <Image
                        src="/images/logos/Salesforce-logo.png"
                        sizes="100vw"
                        alt="Google Logo"
                        style={{
                            height: '20px',
                            width: 'auto',
                        }}
                    />
                    <p className="w-full text-default-400 text-center">
                        Continue with Salesforce
                    </p>
                </div>
            </div>
            <SelectBusinessModal isOpen={isOpen} onOpenChange={onOpenChange} />
        </>
    )
}

export default LoginForm