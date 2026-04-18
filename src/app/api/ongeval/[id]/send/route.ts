import { NextResponse } from "next/server";

import { sendAccidentReport } from "@/lib/ongeval/send-report";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  const result = await sendAccidentReport(id, { appOrigin: origin });

  if (!result.ok) {
    const httpStatus =
      result.error === "auth_required"
        ? 401
        : result.error === "forbidden"
          ? 403
          : result.error === "not_found"
            ? 404
            : result.error === "no_recipient" || result.error === "config_missing"
              ? 412
              : result.error === "incomplete"
                ? 422
                : 500;
    return NextResponse.json(
      { error: result.error, detail: result.detail ?? null },
      { status: httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    simulated: result.simulated,
    messageId: result.messageId,
    recipient: result.recipient,
    cc: result.cc,
  });
}
