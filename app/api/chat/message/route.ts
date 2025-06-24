// /Users/robintitus/Desktop/Servant/v0/cas-databot-prototype/app/api/chat/message/route.ts
import { type NextRequest, NextResponse } from "next/server"

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

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY || !ASSISTANT_ID) {
      return NextResponse.json({ error: "Missing OpenAI configuration" }, { status: 500 })
    }

    const { threadId, message } = await request.json()

    if (!threadId || !message) {
      return NextResponse.json({ error: "Missing threadId or message" }, { status: 400 })
    }

    // Add user message to thread
    await callOpenAI(`https://api.openai.com/v1/threads/${threadId}/messages`, "POST", {
      role: "user",
      content: message,
    })

    // Create and run the assistant
    const run = await callOpenAI(`https://api.openai.com/v1/threads/${threadId}/runs`, "POST", {
      assistant_id: ASSISTANT_ID,
    })

    // Poll for completion
    let runStatus = await callOpenAI(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}`)

    const maxWaitTime = 60000 // 60 seconds
    const startTime = Date.now()

    while (runStatus.status === "queued" || runStatus.status === "in_progress") {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error("Request timed out")
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2 seconds
      runStatus = await callOpenAI(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}`)
    }

    if (runStatus.status === "completed") {
      // Get the latest messages
      const messagesResponse = await callOpenAI(
        `https://api.openai.com/v1/threads/${threadId}/messages?limit=1&order=desc`,
      )

      if (messagesResponse.data && messagesResponse.data.length > 0) {
        const latestMessage = messagesResponse.data[0]
        let response = latestMessage.content[0].text.value

        // Remove citation patterns like 【4:2†source】
        response = response.replace(/【[\d:†\(\)\w\s\-\.]+】/g, '')

        return NextResponse.json({ response })
      } else {
        throw new Error("No response generated")
      }
    } else if (runStatus.status === "failed") {
      const errorMessage = runStatus.last_error?.message || "Run failed"
      throw new Error(`Assistant run failed: ${errorMessage}`)
    } else {
      throw new Error(`Unexpected run status: ${runStatus.status}`)
    }
  } catch (error) {
    console.error("Error processing message:", error)
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 })
  }
}
