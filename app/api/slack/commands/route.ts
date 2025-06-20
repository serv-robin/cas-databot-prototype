// /Users/robintitus/Desktop/Servant/v0/cas-databot-prototype/app/api/slack/commands/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import OpenAI from "openai";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const command = formData.get('command') as string;
    const text = formData.get('text') as string;
    const channelId = formData.get('channel_id') as string;
    const userId = formData.get('user_id') as string;
    const responseUrl = formData.get('response_url') as string;

    // Handle different slash commands
    let query = '';
    let quickText = '';
    
    switch (command) {
      case '/data-search':
        query = `Search for data fields related to: ${text}`;
        quickText = `🔍 Searching for fields related to "${text}"...`;
        break;
      case '/data-define':
        query = `What is the definition of: ${text}`;
        quickText = `📖 Looking up definition of "${text}"...`;
        break;
      case '/data-source':
        query = `Where can I find data for: ${text}`;
        quickText = `📍 Finding data sources for "${text}"...`;
        break;
      default:
        query = text || 'Help me understand the data dictionary';
        quickText = `🤔 Processing your request...`;
    }

    // Quick acknowledgment (must respond within 3 seconds)
    const quickResponse = {
      response_type: 'in_channel',
      text: quickText
    };

    // Process in background
    setTimeout(async () => {
      try {
        // Create thread
        const thread = await openai.beta.threads.create({});
        
        // Add user message
        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: query,
        });

        // Run assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
          assistant_id: process.env.OPENAI_ASSISTANT_ID!,
        });

        // Poll for completion
        let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        let attempts = 0;
        
        while ((runStatus.status === 'running' || runStatus.status === 'queued') && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
          attempts++;
        }

        if (runStatus.status === 'completed') {
          const messages = await openai.beta.threads.messages.list(thread.id);
          const lastMessage = messages.data[0];
          
          if (lastMessage.content[0].type === 'text') {
            const response = lastMessage.content[0].text.value;
            
            // Format response
            const blocks = [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: response
                }
              }
            ];

            // Send follow-up response
            await fetch(responseUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                response_type: 'in_channel',
                replace_original: true,
                blocks: blocks
              })
            });
          }
        } else {
          // Send error follow-up
          await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              response_type: 'in_channel',
              replace_original: true,
              text: "Sorry, I couldn't process your request. Please try again."
            })
          });
        }

      } catch (error) {
        console.error('Background processing error:', error);
        await fetch(responseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            response_type: 'in_channel',
            replace_original: true,
            text: "Sorry, something went wrong processing your request."
          })
        });
      }
    }, 0);

    return NextResponse.json(quickResponse);
  } catch (error) {
    console.error('Slash command error:', error);
    return NextResponse.json(
      { text: 'Sorry, something went wrong!' }, 
      { status: 500 }
    );
  }
}