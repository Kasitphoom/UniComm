'use client'
import APICallHandler from "@/utils/apiCall";
import { Button, Input, addToast } from "@heroui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";

const schema = yup.object().shape({
    email: yup.string().email("Invalid email format").required("Email is required"),
    password: yup
        .string()
        .required("Password is required")
        .min(9, "Password must be more than 8 characters")
        // Use custom tests with unique names so react-hook-form can expose all messages separately
        .test('has-uppercase', 'Must contain at least one uppercase letter', (v) => !v || /[A-Z]/.test(v))
        .test('has-lowercase', 'Must contain at least one lowercase letter', (v) => !v || /[a-z]/.test(v))
        .test('has-number', 'Must contain at least one number', (v) => !v || /[0-9]/.test(v))
        .test('has-special', 'Must contain at least one special character', (v) => !v || /[^A-Za-z0-9]/.test(v)),
    confirmPassword: yup
        .string()
        .oneOf([yup.ref('password')], 'Passwords must match')
        .required('Confirm Password is required'),
});

const ResetPasswordRequestForm = (params: { refId?: string, email?: string }) => {

    const router = useRouter();

    const { handleSubmit, control, reset } = useForm({
        resolver: yupResolver(schema, { abortEarly: false }),
        criteriaMode: 'all',
    });

    const onSubmit = async (data: { email: string, password: string}) => {
        try {
            await APICallHandler('/api/auth/reset-password', 'POST', {
                token: params.refId,
                newPassword: data.password,
                email: data.email,
            });

            const { email, password } = data;
            await signIn('credentials', {
                email,
                password,
                redirect: false,
            })

            addToast({
                title: "Success",
                description: "Your password has been reset successfully.",
                color: "success",
                radius: "md",
                timeout: 3000,
            })

            router.push('/');
        } catch (error) {
            addToast({
                title: "Error",
                description: "There was an error resetting your password. Please try again.",
                color: "danger",
                radius: "md",
                timeout: 3000,
            })
        }
    }

    useEffect(() => {
        if (params.email) {
            reset({ email: params.email });
        }
    }, [params.email, reset]);

    return (
        <>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
                <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                        <Input
                            {...field}
                            label="Email"
                            type="email"
                            validationBehavior="aria"
                            labelPlacement="outside"
                            disabled
                        />
                    )}
                />
                <Controller
                    name="password"
                    control={control}
                    render={({field , fieldState: {invalid, error}}) => {
                        const messages = error?.types
                            ? Object.values(error.types as Record<string, string>)
                            : error ? [error.message] : []
                        return (
                            <Input
                                {...field}
                                label="Password"
                                type="password"
                                isRequired
                                validationBehavior="aria"
                                isInvalid={invalid}
                                errorMessage={messages.length ? (
                                    <div className="space-y-1">
                                        {messages.map((m, i) => (
                                            <div key={i}>• {m}</div>
                                        ))}
                                    </div>
                                ) : undefined}
                                labelPlacement="outside"
                                placeholder="Enter your password"
                            />
                        )
                    }}
                />
                <Controller
                    name="confirmPassword"
                    control={control}
                    render={({field , fieldState: {invalid, error}}) => {
                        const messages = error?.types
                            ? Object.values(error.types as Record<string, string>)
                            : error ? [error.message] : []
                        return (
                            <Input
                                {...field}
                                label="Confirm Password"
                                type="password"
                                isRequired
                                validationBehavior="aria"
                                isInvalid={invalid}
                                errorMessage={messages.length ? (
                                    <div className="space-y-1">
                                        {messages.map((m, i) => (
                                            <div key={i}>• {m}</div>
                                        ))}
                                    </div>
                                ) : undefined}
                                labelPlacement="outside"
                                placeholder="Re-enter your password"
                            />
                        )
                    }}
                />
                <Button type="submit" color="secondary">
                    Update Password
                </Button>
            </form>
        </>
    )
}

export default ResetPasswordRequestForm