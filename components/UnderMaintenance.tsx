import React from 'react'
import { Metadata } from 'next'
import { Settings } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Under Maintenance - UniComm',
    description: 'This page is currently under maintenance. We are working hard to bring you a better experience. Please check back soon!',
}

const UnderMaintenance = () => {
    return (
        <div className="h-full flex items-center justify-center">

            <div className="max-w-md w-full p-8 rounded-xl shadow-2xl text-center bg-secondary-500">

                <Settings size={48} className="mx-auto text-white opacity-80" />

                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Sorry, this page is
                </h1>
                <p className="mt-2 text-xl font-medium text-secondary-100">
                    Under Maintenance
                </p>

                <p className="mt-4 text-base text-white opacity-90">
                    We're working hard to bring you a better experience. We should be back online shortly!
                </p>

            </div>

        </div>
    )
}

export default UnderMaintenance