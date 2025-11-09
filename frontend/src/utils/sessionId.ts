/**
 * Generates a unique session ID based on current date/time and random suffix
 * Format: session-YYYY-MM-DD-HH-MM-SS-XXX
 */
export function generateSessionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  
  // Generate a 3-character random suffix (alphanumeric)
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `session-${year}-${month}-${day}-${hours}-${minutes}-${seconds}-${randomSuffix}`;
}

