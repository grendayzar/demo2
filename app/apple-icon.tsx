import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the AP isotype on brand yellow, rendered on request so no binary lives in the repo. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#ffbd15" }}>
        <svg width="112" height="112" viewBox="-4 -8 686 672" fill="#000000"><path fillRule="evenodd" clipRule="evenodd" d="M473.241 0C421.732 0 374.755 19.4059 339.18 51.2946C303.658 19.4059 256.775 0 205.372 0H55.6564V135.788H205.399C241.534 135.788 270.829 165.191 270.829 201.436V454.475H270.616C270.616 490.654 241.294 520.016 205.079 520.016C168.863 520.016 139.541 490.654 139.541 454.475C139.541 418.296 168.863 388.933 205.079 388.933H256.522V253.386H205.079C94.0187 253.386 4 343.412 4 454.475C4 565.537 94.0187 655.564 205.079 655.564C228.6 655.564 251.175 651.487 272.149 644.056V650.632H407.691V201.303C407.691 165.057 437.012 135.694 473.228 135.694C509.443 135.694 538.765 165.057 538.765 201.303C538.765 237.548 509.443 266.911 473.228 266.911H421.785V402.592H473.228C584.288 402.592 674.307 312.472 674.307 201.289C674.307 90.1064 584.301 0 473.241 0Z" fill="currentColor"/></svg>
      </div>
    ),
    size,
  );
}
