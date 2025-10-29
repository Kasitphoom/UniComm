import prisma from "@/lib/prisma-main"
import { NextRequest, NextResponse } from "next/server"

export const POST = async (request: NextRequest) => {
    try {
        const { token, newPassword, email } = await request.json()

        // find reference by token
        const reference = await prisma.references.findUnique({
            where: { id: token },
        })

        if (!reference || reference.purpose !== 'PASSWORD_RESET' || reference.expiresAt < new Date()) {
            return NextResponse.json({ message: 'Invalid or expired token' }, { status: 400 })
        }

        // check if email and reference refEmails match
        if (!reference.refEmails.includes(email)) {
            return NextResponse.json({ message: 'Email does not match the reference' }, { status: 400 })
        }
        
        // find user by email
        const user = await prisma.user.findUnique({
            where: { email: email },
        })

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 })
        }

        // update user's password
        const bcrypt = await import('bcryptjs')
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { email: email },
            data: { password: hashedPassword },
        })

        return NextResponse.json({ message: 'Reset password successfully' }, { status: 200 })
    } catch (error) {
        console.error('Error resetting password:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}