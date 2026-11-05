import { ImageResponse } from "next/og";

// The share card is the instrument, not a gradient banner: document white,
// one ruled block, the two states that matter. No invented figures, no fake
// testimonial, no funds amount. Static at build time.
export const alt = "Settleform: invoice a client, or convert it yourself. Either way, USDC lands on NEAR.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FCFDFA",
          border: "24px solid #151A17",
          padding: "56px 64px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, letterSpacing: 4, color: "#4A524C" }}>
          <span>SETTLEFORM INSTRUMENT</span>
          <span>USDC ON NEAR</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, color: "#151A17", lineHeight: 1.05 }}>
            Invoice a client, or convert it yourself.
          </div>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, color: "#151A17", lineHeight: 1.05 }}>
            USDC lands on NEAR.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, color: "#4A524C" }}>No client login. Verified routes only.</span>
          <span style={{ fontSize: 30, letterSpacing: 3, color: "#8E1413", border: "3px solid #C0201F", padding: "8px 20px" }}>
            UNPAID
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
