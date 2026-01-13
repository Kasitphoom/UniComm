"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
    Button, 
    Card, 
    CardBody, 
    CardFooter, 
    CardHeader, 
    Spinner, 
    Divider, 
    Link 
} from "@heroui/react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, ArrowRight, Home, ShieldCheck } from "lucide-react";

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
    const router = useRouter();
    const isAcceptingRef = useRef(false);

    const targetName = useMemo(() => businessName || "this workspace", [businessName]);

    const handleSwitchAccount = async () => {
        await signOut({ 
            redirect: false,
            callbackUrl: `/`
        });
        router.push(`/?callbackUrl=${encodeURIComponent(`/business/invite?ref=${new URLSearchParams(window.location.search).get('ref') || ''}`)}`);
    };

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
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden bg-default-100">
            {/* Background Decorative Blobs */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] rounded-full bg-secondary-200/20 blur-[120px]" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] rounded-full bg-primary-200/20 blur-[120px]" />
            </div>

            <div className="z-10 w-full max-w-md flex flex-col gap-6">
                {/* Brand Logo Section */}
                <div className="flex flex-col items-center gap-4 mb-2">
                    <div className="relative w-48 h-16 transition-transform hover:scale-105 duration-300">
                        <Image
                            src="/images/logos/Big Logo.png"
                            alt="UniComm Logo"
                            fill
                            priority
                            className="object-contain"
                        />
                    </div>
                </div>

                <Card className="border-none bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]" radius="2xl">
                    <CardHeader className="flex flex-col gap-2 px-8 pt-10 pb-4 text-center">
                        <h1 className="text-2xl font-bold text-default-900 tracking-tight">Accept Invitation</h1>
                        <p className="text-default-500 text-sm">
                            You&apos;re invited to join <span className="text-foreground font-semibold">{targetName}</span>
                        </p>
                    </CardHeader>

                    <CardBody className="px-8 py-8">
                        {status === "pending" && (
                            <div className="flex flex-col items-center gap-6 py-4">
                                <div className="relative flex items-center justify-center">
                                    {/* Ping animation adjusted to match the 84px size */}
                                    <div className="absolute w-[84px] h-[84px] rounded-full bg-secondary/10 animate-ping" />
                                    
                                    {/* The Square/Circular Container - using flex to center the spinner */}
                                    <div className="relative w-[84px] h-[84px] flex items-center justify-center bg-secondary-50 rounded-full">
                                        <Spinner color="secondary" size="lg" />
                                    </div>
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-semibold text-default-700 text-lg tracking-tight">Connecting...</p>
                                    <p className="text-default-400 text-sm">Verifying your invited permissions</p>
                                </div>
                            </div>
                        )}

                        {status === "success" && (
                            <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in zoom-in duration-500">
                                <div className="p-5 bg-success-50 text-success rounded-full shadow-inner">
                                    <CheckCircle2 size={44} strokeWidth={1.5} />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-bold text-success-700 text-xl tracking-tight">Invitation Accepted!</p>
                                    <p className="text-default-500 text-sm">
                                        Welcome to the team. You now have access as your <span className="font-bold">invited role</span>.
                                    </p>
                                </div>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="flex flex-col items-center gap-6 py-4 animate-in fade-in zoom-in duration-500">
                                <div className="p-5 bg-danger-50 text-danger rounded-full shadow-inner">
                                    <AlertCircle size={44} strokeWidth={1.5} />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-bold text-danger-700 text-xl tracking-tight">Something went wrong</p>
                                    <p className="text-default-500 text-sm px-2">
                                        {message || "This invitation may have expired or already been used."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardBody>

                    <Divider className="opacity-50" />

                    <CardFooter className="flex flex-col gap-3 px-8 py-8 bg-default-50/30">
                        {status === "success" ? (
                            <>
                                <Button 
                                    as={Link} 
                                    href="/dashboard" 
                                    color="secondary" 
                                    size="lg"
                                    fullWidth
                                    className="font-bold text-medium shadow-xl shadow-secondary/20"
                                    endContent={<ArrowRight size={20} />}
                                >
                                    Go to dashboard
                                </Button>
                                <Button as={Link} href="/" variant="light" fullWidth size="lg" className="font-medium text-default-500">
                                    Back to home
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    color="secondary"
                                    size="lg"
                                    fullWidth
                                    className="font-bold text-medium shadow-xl shadow-secondary/20"
                                    isDisabled={status === "pending"}
                                    isLoading={status === "pending"}
                                    onPress={() => setAttempt((n) => n + 1)}
                                >
                                    {status === "pending" ? "Joining Workspace" : "Try again"}
                                </Button>
                                <Button as={Link} href="/" variant="flat" fullWidth size="lg" className="font-medium" startContent={<Home size={18} />}>
                                    Cancel
                                </Button>
                            </>
                        )}
                    </CardFooter>
                </Card>

                {/* Account Context Footer */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-[11px] tracking-wide text-default-400 bg-white px-4 py-2 rounded-full border border-default-100 shadow-sm">
                        <ShieldCheck size={14} className="text-secondary" />
                        <span>Signed in as <b className="text-default-700">{inviteEmail}</b></span>
                    </div>
                    <button 
                        onClick={handleSwitchAccount}
                        className="text-xs text-secondary-500 hover:text-secondary-600 font-medium transition-colors"
                    >
                        Not your account? Switch now
                    </button>
                </div>
            </div>
        </div>
    );
}