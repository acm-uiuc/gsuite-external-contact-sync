/**
 * Parses a display name into first and last name components
 * Handles common formats:
 * - "First Last"
 * - "Last, First"
 * - "First Middle Last" (treats everything except last word as first name)
 * - Single names (treated as first name)
 */
export const parseDisplayName = (
  displayName: string,
): { givenName: string; familyName: string } => {
  if (!displayName || displayName.trim() === "") {
    return { givenName: "", familyName: "" };
  }

  const trimmed = displayName.trim();

  // Handle "Last, First" format
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim());
    return {
      familyName: parts[0] || "",
      givenName: parts[1] || "",
    };
  }

  // Handle "First Last" or "First Middle Last" format
  const parts = trimmed.split(/\s+/);

  if (parts.length === 1) {
    // Single name - treat as first name
    return {
      givenName: parts[0],
      familyName: "",
    };
  }

  if (parts.length === 2) {
    // Simple "First Last"
    return {
      givenName: parts[0],
      familyName: parts[1],
    };
  }

  // Multiple parts - last part is family name, rest is given name
  const familyName = parts[parts.length - 1];
  const givenName = parts.slice(0, -1).join(" ");

  return { givenName, familyName };
};
