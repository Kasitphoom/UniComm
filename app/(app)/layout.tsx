import SideBar from "@/components/sidebar/SideBar";
import Header from "@/components/header/Header";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_BUSINESS_COOKIE } from "@/types/business";

export default async function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies();
    const defaultBusiness = cookieStore.get(DEFAULT_BUSINESS_COOKIE)?.value;

    if (!defaultBusiness) {
        redirect('/');
    }

    // Note: Only the root layout (`app/layout.tsx`) should render <html> and <body>.
    // This segment layout wraps page content with the app shell.
    return (
        <div className="flex h-dvh">
            <SideBar />
            <div className="flex flex-col w-full min-w-0">
                <Header />
                <div className="flex-1 min-w-0 min-h-0 bg-default-100 overflow-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}