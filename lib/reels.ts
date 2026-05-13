export interface ReelEntry {
  shortcode: string;
  caption?: string;
}

/**
 * Curated Instagram Reels shown on the welcome page.
 *
 * How to add a Reel:
 *   1. Find a public Instagram Reel — e.g. https://www.instagram.com/reel/ABC123xyz/
 *   2. Copy the shortcode (the part after /reel/) → "ABC123xyz"
 *   3. Add an entry below: { shortcode: "ABC123xyz", caption: "Optional label" }
 */
const REELS: ReelEntry[] = [
  { shortcode: "BV5esolhf_3" },
];

export default REELS;
