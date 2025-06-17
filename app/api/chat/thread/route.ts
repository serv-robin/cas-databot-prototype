import { NextResponse } from "next/server"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ASSISTANT_ID = process.env.ASSISTANT_ID

async function callOpenAI(url: string, method = "GET", body: any = null) {
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "OpenAI-Beta": "assistants=v2",
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function POST() {
  try {
    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ error: "Missing OpenAI configuration" }, { status: 500 })
    }

    const thread = await callOpenAI("https://api.openai.com/v1/threads", "POST")

    return NextResponse.json({ threadId: thread.id })
  } catch (error) {
    console.error("Failed to create thread:", error)
    return NextResponse.json({ error: "Failed to create conversation thread" }, { status: 500 })
  }
}
