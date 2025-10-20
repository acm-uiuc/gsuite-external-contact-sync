import { handler } from "./sync.js";

// Mock EventBridge event
const mockEvent = {
  version: "0",
  id: "test-event-id",
  "detail-type": "Scheduled Event",
  source: "aws.events",
  account: "123456789012",
  time: new Date().toISOString(),
  region: "us-east-2",
  resources: ["arn:aws:events:us-east-2:123456789012:rule/test"],
  detail: {},
};

// Mock Lambda context
const mockContext = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "1",
  invokedFunctionArn: "arn:aws:lambda:us-east-2:123456789012:function:test",
  memoryLimitInMB: "512",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test",
  logStreamName: "2024/01/01/[$LATEST]test",
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

// Set environment variables
process.env.RunEnvironment = "dev";
process.env.AWS_REGION = "us-east-2";

// Run the handler
(async () => {
  try {
    const result = await handler(mockEvent as any, mockContext as any);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
})();
