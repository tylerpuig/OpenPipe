import OpenAI from "../openai";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { test, expect } from "vitest";
import dotenv from "dotenv";

dotenv.config();
const OPENPIPE_API_KEY = process.env.OPENPIPE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// const BASE_URL = "https://app.openpipe.ai/api/v1";
// const BASE_URL = "https://app.openpipestage.com/api/v1";
const BASE_URL = "http://localhost:3000/api/v1";

const oaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
  openpipe: {
    apiKey: OPENPIPE_API_KEY,
    baseUrl: BASE_URL,
    delayLog: true,
  },
});

test("log saved with external logic successful", async () => {
  const payload: ChatCompletionCreateParams = {
    model: "gpt-3.5-turbo-1106",
    messages: [{ role: "system", content: "count to 3" }],
  };

  let result: string | undefined;
  try {
    const completion = await oaiClient.chat.completions.create(payload);

    if (!completion.openpipe?.id) {
      result = "error";
      return;
    }

    // simulate some external logic
    if (!true) throw Error("error");

    // if completion "works" in your external logic, then we can log it
    await oaiClient.chat.completions.logReport(completion.openpipe.id);
    result = "logged";
  } catch (err) {
    result = "error";
  }

  expect(result).toBe("logged");
});

test("log not saved with external logic unsuccessful", async () => {
  const payload: ChatCompletionCreateParams = {
    model: "gpt-3.5-turbo-1106",
    messages: [{ role: "system", content: "count to 3" }],
  };

  // simulate try catch block
  let result: string | undefined;
  try {
    // get the completion
    const completion = await oaiClient.chat.completions.create(payload);

    // For example, we will run a SQL statement from the completion
    // If the SQL statement fails, we will throw an error

    // messages: [{ role: "assistant", content: "Generate me a SQL statement for x,y,z..." }],

    // const sql = `${completion.choices[0]?.message.content}`;
    // const results = await db.query(sql);
    // if (!results) throw Error("error")

    // simulate throwing an error in the external completion logic

    throw Error("error");

    if (!completion.openpipe?.id) result = "error";

    // The log will not be saved since an error was thrown
    await oaiClient.chat.completions.logReport(completion.openpipe?.id as string);
  } catch (err) {
    result = "error";
  }

  expect(result).toBe("error");
});

test("rapid fire test with delayLog true", async () => {
  const payload: ChatCompletionCreateParams = {
    model: "gpt-3.5-turbo-1106",
    messages: [{ role: "system", content: "count to 3" }],
  };

  const createPromises = [];
  for (let i = 0; i < 5; i++) {
    const promise = oaiClient.chat.completions.create(payload).then(async (completion) => {
      try {
        if (!completion.openpipe?.id) return "error";
        // simulate throwing an error in your external completion logic
        if (i > 2) throw Error("error");
        // Since an error was thrown, the completion will not be logged
        await oaiClient.chat.completions.logReport(completion.openpipe.id);
        return "complete";
      } catch (err) {
        return "error";
      }
    });
    createPromises.push(promise);
  }

  const results = await Promise.allSettled(createPromises);

  // Filter out which were successful
  const validate = results.filter(
    (item) => item.status === "fulfilled" && item.value === "complete",
  );

  // Logs will only be saved if the external logic was successful
  const finalResult = validate.length === 3;

  expect(finalResult).toBe(true);
});

test("rapid fire test with delayLog false", async () => {
  // Note delayLog is set to false
  const oaiClient = new OpenAI({
    apiKey: OPENAI_API_KEY,
    openpipe: {
      apiKey: OPENPIPE_API_KEY,
      baseUrl: BASE_URL,
      delayLog: false,
    },
  });
  const payload: ChatCompletionCreateParams = {
    model: "gpt-3.5-turbo-1106",
    messages: [{ role: "system", content: "count to 3" }],
  };

  const createPromises = [];
  for (let i = 0; i < 5; i++) {
    const promise = oaiClient.chat.completions.create(payload).then(async (completion) => {
      try {
        if (!completion.openpipe?.id) return "error";

        // Simulate throwing an error in your external completion logic
        if (i > 2) throw Error("error");

        // Even though an error was thrown, the completion will still be logged

        return "complete";
      } catch (err) {
        return "error";
      }
    });
    createPromises.push(promise);
  }

  const results = await Promise.allSettled(createPromises);

  // Filter out undefined values
  const validate = results.filter((item) => item.status === "fulfilled");

  // All logs will be saved even if an error was thrown
  const finalResult = validate.length === 5;
  expect(finalResult).toBe(true);
});
