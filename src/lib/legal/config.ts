/** Independent of content mode: publishing legal pages must not filter characters. */
export const UPDATED_LEGAL = process.env.NEXT_PUBLIC_UPDATED_LEGAL === "1";
export const LEGAL_PAGES_ENABLED =
  UPDATED_LEGAL || process.env.NEXT_PUBLIC_SFW_MODE === "1";
