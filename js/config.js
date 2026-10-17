/* ==========================================================================
   SITE CONFIGURATION
   --------------------------------------------------------------------------
   Single place to configure external integrations and real contact details.
   Edit the values below, then upload. Nothing here is committed as a secret —
   these are public URLs and a public email address only. Never place API keys,
   SMTP passwords, or private tokens in this file.

   HOW TO FINISH SETUP
   -------------------
   1. bookingUrl  — paste your real scheduling link (Cal.com, Calendly, SavvyCal…)
                    e.g. "https://cal.com/amin-sharif/discovery-call"
                    While empty, every "Book a Discovery Call" button safely
                    falls back to the Contact page (no broken links).
   2. linkedinUrl — paste your LinkedIn profile URL.
                    While empty, the footer link is hidden and a placeholder
                    marker stays in the markup.
   3. formEndpoint — fallback email delivery via FormSubmit.co (free, no backend).
                    Project inquiries are now stored in PostgreSQL through the
                    backend API; FormSubmit.co is still sent a copy so email
                    alerts keep working. If a submission somehow cannot reach
                    the backend, the form falls back to FormSubmit.co entirely.
   ========================================================================== */
window.SITE_CONFIG = {
  /* Scheduling link for discovery calls (leave "" until it is configured). */
  bookingUrl: "",

  /* Public LinkedIn profile (leave "" until it is configured). */
  linkedinUrl: "",

  /* Public GitHub profile — genuine value already known. */
  githubUrl: "https://github.com/Aminsharif",

  /* Contact email shown across the site. */
  contactEmail: "sharifmia236@gmail.com",

  /* FormSubmit.co AJAX endpoint (public email in the URL — not a secret). */
  formEndpoint: "https://formsubmit.co/ajax/sharifmia236@gmail.com",

  /* Page to redirect to if the form is submitted without JavaScript. */
  formFallbackPage: "thank-you.html",

  /* ------------------------------------------------------------------
     BACKEND API (insights + project inquiries)
     ------------------------------------------------------------------
     For most setups leave apiBase as "" — this happens when the site is
     served by the Flask backend (run.py), so the API shares the same origin.

     If you host the static site somewhere else (Netlify, cPanel, …), set
     apiBase to the backend URL, for example "https://api.aminsharif.com",
     and add that origin to CORS_ORIGINS in backend/.env. */
  apiBase: "",

  /* Override the inquiry endpoint entirely (rarely needed). */
  inquiryEndpoint: ""
};
