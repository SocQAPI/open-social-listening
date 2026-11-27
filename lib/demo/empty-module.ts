// Stands in for nodemailer in the static demo build, where alerts are never sent.
export function createTransport(): never {
  throw new Error("Email alerts are not available in the static demo.");
}
