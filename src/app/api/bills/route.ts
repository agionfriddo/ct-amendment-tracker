import { NextResponse } from "next/server";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { getServerSession } from "next-auth";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await getServerSession();
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch bills from DynamoDB
    const command = new ScanCommand({
      TableName: "2025-bills",
    });

    const result = await client.send(command);

    // Transform DynamoDB items to Bill objects
    const bills =
      result.Items?.map((item) => ({
        billNumber: item.billNumber.S || "",
        billLink: item.billLink.S || "",
        pdfLinks: item.pdfLinks.SS || [],
      })) || [];

    return new NextResponse(JSON.stringify(bills), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch bills" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
