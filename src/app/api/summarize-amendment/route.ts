import { NextRequest, NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const { amendmentText, billText } = await request.json();

    if (!amendmentText || !billText) {
      return NextResponse.json(
        { error: "Both amendment text and bill text are required" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Please analyze this legislative amendment and explain its effect on the original bill. Here's the amendment text:

${amendmentText}

And here's the original bill text:

${billText}

Please structure your response in these sections:
1. Amendment Summary: A brief overview of what the amendment does
2. Key Changes: List the specific modifications being made to the bill
3. Impact Analysis: Explain how these changes would affect the bill's implementation or intent`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return NextResponse.json({ summary: content.text });
  } catch (error) {
    console.error("Error generating amendment summary:", error);
    return NextResponse.json(
      { error: "Failed to generate amendment summary" },
      { status: 500 }
    );
  }
}
