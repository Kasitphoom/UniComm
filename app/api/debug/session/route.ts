import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * @swagger
 * /api/debug/session:
 *   get:
 *     summary: Get current authenticated server session (debug)
 *     tags:
 *       - Debug
 *     responses:
 *       200:
 *         description: Session returned successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ session })
}
