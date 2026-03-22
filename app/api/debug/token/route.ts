import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * @swagger
 * /api/debug/token:
 *   get:
 *     summary: Get decoded auth token for current request (debug)
 *     tags:
 *       - Debug
 *     responses:
 *       200:
 *         description: Token returned successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ token })
}
