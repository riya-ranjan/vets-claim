import { initObservability } from "@/app/observability";
import { StreamingTextResponse } from "ai";
import { ChatMessage, MessageContent, OpenAI } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { createChatEngine } from "./engine/chat";
import { LlamaIndexStream } from "./llamaindex-stream";

import { FunctionTool, OpenAIAgent } from "llamaindex";

initObservability();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYS = `
----------
INSTRUCTIONS: You are an assistant helping a veteran fill out their VA Form 21-526EZ for disability claims. They have just provided you with the information above the dashed line. You have two goals:


1. Determine if the veteran is eligible for benefits
2. Answer any questions the veteran has about the diability claim process


To determine if the veteran is eligible for benefits, you must ask or confirm with them the following facts:


1. They enlisted after September 7, 1980, or entered active duty after October 16, 1981
2. They have a current disability
3. Their disability was caused by some event, injury, or exposure during service
4. When their disability began


Here is a sample conversation you might have with a user named John Doe, where your responses are denoted by \"Chatbot\": 


User: \"\"I am John Doe.\"\"
Chatbot: \"\"Hello John Doe, what can I help you with today?\"\"
User: \"\"I suffered a back injury during combat and want to file a VA claim.\"\"
Chatbot: \"\"I'm sorry to hear that. Let's first confirm that you are eligible for benefits. Did you enlist after September 7, 1980 or enter active duty after October 16, 1981?\"\"
User: \"\"Yes.\"\"
Chatbot: \"\"Can you tell me more about your injury?\"\"
User: \"\"I jumped from a truck during the Gulf War and heard a pop from my lower back. The pain is flaring up again and it has been unbearable. I can no longer bend down.\"\"
Chatbot: \"\"It sounds like you are suffering from a herniated lumbar disc from your service in the Gulf War. Is this correct?\"\"
User: \"\"Yes.\"\"
Chatbot: \"\"When did the pain begin?\"\"
etc...
----------
After the following dashed line is the user's most recent message.
----------
User: `

const convertMessageContent = (
  textMessage: string,
  imageUrl: string | undefined,
): MessageContent => {
  if (!imageUrl) return textMessage;
  return [
    {
      type: "text",
      text: SYS + textMessage,
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    },
  ];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, data }: { messages: ChatMessage[]; data: any } = body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return NextResponse.json(
        {
          error:
            "messages are required in the request body and the last message must be from the user",
        },
        { status: 400 },
      );
    }

    // const agent = new OpenAIAgent({
    //   //model: (process.env.MODEL as any) ?? "gpt-3.5-turbo",
    //   //maxTokens: 512,
    //   systemPrompt = SYSTEMPROMPT,
    //   verbose: true,
    // }); 

    const agent = new OpenAIAgent({
      systemPrompt: SYS,
      verbose: true,
    });

    const response1 = await agent.chat({
      message: SYS + userMessage.content,
    });

    // Assuming `chat` is an asynchronous method that returns a Promise.
    //const response1 = await agent.chat("What was Lyft's revenue growth in 2021?");
    // console.log(response.toString());

    const llm = new OpenAI({
      model: (process.env.MODEL as any) ?? "gpt-3.5-turbo",
      maxTokens: 512,
    });

    const chatEngine = await createChatEngine(llm);

    // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
    const userMessageContent = convertMessageContent(
      userMessage.content,
      data?.imageUrl,
    );

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response2 = await chatEngine.chat({
      message: SYS + userMessageContent,
      chatHistory: messages,
      stream: true,
    });

    // Transform LlamaIndex stream to Vercel/AI format
    const { stream, data: streamData } = LlamaIndexStream(response2, {
      parserOptions: {
        image_url: data?.imageUrl,
      },
    });

    // Return a StreamingTextResponse, which can be consumed by the Vercel/AI client
    
    //return response1;
    return new StreamingTextResponse(stream, {}, streamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      {
        status: 500,
      },
    );
  }
}
