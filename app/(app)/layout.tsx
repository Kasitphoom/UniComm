import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "../providers";
import "../globals.css";
import SideBar from "@/components/sidebar/SideBar";
import Header from "@/components/header/Header";

const poppins = Poppins({
    variable: "--font-poppins",
    subsets: ["latin"],
    weight: ["400", "700"],
});

export const metadata: Metadata = {
    title: "UniComm – AI-Powered Unified Communication Platform for Modern Enterprises",
    description: "UniComm is a next-generation Customer Communication Management (CCM) and Unified Communication Platform that lets enterprises design, orchestrate, and deliver personalized, compliant messages across email, SMS, push, chat, and print. Built for scalability, AI-driven personalization, and cloud-native security.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${poppins.className} antialiased`}
            >
                <Providers>
                    <div className="flex">
                        <SideBar />
                        <div className="flex flex-col w-full">
                            <Header />
                            <div className="flex-1 bg-default-100">
                                {children}
                            </div>
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    );
}