"use client";

import { Card, CardHeader, CardBody, CardFooter, Divider, Button } from "@heroui/react";
import { 
    SearchX, 
    Clock, 
    UserRoundX, 
    AlertTriangle, 
    Home, 
    LucideIcon 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Create a lookup map for the icons
const iconMap: Record<string, LucideIcon> = {
    search: SearchX,
    clock: Clock,
    user: UserRoundX,
    alert: AlertTriangle,
};

interface ValidationUIProps {
    title: string;
    description: string;
    iconName: "search" | "clock" | "user" | "alert"; // Pass string instead of object
    iconColor?: string;
    action?: React.ReactNode;
}

export default function ValidationUI({ 
    title, 
    description, 
    iconName, 
    iconColor = "text-secondary", 
    action 
}: ValidationUIProps) {
    // Get the icon from the map
    const Icon = iconMap[iconName] || AlertTriangle;

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden bg-default-100">
            {/* Background Blobs */}
            <div className="absolute inset-0 z-0 pointer-events-none text-default-200">
                <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] rounded-full bg-secondary-200/10 blur-[120px]" />
                <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] rounded-full bg-primary-200/10 blur-[120px]" />
            </div>

            <div className="z-10 w-full max-w-md flex flex-col gap-6">
                <div className="flex flex-col items-center mb-2">
                    <div className="relative w-48 h-16">
                        <Image src="/images/logos/Big Logo.png" alt="UniComm Logo" fill priority className="object-contain" />
                    </div>
                </div>

                <Card className="border-none bg-white/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]" radius="lg">
                    <CardHeader className="flex flex-col gap-2 px-8 pt-10 pb-4 text-center">
                        <h1 className="text-2xl font-bold text-default-900 tracking-tight">{title}</h1>
                    </CardHeader>
                    <CardBody className="px-8 py-8 flex flex-col items-center gap-6">
                        <div className="w-21 h-21 flex items-center justify-center bg-default-100 rounded-full shadow-inner">
                            <Icon size={40} className={iconColor} strokeWidth={1.5} />
                        </div>
                        <p className="text-default-500 text-center text-sm leading-relaxed">{description}</p>
                    </CardBody>
                    <Divider className="opacity-50" />
                    <CardFooter className="px-8 py-8 bg-default-50/30">
                        {action || (
                            <Button as={Link} href="/" fullWidth variant="flat" size="lg" startContent={<Home size={18}/>}>
                                Return Home
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}