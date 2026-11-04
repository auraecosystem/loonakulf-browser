import React from "react";
import { LOONAKULF_IDENTITY } from "./identity";

const styles = {
  shell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    padding: "8px 18px",
    color: LOONAKULF_IDENTITY.colors.white,
    background: "linear-gradient(110deg, #081426 0%, #102744 72%, #123c59 100%)",
    borderBottom: "1px solid rgba(53, 216, 242, 0.35)",
    boxSizing: "border-box",
    fontFamily: "system-ui, sans-serif"
  },
  logo: { width: 34, height: 34, flex: "0 0 34px" },
  name: { fontSize: 14, fontWeight: 800, letterSpacing: "0.16em", lineHeight: 1.2 },
  tagline: { marginTop: 3, color: "#AFC5D8", fontSize: 10, letterSpacing: "0.08em" },
  version: { marginLeft: "auto", color: "#B8CAD9", fontSize: 11, whiteSpace: "nowrap" }
};

export default function BrandHeader() {
  return (
    <header style={styles.shell} aria-label={LOONAKULF_IDENTITY.product}>
      <img
        src="/loonakulf-mark.svg"
        alt=""
        aria-hidden="true"
        style={styles.logo}
        width="34"
        height="34"
      />
      <div>
        <div style={styles.name}>LOONAKULF</div>
        <div style={styles.tagline}>INDEPENDENT BROWSER</div>
      </div>
      <span style={styles.version}>v{LOONAKULF_IDENTITY.version}</span>
    </header>
  );
}
