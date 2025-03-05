import {
  DynamoDBClient,
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

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

function generateId(date: string, lcoNumber: string): string {
  const year = new Date(date).getFullYear();
  return `${year}-${lcoNumber}`;
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

async function migrateAmendment(
  amendment: Amendment,
  targetTable: string,
  commit: boolean
): Promise<boolean> {
  try {
    const id = generateId(amendment.date, amendment.lcoNumber);

    if (!commit) {
      console.log(`[DRY RUN] Would migrate amendment ${id} to ${targetTable}`);
      console.log("Data:", {
        id,
        ...amendment,
      });
      return true;
    }

    // Write to new table
    const putCommand = new PutItemCommand({
      TableName: targetTable,
      Item: {
        id: { S: id },
        billNumber: { S: amendment.billNumber },
        date: { S: amendment.date },
        lcoLink: { S: amendment.lcoLink },
        billLink: { S: amendment.billLink },
        lcoNumber: { S: amendment.lcoNumber },
        calNumber: { S: amendment.calNumber },
      },
    });

    await client.send(putCommand);
    console.log(`Successfully migrated amendment ${id} to ${targetTable}`);
    return true;
  } catch (error) {
    console.error(`Error migrating amendment ${amendment.billNumber}:`, error);
    return false;
  }
}

async function main(commit: boolean = false) {
  if (!commit) {
    console.log("Running in dry-run mode. No changes will be made.");
  }

  // Migrate House amendments
  console.log("\nMigrating House amendments...");
  const houseAmendments = await fetchAmendments("house_amendments");
  console.log(`Found ${houseAmendments.length} House amendments to migrate`);

  for (const amendment of houseAmendments) {
    await migrateAmendment(amendment, "house-amendments", commit);
  }

  // Migrate Senate amendments
  console.log("\nMigrating Senate amendments...");
  const senateAmendments = await fetchAmendments("senate_amendments");
  console.log(`Found ${senateAmendments.length} Senate amendments to migrate`);

  for (const amendment of senateAmendments) {
    await migrateAmendment(amendment, "senate-amendments", commit);
  }

  console.log("\nMigration completed!");
}

// Run the script
main(process.argv.includes("--commit")).catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
