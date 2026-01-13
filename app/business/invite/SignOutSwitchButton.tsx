"use client"

import { signOut } from "next-auth/react";
import { useTransition } from "react";

export default function SignOutSwitchButton({ callbackUrl }: { callbackUrl: string }) {
    const [pending, start] = useTransition();

    return (
        <button
            type="button"
            className="text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={pending}
            onClick={() =>
                start(() => {
                    void signOut({ callbackUrl, redirect: true });
                })
            }
        >
            {pending ? "Signing out..." : "Sign out and switch account"}
        </button>
    );
}
