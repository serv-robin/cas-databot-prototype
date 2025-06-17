import { NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ASSISTANT_ID = process.env.ASSISTANT_ID

export async function GET() {
  return NextResponse.json({
    configured: !!(OPENAI_API_KEY && ASSISTANT_ID),
  })
}
