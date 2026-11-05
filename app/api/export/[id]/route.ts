import { NextRequest, NextResponse } from "next/server";
import { getInvoice } from "@/lib/invoices";
import { csvRow } from "@/lib/csv";
import { failure, json } from "@/lib/http";

const COLUMNS = [
  "invoice_id",
  "client",
  "amount",
  "currency",
  "source_token",
  "source_chain",
  "quoted_rate",
  "expected_usdc",
  "settled_usdc",
  "fee",
  "status",
  "created_at",
  "paid_at",
  "tx_refs",
];

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const inv = await getInvoice(id);
    if (!inv) return json({ error: "Invoice not found." }, { status: 404 });

    const p = inv.payment;
    const row = [
      inv.id,
      inv.client,
      inv.amount,
      inv.currency,
      p?.originAsset ?? "",
      p?.sourceChain ?? "",
      p?.quotedRate ?? "",
      p?.expectedUsdc ?? "",
      p?.settledUsdc ?? "",
      p?.fee ?? "",
      inv.swapStatus && inv.status === "UNPAID" && inv.swapStatus === "REFUNDED" ? "SWAP_REFUNDED" : inv.status,
      inv.createdAt,
      inv.paidAt ?? "",
      (p?.txRefs ?? []).join(" | "),
    ];

    const csv = COLUMNS.join(",") + "\n" + csvRow(row) + "\n";
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="settleform-' + inv.number + '.csv"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    return failure(err, "export");
  }
}
