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

function joinFragmentedTLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let currentTLine = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // If this is a new T-line, store any previous T-line and start a new one
    if (line.match(/^T\d+/)) {
      if (currentTLine) {
        result.push(currentTLine);
      }
      currentTLine = line;
    }
    // If we're building a T-line and this line ends with a number, append and complete it
    else if (currentTLine && line.match(/\d+$/)) {
      currentTLine += " " + line;
      result.push(currentTLine);
      currentTLine = "";
    }
    // If we're building a T-line and this isn't a new T-line, append it
    else if (currentTLine) {
      currentTLine += " " + line;
    }
    // If we're not building a T-line, just add the line as is
    else {
      result.push(line);
    }
  }

  // Add any remaining T-line
  if (currentTLine) {
    result.push(currentTLine);
  }

  return result.join("\n");
}

function padNumber(num: string): string {
  // Add 8 spaces after the number for alignment
  return num.padEnd(num.length + 8);
}

function indentTLine(line: string): string {
  // Add the same amount of spaces as the number padding
  return "        " + line;
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
    const textWithJoinedTLines = joinFragmentedTLines(textWithoutBlankLines);
    const textWithReorderedNumbers =
      moveEndingNumbersToStart(textWithJoinedTLines);

    return NextResponse.json({ text: textWithReorderedNumbers });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
