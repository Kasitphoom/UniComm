'use client'
import { Button, Input, Link } from "@heroui/react";
import { yupResolver } from "@hookform/resolvers/yup";
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

    const onSubmit = (data: any) => {
        console.log(data);
    };

    return (
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
                <Link color="secondary" className="text-sm">
                    Forgot Password?
                </Link>
            </div>
            <Button type="submit" color="secondary">
                Log In
            </Button>
        </form>
    )
}

export default LoginForm