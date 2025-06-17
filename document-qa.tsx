"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Lightbulb, Loader2 } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isError?: boolean
}

const DocumentQA = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Check configuration and start conversation
    checkConfigurationAndStart()
  }, [])

  const checkConfigurationAndStart = async () => {
    try {
      const response = await fetch("/api/chat/status")
      const { configured } = await response.json()

      setIsConfigured(configured)

      if (configured) {
        await startNewConversation()
      }
    } catch (error) {
      console.error("Failed to check configuration:", error)
      setIsConfigured(false)
    }
  }

  const startNewConversation = async () => {
    try {
      console.log("Creating new conversation thread...")

      const response = await fetch("/api/chat/thread", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to create thread")
      }

      const { threadId: newThreadId } = await response.json()

      setThreadId(newThreadId)
      setMessages([
        {
          role: "assistant",
          content: "Hello! I'm here to help you with questions about your data warehouse. What would you like to know?",
          timestamp: new Date(),
        },
      ])

      console.log(`New thread created: ${newThreadId}`)
    } catch (error) {
      console.error("Failed to start conversation:", error)
      setMessages([
        {
          role: "assistant",
          content:
            "Sorry, I couldn't start the conversation. Please check your configuration and try refreshing the page.",
          timestamp: new Date(),
          isError: true,
        },
      ])
    }
  }

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || !threadId) return

    const userMessage: Message = {
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      console.log(`Processing message in thread ${threadId}: ${messageText.substring(0, 100)}...`)

      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          threadId,
          message: messageText,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const { response: assistantResponse } = await response.json()

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantResponse,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      console.log("Response generated successfully")
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = () => {
    sendMessage()
  }

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion)
  }

  // Suggested questions
  const suggestions = [
    "Where can I find customer data in my data warehouse?",
    "Can you explain to me what a schema is? I'm a business user.",
  ]

  // Show loading while checking configuration
  if (isConfigured === null) {
    return (
      <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Checking configuration...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show configuration error if not configured
  if (!isConfigured) {
    return (
      <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white">
        <div className="bg-red-600 text-white p-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold">Configuration Error</h1>
              <p className="text-red-100 text-sm">Missing OpenAI API key or Assistant ID</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Setup Required</h2>
            <div className="text-left bg-gray-50 p-4 rounded-lg max-w-md">
              <p className="text-sm text-gray-600 mb-2">Please set these environment variables in Vercel:</p>
              <code className="block bg-gray-100 p-2 rounded text-xs">
                {"OPENAI_API_KEY=your_key_here"}
                <br />
                {"ASSISTANT_ID=asst_your_id_here"}
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Note: These are server-only variables (no NEXT_PUBLIC_ prefix needed)
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white">
      {/* Logo Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800">CAS Databot(Beta)</h1>
          <div className="w-12 h-0.5 bg-blue-600 mx-auto mt-2"></div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : message.isError
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-gray-100 text-gray-800"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              <div className={`text-xs mt-1 ${message.role === "user" ? "text-blue-100" : "text-gray-500"}`}>
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Searching the data dictionary...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions - positioned above input */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-4 pb-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Try asking:</span>
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left p-2 bg-white border border-yellow-200 rounded hover:bg-yellow-100 transition-colors text-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-gray-50 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask a question about your data warehouse..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading || !threadId}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim() || !threadId}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {!threadId && isConfigured && (
          <div className="text-center text-sm text-red-600 mt-2">Connection failed. Please refresh the page.</div>
        )}
      </div>
    </div>
  )
}

export default DocumentQA