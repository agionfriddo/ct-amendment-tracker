import { NextResponse } from "next/server";
import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
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
        summary: item.summary?.S || null,
        updatedAt: item.updatedAt?.S || null,
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

export async function PATCH(request: Request) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { billNumber, summary } = await request.json();

    if (!billNumber) {
      return NextResponse.json(
        { error: "Bill number is required" },
        { status: 400 }
      );
    }

    // Update the bill in DynamoDB
    const command = new UpdateItemCommand({
      TableName: "2025-bills",
      Key: {
        billNumber: { S: billNumber },
      },
      UpdateExpression: "SET summary = :summary, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":summary": { S: summary || "" },
        ":updatedAt": { S: new Date().toISOString() },
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await client.send(command);

    return NextResponse.json({
      message: "Bill updated successfully",
      bill: result.Attributes,
    });
  } catch (error) {
    console.error("Error updating bill:", error);
    return NextResponse.json(
      { error: "Failed to update bill" },
      { status: 500 }
    );
  }
}
