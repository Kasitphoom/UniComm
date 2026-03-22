import React from 'react'
import { Metadata } from 'next'
import { Settings } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Under Maintenance - UniComm',
    description: 'This page is currently under maintenance. We are working hard to bring you a better experience. Please check back soon!',
}

const UnderMaintenance = () => {
    return (
        <div className="relative h-full flex flex-col items-center justify-center overflow-hidden p-6">

            {/* --- Background Graphics (Decorative) --- */}

            {/* Ambient glow - Subtle secondary tint behind the content */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Floating/Spinning Background Elements (Faint gears in background) */}
            <div className="absolute top-1/4 left-1/4 opacity-10 text-secondary-500 animate-spin-slow duration-[20s]">
                <Settings size={120} />
            </div>
            <div className="absolute bottom-1/4 right-1/4 opacity-10 text-secondary-500 animate-spin-reverse-slow duration-[20s]">
                <Settings size={180} />
            </div>


            {/* --- Main Content --- */}
            <div className="z-10 text-center max-w-2xl mx-auto">

                {/* Main Icon Animation */}
                <div className="relative inline-flex items-center justify-center mb-8">
                    {/* Large Gear */}
                    <Settings
                        size={64}
                        className="text-secondary-500 animate-[spin_4s_linear_infinite]"
                    />
                    {/* Small Gear */}
                    <Settings
                        size={40}
                        className="text-secondary-400 absolute -right-6 -bottom-2 animate-[spin_3s_linear_infinite_reverse]"
                    />
                </div>

                {/* Heading */}
                <h1 className="text-4xl font-extrabold leading-normal text-gray-900 sm:text-5xl">
                    Sorry, this page is <br />
                    <span className="text-secondary-600">
                        Under Maintenance
                    </span>
                </h1>

                {/* Subtext */}
                <p className="mt-6 text-lg text-gray-600 max-w-lg mx-auto leading-relaxed">
                    We&apos;re currently performing some scheduled updates to bring you a better experience.
                    <span className="block mt-2 font-medium text-secondary-600">
                        This page should be back online shortly!
                    </span>
                </p>
            </div>

        </div>
    )
}

export default UnderMaintenance