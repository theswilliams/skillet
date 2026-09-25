/**
 * Skillet's live deployment is a portfolio demo: every visitor uses the same single account
 * (see currentUser.ts) and a scheduled job resets it (vercel.json). Visitors must be told, since
 * anything they type (pantry items, imported recipe URLs) is visible to everyone.
 */
export const DEMO_NOTICE_TEXT =
  "Public demo: everyone shares one account, so whatever you add is visible to all visitors and is reset daily. Please don't enter personal information.";
