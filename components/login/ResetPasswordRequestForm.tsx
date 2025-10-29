'use client'
import { Button, Input, Link, Image, addToast } from "@heroui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";
import { sentMailService } from "@/utils/mail";
import { APICallHandler } from "@/utils/apiCall";

const schema = yup.object().shape({
    email: yup.string().email("Invalid email format").required("Email is required"),
});

const ResetPasswordRequestForm = ({ errorMsg }: { errorMsg: string | undefined }) => {

    const { handleSubmit, control, formState: { isValid } } = useForm({
        resolver: yupResolver(schema),
    });

    const onSubmit = async (data: any) => {
        await APICallHandler('/api/auth/request-reset-password', 'POST', {
            email: data.email,
        });
        addToast({
            title: "Reset Link Sent",
            description: "If the email is registered, a reset link has been sent.",
            color: "secondary",
            radius: "md",
            timeout: 2000,
        })
    };

    return (
        <>
            {errorMsg && (
                <div className="text-danger">
                    {errorMsg}
                </div>
            )}
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
                <Button type="submit" color="secondary" isDisabled={!isValid}>
                    Sent Reset Link
                </Button>
            </form>
        </>
    )
}

export default ResetPasswordRequestForm