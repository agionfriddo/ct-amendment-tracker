import { NextResponse } from "next/server";
import { ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getServerSession } from "next-auth";
import { client } from "../../utils/dynamoClient";

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch data from DynamoDB
    const command = new ScanCommand({
      TableName: "2025-house-amendments",
    });

    const result = await client.send(command);

    // Transform the DynamoDB items to a more usable format
    const amendments =
      result.Items?.map((item) => ({
        billNumber: item.billNumber.S,
        date: item.date.S,
        lcoLink: item.lcoLink.S,
        billLink: item.billLink.S,
        lcoNumber: item.lcoNumber.S,
        calNumber: item.calNumber.S,
        summary: item.summary?.S || null,
        updatedAt: item.updatedAt?.S || null,
      })) || [];

    return NextResponse.json(amendments);
  } catch (error) {
    console.error("Error fetching house amendments:", error);
    return NextResponse.json(
      { error: "Failed to fetch house amendments" },
      { status: 500 }
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

    const { lcoNumber, summary } = await request.json();

    if (!lcoNumber) {
      return NextResponse.json(
        { error: "LCO number is required" },
        { status: 400 }
      );
    }

    // Update the amendment in DynamoDB
    const command = new UpdateItemCommand({
      TableName: "2025-house-amendments",
      Key: {
        lcoNumber: { S: lcoNumber },
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
      message: "Amendment updated successfully",
      amendment: result.Attributes,
    });
  } catch (error) {
    console.error("Error updating house amendment:", error);
    return NextResponse.json(
      { error: "Failed to update house amendment" },
      { status: 500 }
    );
  }
}
