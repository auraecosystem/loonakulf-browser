export const LOONAKULF_IDENTITY = Object.freeze({
  name: "Loonakulf",
  product: "Loonakulf Browser",
  version: "1.0.0",
  vendor: "Loonakulf",
  productToken: "Loonakulf",
  tagline: "Independent browser. Connected by design.",
  colors: Object.freeze({
    midnight: "#081426",
    navy: "#102744",
    cyan: "#35D8F2",
    silver: "#C6D2DF",
    white: "#F7FAFC"
  })
});

export function appendLoonakulfProductToken(userAgent, version = LOONAKULF_IDENTITY.version) {
  const value = typeof userAgent === "string" ? userAgent.trim() : "";
  if (!value) return "";
  const token = new RegExp("\\b" + LOONAKULF_IDENTITY.productToken + "\\/", "i");
  if (token.test(value)) return value;
  return value + " " + LOONAKULF_IDENTITY.productToken + "/" + version;
}
