import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  GetItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import * as dotenv from "dotenv";
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

// Load environment variables
dotenv.config();

// Create an https agent that ignores SSL certificate issues
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

interface Amendment {
  billNumber: string;
  date: string;
  lcoLink: string;
  billLink: string;
  lcoNumber: string;
  calNumber: string;
}

async function fetchAmendments(tableName: string): Promise<Amendment[]> {
  try {
    const command = new ScanCommand({
      TableName: tableName,
    });

    const result = await client.send(command);

    return (
      result.Items?.map((item) => ({
        billNumber: item.billNumber.S || "",
        date: item.date.S || "",
        lcoLink: item.lcoLink.S || "",
        billLink: item.billLink.S || "",
        lcoNumber: item.lcoNumber.S || "",
        calNumber: item.calNumber.S || "",
      })) || []
    );
  } catch (error) {
    console.error(`Error fetching amendments from ${tableName}:`, error);
    return [];
  }
}

async function checkBillExists(
  tableName: string,
  billNumber: string
): Promise<boolean> {
  try {
    const command = new GetItemCommand({
      TableName: tableName,
      Key: {
        billNumber: { S: billNumber },
      },
    });

    const result = await client.send(command);
    return !!result.Item;
  } catch (error) {
    console.error(
      `Error checking if bill ${billNumber} exists in ${tableName}:`,
      error
    );
    return false;
  }
}

async function writeBillToDynamoDB(
  bill: {
    pdfLinks: string[];
    billNumber: string;
    billLink: string;
  },
  commit: boolean = true
): Promise<boolean> {
  try {
    // Check if bill already exists using the billNumber
    const exists = await checkBillExists("2025-bills", bill.billNumber);
    if (exists) {
      console.log(
        `Bill ${bill.billNumber} already exists in 2025-bills table, skipping...`
      );
      return true;
    }

    if (!commit) {
      console.log(
        `[DRY RUN] Would write bill ${bill.billNumber} to 2025-bills table`
      );
      return true;
    }

    const command = new PutItemCommand({
      TableName: "2025-bills",
      Item: {
        billNumber: { S: bill.billNumber },
        pdfLinks: { SS: bill.pdfLinks },
        billLink: { S: bill.billLink },
        dateScraped: { S: new Date().toISOString() },
      },
      ConditionExpression: "attribute_not_exists(billNumber)",
    });

    await client.send(command);
    return true;
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      console.log(
        `Bill ${bill.billNumber} was just written to 2025-bills table by another process, skipping...`
      );
      return true;
    }
    console.error(
      `Error writing bill ${bill.billNumber} to 2025-bills table:`,
      error
    );
    return false;
  }
}

async function scrapeBillText(
  billLink: string,
  billNumber: string
): Promise<{
  pdfLinks: string[];
  billNumber: string | null;
  billLink: string | null;
} | null> {
  try {
    // Fetch the bill page with SSL verification disabled
    const response = await axios.get(billLink, {
      httpsAgent,
    });
    const $ = cheerio.load(response.data);

    // 2. Find the table with the header "Text of Bill"
    const textOfBillTable = $('table:contains("Text of Bill")');
    if (!textOfBillTable.length) {
      console.log(`No "Text of Bill" table found for bill ${billLink}`);
      return null;
    }

    // 3. Get the PDF links from the table
    const pdfLinks = textOfBillTable
      .find('a[href*=".PDF"]')
      .map((index, element) => {
        const href = $(element).attr("href");
        return href ? new URL(href, billLink).toString() : null;
      })
      .get();

    // 4. Return an object with the PDF links as an array and the bill number as a string
    return {
      pdfLinks,
      billNumber,
      billLink,
    };
  } catch (error) {
    console.error(`Error scraping bill text from ${billLink}:`, error);
    return null;
  }
}

async function main(commit: boolean = false) {
  if (!commit) {
    console.log("Running in dry-run mode. No writes will be performed.");
  }

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Process House amendments
  console.log("Fetching House amendments...");
  const houseAmendments = await fetchAmendments("2025-house-amendments");
  console.log(`Found ${houseAmendments.length} House amendments`);

  for (const amendment of houseAmendments) {
    console.log(`Processing House amendment for bill ${amendment.billNumber}`);
    const bill = await scrapeBillText(amendment.billLink, amendment.billNumber);
    if (bill && bill.pdfLinks.length > 0) {
      const success = await writeBillToDynamoDB(
        {
          pdfLinks: bill.pdfLinks,
          billNumber: bill.billNumber!,
          billLink: bill.billLink!,
        },
        commit
      );
      if (success) {
        console.log(
          `${commit ? "Successfully stored" : "[DRY RUN] Would store"} bill ${
            amendment.billNumber
          } in 2025-bills table\n`
        );
      } else {
        console.log(
          `Failed to ${commit ? "store" : "validate"} bill ${
            amendment.billNumber
          } in 2025-bills table`
        );
      }
    } else {
      console.log(`Failed to scrape text for bill ${amendment.billNumber}`);
    }
    await delay(2000);
  }

  // Process Senate amendments
  console.log("\nFetching Senate amendments...");
  const senateAmendments = await fetchAmendments("2025-senate-amendments");
  console.log(`Found ${senateAmendments.length} Senate amendments`);

  for (const amendment of senateAmendments) {
    console.log(`Processing Senate amendment for bill ${amendment.billNumber}`);
    const bill = await scrapeBillText(amendment.billLink, amendment.billNumber);
    if (bill && bill.pdfLinks.length > 0) {
      const success = await writeBillToDynamoDB(
        {
          pdfLinks: bill.pdfLinks,
          billNumber: bill.billNumber!,
          billLink: bill.billLink!,
        },
        commit
      );
      if (success) {
        console.log(
          `${commit ? "Successfully stored" : "[DRY RUN] Would store"} bill ${
            amendment.billNumber
          } in 2025-bills table`
        );
      } else {
        console.log(
          `Failed to ${commit ? "store" : "validate"} bill ${
            amendment.billNumber
          } in 2025-bills table`
        );
      }
    } else {
      console.log(`Failed to scrape text for bill ${amendment.billNumber}`);
    }
    await delay(500);
  }

  console.log("\nScraping process completed!");
}

// Run the script
main(process.argv.includes("--commit")).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
