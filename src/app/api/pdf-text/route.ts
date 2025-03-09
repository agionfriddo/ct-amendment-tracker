import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import pdfParse from "pdf-parse";

function removeTextBeforeAct(text: string): string {
  // Match "AN ACT" with any number of spaces between words
  const match = text.match(/AN\s+ACT/i);
  if (match) {
    const index = text.indexOf(match[0]);
    return text.substring(index);
  }
  return text;
}

function normalizeSpaces(text: string): string {
  // Split into lines, process each line, then rejoin
  return text
    .split("\n")
    .map((line) =>
      // Replace tabs and multiple spaces with a single space and trim
      line.replace(/\s+/g, " ").trim()
    )
    .join("\n")
    .trim();
}

function removeBlankLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function padNumber(num: string): string {
  // Pad to width of 6 (3 for number, 3 for spacing)
  return num.padStart(3).padEnd(6);
}

function indentTLine(line: string): string {
  // Match the fixed width used in padNumber
  return "      " + line;
}

function moveEndingNumbersToStart(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      // Indent T-lines with the same spacing
      if (line.match(/^T\d+/)) {
        return indentTLine(line);
      }

      // Match either a standalone number or a number after text-hyphen at the end of the line
      const match = line.match(
        /^(.*?)(?:\s+(\d+(?:,\d+)*)|\s+\S+-(\d+(?:,\d+)*))$/
      );
      if (match) {
        // The number will be in either group 2 (standalone) or group 3 (after hyphen)
        const number = match[2] || match[3];
        // The text is always in group 1
        return `${padNumber(number)}${match[1]}`;
      }
      return line;
    })
    .join("\n");
}

function removeNonSequentialLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let expectedNumber = 1;

  for (const line of lines) {
    // Keep T-lines
    if (line.match(/^\s*T\d+/)) {
      result.push(line);
      continue;
    }

    // Check if line starts with a number (after possible spaces)
    const numberMatch = line.match(/^\s*(\d+)/);
    if (numberMatch) {
      const lineNumber = parseInt(numberMatch[1], 10);
      // Only keep the line if it matches the expected sequence
      if (lineNumber === expectedNumber) {
        result.push(line);
        expectedNumber++;
      }
    }
  }

  return result.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      );
    }

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent: agent,
    });

    const data = await pdfParse(response.data);
    const textWithoutPrefix = removeTextBeforeAct(data.text);
    const normalizedText = normalizeSpaces(textWithoutPrefix);
    const textWithoutBlankLines = removeBlankLines(normalizedText);
    const textWithReorderedNumbers = moveEndingNumbersToStart(
      textWithoutBlankLines
    );
    const textWithSequentialLines = removeNonSequentialLines(
      textWithReorderedNumbers
    );

    return NextResponse.json({ text: textWithSequentialLines });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
