'use client'
import { Button, Input, Link, Image, addToast } from "@heroui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";

const schema = yup.object().shape({
    email: yup.string().email("Invalid email format").required("Email is required"),
    password: yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
});

const LoginForm = () => {

    const { handleSubmit, control } = useForm({
        resolver: yupResolver(schema),
    });

    const onSubmit = async (data: any) => {
        await signIn('credentials', {
            email: data.email,
            password: data.password,
            callbackUrl: '/dashboard',
        });
    };

    const googleSignIn = async () => {
        await signIn('google', { callbackUrl: '/dashboard' });
    };

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
                <div className="flex py-2 px-4 border border-default-300 rounded-lg items-center gap-2 cursor-pointer hover:bg-default-100 transition">
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
        </>
    )
}

export default LoginForm