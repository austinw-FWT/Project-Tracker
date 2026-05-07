/**
 * Shared email helper.
 *
 * Opens a pre-filled email in Outlook on the Web (browser).
 *
 * Why not mailto:? On phones, mailto: always opens the system default mail app
 * (which is iOS Mail or Gmail unless the user has changed it at the OS level).
 * Outlook web compose works in any browser and goes straight to Outlook.
 *
 * URL form:
 *   https://outlook.office.com/mail/deeplink/compose?to=...&cc=...&subject=...&body=...
 *
 * Outlook web supports both work/school accounts (office.com) and personal
 * (outlook.live.com); office.com works for both since it redirects.
 */

const OUTLOOK_COMPOSE_URL = "https://outlook.office.com/mail/deeplink/compose";

/**
 * Build the Outlook compose URL for given recipients/subject/body.
 * Returns the URL string. Caller decides how to open (window.open, location.href, etc.)
 */
export function buildOutlookComposeUrl({ to, cc, subject, body }) {
  const params = new URLSearchParams();
  if (to) params.set("to", to);
  if (cc) params.set("cc", cc);
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `${OUTLOOK_COMPOSE_URL}?${params.toString()}`;
}

/**
 * Open Outlook web compose in a new tab/window.
 * On mobile, this opens in the default browser tab (or Outlook app if registered as URL handler).
 * On desktop, this opens in a new tab so the user doesn't lose their place in the app.
 */
export function openOutlookCompose({ to, cc, subject, body }) {
  const url = buildOutlookComposeUrl({ to, cc, subject, body });
  // Try window.open first; if blocked (popup-blocker), fall back to location.assign in same tab.
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — give the user something they can click instead of silently failing.
    // Most modern browsers allow window.open from a click handler so this rarely fires.
    if (confirm("Open email in Outlook? (You can also copy and paste the draft manually.)")) {
      window.location.href = url;
    }
  }
}

/**
 * Build a mailto: URL — kept for compatibility with any code that wants the OS default
 * mail handler instead of Outlook web specifically.
 */
export function buildMailtoUrl({ to, cc, subject, body }) {
  const params = [];
  if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${encodeURIComponent(to || "")}${params.length ? "?" + params.join("&") : ""}`;
}
