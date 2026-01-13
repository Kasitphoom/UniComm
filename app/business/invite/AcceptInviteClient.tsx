"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, CardFooter, CardHeader, Spinner } from "@heroui/react";
import Link from "next/link";
import { useSession } from "next-auth/react";

type Props = {
    referenceId: string;
    inviteEmail: string;
    businessName?: string | null;
};

type Status = "pending" | "success" | "error";

export default function AcceptInviteClient({ referenceId, inviteEmail, businessName }: Props) {
    const [status, setStatus] = useState<Status>("pending");
    const [message, setMessage] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const { update } = useSession();
    const isAcceptingRef = useRef(false);

    const targetName = useMemo(() => businessName || "this workspace", [businessName]);

    const accept = useCallback(async () => {
        if (isAcceptingRef.current) return;
        isAcceptingRef.current = true;
        
        setStatus("pending");
        setMessage(null);
        try {
            const res = await fetch("/api/business/invite/accept", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ referenceId }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data?.error || "Failed to accept invitation");
            }

            // Update the session to include the new business membership
            if (data.businessId) {
                await update({ activeBusinessId: data.businessId });
            }

            setStatus("success");
        } catch (err: any) {
            setStatus("error");
            setMessage(err?.message || "Failed to accept invitation");
        } finally {
            isAcceptingRef.current = false;
        }
    }, [referenceId, update]);

    useEffect(() => {
        accept();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attempt]);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-default-100 via-white to-default-200">
            <Card className="max-w-xl w-full shadow-lg">
                <CardHeader className="flex flex-col items-start gap-2">
                    <h1 className="text-2xl font-semibold">Accept invitation</h1>
                    <p className="text-default-500 text-sm">
                        Accepting invitation for <strong>{inviteEmail}</strong> to join {targetName}.
                    </p>
                </CardHeader>
                <CardBody className="flex flex-col items-center gap-4 text-center">
                    {status === "pending" && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Spinner color="secondary" label="Accepting invitation..." />
                            <p className="text-default-500 text-sm">
                                Hang tight while we complete your access.
                            </p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <p className="text-lg font-medium">Invitation accepted</p>
                            <p className="text-default-500 text-sm">
                                You now have access to {targetName}. Continue to the dashboard to get started.
                            </p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <p className="text-lg font-medium">Something went wrong</p>
                            <p className="text-default-500 text-sm">
                                {message || "We could not complete the invitation acceptance."}
                            </p>
                        </div>
                    )}
                </CardBody>
                <CardFooter className="flex justify-between gap-3 flex-wrap">
                    {status === "success" ? (
                        <>
                            <Button as={Link} href="/dashboard" color="secondary" className="flex-1 min-w-40">
                                Go to dashboard
                            </Button>
                            <Button as={Link} href="/" variant="light" className="flex-1 min-w-40">
                                Back to home
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                color="secondary"
                                className="flex-1 min-w-40"
                                isDisabled={status === "pending"}
                                onPress={() => setAttempt((n) => n + 1)}
                            >
                                {status === "pending" ? "Working..." : "Try again"}
                            </Button>
                            <Button as={Link} href="/" variant="light" className="flex-1 min-w-40">
                                Cancel
                            </Button>
                        </>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
