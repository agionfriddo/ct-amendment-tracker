import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Create a custom https agent that ignores SSL certificate errors
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Use axios to fetch the PDF with the custom agent
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent,
      timeout: 30000, // 30 second timeout
    });

    // Get content type from response headers
    const contentType = response.headers["content-type"] || "application/pdf";

    return new NextResponse(response.data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Error proxying PDF:", error);

    let errorMessage = "Failed to fetch PDF";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    if (axios.isAxiosError(error)) {
      statusCode = error.response?.status || 500;
      errorMessage = `Failed to fetch PDF: ${error.message}`;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode }
    );
  }
}
