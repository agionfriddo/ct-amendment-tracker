import { NextRequest, NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Bill text is required" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Please provide a clear and concise summary of this legislative bill. Focus on the main objectives, key provisions, and any significant changes it proposes. Here's the bill text:

${text}

Please structure your response in these sections:
1. Main Objective
2. Key Provisions
3. Notable Changes or Requirements
4. Impact Summary`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return NextResponse.json({ summary: content.text });
  } catch (error) {
    console.error("Error generating bill summary:", error);
    return NextResponse.json(
      { error: "Failed to generate bill summary" },
      { status: 500 }
    );
  }
}
