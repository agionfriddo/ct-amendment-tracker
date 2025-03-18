import { ScanCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import * as dotenv from "dotenv";
import { client } from "../src/app/api/utils/dynamoClient";

// Load environment variables
dotenv.config();

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

async function writeAmendment(
  amendment: Amendment,
  tableName: string,
  commit: boolean = false
): Promise<boolean> {
  if (!commit) {
    return true;
  }

  try {
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        billNumber: { S: amendment.billNumber },
        date: { S: amendment.date },
        lcoLink: { S: amendment.lcoLink },
        billLink: { S: amendment.billLink },
        lcoNumber: { S: amendment.lcoNumber },
        calNumber: { S: amendment.calNumber },
      },
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error(
      `Error writing amendment ${amendment.billNumber} to ${tableName}:`,
      error
    );
    return false;
  }
}

async function main(commit: boolean = false) {
  if (!commit) {
    console.log("Running in dry-run mode. No writes will be performed.");
  }

  const senateTableName = "2025-senate-amendments";
  const houseTableName = "2025-house-amendments";

  // Fetch amendments
  console.log("Fetching Senate amendments...");
  const senateAmendments = await fetchAmendments("senate_amendments");
  console.log(`Found ${senateAmendments.length} total Senate amendments`);

  console.log("Fetching House amendments...");
  const houseAmendments = await fetchAmendments("house_amendments");
  console.log(`Found ${houseAmendments.length} total House amendments`);

  // Filter for 2025 amendments
  const senate2025 = senateAmendments.filter((amendment) =>
    amendment.date.endsWith("2025")
  );
  const house2025 = houseAmendments.filter((amendment) =>
    amendment.date.endsWith("2025")
  );

  console.log(`Found ${senate2025.length} Senate amendments from 2025`);
  console.log(`Found ${house2025.length} House amendments from 2025`);

  // Migrate Senate amendments
  console.log("\nMigrating Senate amendments...");
  for (const amendment of senate2025) {
    const success = await writeAmendment(amendment, senateTableName, commit);
    if (success) {
      console.log(
        `${commit ? "Migrated" : "[DRY RUN] Would migrate"} Senate amendment ${
          amendment.lcoNumber
        }`
      );
    } else {
      console.log(`Failed to migrate Senate amendment ${amendment.lcoNumber}`);
    }
  }

  // Migrate House amendments
  console.log("\nMigrating House amendments...");
  for (const amendment of house2025) {
    const success = await writeAmendment(amendment, houseTableName, commit);
    if (success) {
      console.log(
        `${commit ? "Migrated" : "[DRY RUN] Would migrate"} House amendment ${
          amendment.lcoNumber
        }`
      );
    } else {
      console.log(`Failed to migrate House amendment ${amendment.lcoNumber}`);
    }
  }

  console.log("\nMigration completed!");
  console.log(
    `Total amendments migrated: ${senate2025.length + house2025.length}`
  );
  console.log(`- Senate amendments: ${senate2025.length}`);
  console.log(`- House amendments: ${house2025.length}`);
}

// Run the script
if (require.main === module) {
  main(process.argv.includes("--commit")).catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
