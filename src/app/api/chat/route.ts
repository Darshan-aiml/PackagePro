import { NextRequest, NextResponse } from "next/server";
import { runAgent, getMemory } from "@/server/agent/chat";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json() as {
      sessionId?: string;
      message?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const id = sessionId ?? crypto.randomUUID();
    const history = getMemory(id);
    history.push({ role: "user", content: message });

    const { content, toolSteps, usedTools } = await runAgent(id, history);

    // Persist the assistant reply in memory for the next turn.
    history.push({ role: "assistant", content });

    return NextResponse.json({
      content,
      toolSteps: toolSteps.map((ts) => ({
        toolCallId: ts.toolCallId,
        name: ts.name,
        args: ts.args,
        result: ts.result,
      })),
      usedTools,
      sessionId: id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Agent failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
