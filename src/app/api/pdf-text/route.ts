import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import pdfParse from "pdf-parse";

/**
 * Improves the formatting of extracted PDF text, specifically for legislative documents.
 * - Moves line numbers from the end to the beginning of each line
 * - Ensures text appearing on the same line in the PDF remains on the same line
 * - Preserves indentation and alignment
 * - Handles specific formatting for legislative amendments (section headers, amendment titles, etc.)
 * - Fixes common formatting issues (spacing, punctuation, etc.)
 * - Properly formats quoted text and amendment titles
 *
 * @param text The raw text extracted from the PDF
 * @returns Formatted text with improved readability
 */
function improveTextFormatting(text: string): string {
  if (!text) return text;

  // Split the text into lines and trim whitespace
  let lines = text.split("\n").map((line) => line.trim());
  let formattedLines: string[] = [];

  // Regular expression to identify line numbers at the end of lines
  const lineNumberRegex = /\s+(\d+)$/;

  // Regular expression to identify district references (e.g., "86th Dist.")
  const districtReferenceRegex = /\d+(st|nd|rd|th)\s+Dist\.$/i;

  // Regular expression to identify partial district references (just the number)
  const partialDistrictNumberRegex = /,\s*\d+$/;

  // Regular expression to identify ordinal suffixes on their own line
  const ordinalSuffixRegex = /^(st|nd|rd|th)$/i;

  // Regular expression to identify "Dist." on its own line
  const distLineRegex = /^Dist\.$/i;

  // Regular expression to identify line numbers at the beginning of lines
  const startingLineNumberRegex = /^(\d+)\s+/;

  // Regular expression to identify section headers
  const sectionHeaderRegex = /^(Section|Sec\.)\s+\d+\./i;

  // Regular expression to identify amendment titles
  const amendmentTitleRegex = /^(SB|HB)\s+\d+\s+Amendment/i;

  // Regular expression to identify LCO numbers
  const lcoNumberRegex = /^\d+\s+LCO\s+No\./i;

  // Regular expression to identify page numbers
  const pageNumberRegex = /^\d+\s+of\s+\d+$/;

  // Regular expression to identify quoted text
  const quotedTextRegex = /"([^"]+)"/g;

  // Regular expression to identify amendment act titles
  const actTitleRegex = /"AN ACT\s+[^"\.]+\."/i;

  // Regular expression to identify congressperson references
  const congresspersonRegex = /^(REP\.|SEN\.)\s+[A-Z]+/i;

  // First pass: Join split district references
  for (let i = 0; i < lines.length - 2; i++) {
    // Check for pattern: "SEN. NAME, 11" followed by "th" followed by "Dist."
    if (
      congresspersonRegex.test(lines[i]) &&
      partialDistrictNumberRegex.test(lines[i]) &&
      ordinalSuffixRegex.test(lines[i + 1]) &&
      distLineRegex.test(lines[i + 2])
    ) {
      // Join the three lines
      lines[i] = `${lines[i]}${lines[i + 1]} ${lines[i + 2]}`;
      // Mark the next two lines to be skipped
      lines[i + 1] = "";
      lines[i + 2] = "";
    }
  }

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip empty lines
    if (!line) {
      formattedLines.push("");
      continue;
    }

    // Check if the line already has a line number at the beginning
    const startingLineNumberMatch = line.match(startingLineNumberRegex);
    if (startingLineNumberMatch) {
      formattedLines.push(line);
      continue;
    }

    // Check if this is a congressperson reference with district info
    if (congresspersonRegex.test(line) || districtReferenceRegex.test(line)) {
      formattedLines.push(line);
      continue;
    }

    // Check if the line has a line number at the end (but not a district reference)
    const lineNumberMatch = line.match(lineNumberRegex);
    if (lineNumberMatch && !districtReferenceRegex.test(line)) {
      const lineNumber = lineNumberMatch[1];
      // Remove the line number from the end
      let textContent = line.replace(lineNumberRegex, "").trim();

      // Add the line number to the beginning
      formattedLines.push(`${lineNumber} ${textContent}`);
    }
    // Handle special formatting cases
    else if (sectionHeaderRegex.test(line)) {
      // Add extra spacing before section headers
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ""
      ) {
        formattedLines.push("");
      }
      formattedLines.push(line);
    } else if (amendmentTitleRegex.test(line)) {
      // Format amendment titles with extra spacing
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ""
      ) {
        formattedLines.push("");
      }
      formattedLines.push(line);
      formattedLines.push("");
    } else if (lcoNumberRegex.test(line) || pageNumberRegex.test(line)) {
      // Handle LCO numbers and page numbers
      formattedLines.push(line);
    } else if (actTitleRegex.test(line)) {
      // Format act titles with proper spacing and capitalization
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ""
      ) {
        formattedLines.push("");
      }
      formattedLines.push(line.toUpperCase());
      formattedLines.push("");
    } else {
      // Check if this line might be a continuation of the previous line
      const previousLine =
        formattedLines.length > 0
          ? formattedLines[formattedLines.length - 1]
          : "";
      const previousHasLineNumber = previousLine.match(startingLineNumberRegex);

      // If the previous line has a line number and this line doesn't look like a header,
      // it might be a continuation
      if (
        previousHasLineNumber &&
        !line.match(/^[A-Z\s]+$/) &&
        !line.match(/^\d+\./) &&
        !sectionHeaderRegex.test(line) &&
        !amendmentTitleRegex.test(line) &&
        !lcoNumberRegex.test(line) &&
        !pageNumberRegex.test(line) &&
        previousLine.length + line.length < 120 // Avoid creating extremely long lines
      ) {
        // Append to the previous line with proper spacing
        formattedLines[formattedLines.length - 1] += ` ${line}`;
      } else {
        formattedLines.push(line);
      }
    }
  }

  // Additional processing for legislative document formatting
  let result = formattedLines.join("\n");

  // Fix superscript formatting (e.g., "1st", "2nd", "3rd")
  result = result.replace(/(\d+)(st|nd|rd|th)\s+Dist\./gi, "$1$2 Dist.");

  // Fix spacing around punctuation
  result = result.replace(/\s+([.,;:)])/g, "$1");
  result = result.replace(/([({])\s+/g, "$1");

  // Remove excessive blank lines (more than 2 consecutive)
  result = result.replace(/\n{3,}/g, "\n\n");

  // Format quoted text blocks with proper indentation
  result = result.replace(quotedTextRegex, (match, p1) => {
    return `"${p1.trim()}"`;
  });

  // Format amendment titles in all caps
  result = result.replace(/(AN ACT[^\.]+\.)/gi, (match) => {
    return match.toUpperCase();
  });

  // Ensure consistent spacing after periods in sentences
  result = result.replace(/\.(\w)/g, ". $1");

  // Fix indentation for quoted text blocks
  result = result.replace(/^"(.+)"$/gm, (match, p1) => {
    if (p1.includes("\n")) {
      return `"${p1
        .split("\n")
        .map((line: string) => line.trim())
        .join("\n  ")}"`;
    }
    return match;
  });

  // Ensure proper spacing for subsections and numbered items
  result = result.replace(/(\d+)\s*\)\s*/g, "$1) ");

  // Fix spacing for inclusive ranges
  result = result.replace(/(\w+)\s*-\s*(\w+)/g, "$1-$2");

  // Ensure proper spacing after commas in lists
  result = result.replace(/,(\w)/g, ", $1");

  return result;
}

export async function GET(request: NextRequest) {
  console.log("PDF text extraction API called");
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  try {
    console.log(`Fetching PDF from URL: ${url}`);

    // Create a custom HTTPS agent that ignores SSL certificate errors
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Fetch the PDF using axios with SSL verification disabled
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      httpsAgent: httpsAgent,
    });

    // Get the PDF data as Buffer (pdf-parse expects a Buffer)
    const pdfBuffer = Buffer.from(response.data);
    console.log(`PDF fetched, size: ${pdfBuffer.length} bytes`);

    // Extract text from PDF using pdf-parse
    const data = await pdfParse(pdfBuffer);
    const extractedText = data.text;

    // Apply formatting improvements
    const formattedText = improveTextFormatting(extractedText);

    console.log(
      `Extracted ${formattedText.length} characters of text from PDF`
    );

    return NextResponse.json({
      text: formattedText,
      numpages: data.numpages,
      info: data.info,
    });
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    return NextResponse.json(
      {
        error: "Failed to extract text from PDF",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
