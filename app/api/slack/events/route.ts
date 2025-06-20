// /Users/robintitus/Desktop/Servant/v0/cas-databot-prototype/app/api/slack/events/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import OpenAI from "openai";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Handle URL verification for Slack
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge });
    }

    // Handle app mentions
    if (body.type === 'event_callback' && body.event.type === 'app_mention') {
      const { event } = body;
      
      // Extract query (remove bot mention)
      const query = event.text.replace(/<@[^>]+>/g, '').trim();
      
      if (!query) {
        await slackClient.chat.postMessage({
          channel: event.channel,
          text: "👋 Hi! I'm your Data Dictionary assistant. Ask me about any data field, table, or source. For example: 'What is customer_id?' or 'Where can I find revenue data?'",
          thread_ts: event.ts
        });
        return NextResponse.json({ status: 'ok' });
      }

      // Send typing indicator
      await slackClient.chat.postMessage({
        channel: event.channel,
        text: "🤔 Let me look that up for you...",
        thread_ts: event.ts
      });

      try {
        // Create or get thread for this channel/user combo
        const threadId = `slack_${event.channel}_${event.user}`;
        
        // Create a new thread if none exists (simplified for demo)
        const thread = await openai.beta.threads.create({});
        
        // Add user message to thread
        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: query,
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
          assistant_id: process.env.OPENAI_ASSISTANT_ID!,
        });

        // Poll for completion (simplified polling)
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
            
            // Format response for Slack
            const blocks = [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: response
                }
              }
            ];

            // Add helpful buttons if response contains certain keywords
            if (response.toLowerCase().includes('source:') || response.toLowerCase().includes('table:')) {
              blocks.push({
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "📊 More Details"
                    },
                    action_id: "more_details",
                    value: query
                  }
                ]
              });
            }

            await slackClient.chat.postMessage({
              channel: event.channel,
              thread_ts: event.ts,
              blocks: blocks
            });
          }
        } else {
          throw new Error(`Assistant run failed with status: ${runStatus.status}`);
        }

      } catch (aiError) {
        console.error('OpenAI error:', aiError);
        await slackClient.chat.postMessage({
          channel: event.channel,
          text: "Sorry, I'm having trouble processing your request right now. Please try again in a moment.",
          thread_ts: event.ts
        });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Slack event error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}