import LegalPageShell from "../components/LegalPageShell";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Your privacy matters"
      title="Privacy Policy"
      description="This policy explains what information KTownTriangle collects, how it is used, and the choices available to you."
      updated="July 22, 2026"
    >
      <div className="notice">
        We aim to collect only the information needed to operate, secure, and
        improve KTownTriangle.
      </div>

      <h2>1. Information We Collect</h2>
      <p>We may collect the following categories of information:</p>
      <ul>
        <li>Name, email address, and account profile information.</li>
        <li>Business listing, event, marketplace, review, and community content you submit.</li>
        <li>IP address, device type, browser type, and general usage information.</li>
        <li>Approximate or precise location only when you permit location access.</li>
        <li>Cookies and similar technologies used for login, security, and analytics.</li>
      </ul>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>Provide and maintain KTownTriangle services.</li>
        <li>Authenticate users and protect accounts.</li>
        <li>Display business listings and user-submitted content.</li>
        <li>Improve search, maps, recommendations, and overall user experience.</li>
        <li>Prevent fraud, spam, misuse, and security threats.</li>
        <li>Communicate important service or account updates.</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>
        KTownTriangle may use third-party services such as Supabase, Google
        Analytics, Google Maps, and social login providers. These providers may
        process information according to their own privacy policies.
      </p>

      <h2>4. Cookies and Analytics</h2>
      <p>
        Cookies and similar technologies may be used to keep you signed in,
        remember preferences, measure traffic, and understand how visitors use
        the site.
      </p>

      <h2>5. User-Submitted Content</h2>
      <p>
        Information you intentionally post to public areas may be visible to
        other users and search engines. Do not post sensitive personal
        information in public listings, reviews, comments, or marketplace posts.
      </p>

      <h2>6. Data Retention and Security</h2>
      <p>
        We use reasonable administrative and technical safeguards. However, no
        internet transmission or storage system can be guaranteed to be
        completely secure.
      </p>

      <h2>7. Your Choices</h2>
      <ul>
        <li>You may update certain account information through your profile.</li>
        <li>You may request correction or deletion of eligible personal data.</li>
        <li>You may disable location access and certain cookies through your device or browser.</li>
      </ul>

      <h2>8. Children’s Privacy</h2>
      <p>
        KTownTriangle is not intended for children under 13, and we do not
        knowingly collect personal information from children under 13.
      </p>

      <h2>9. Policy Changes</h2>
      <p>
        We may update this policy as our services or legal obligations change.
        The revised date will appear at the top of this page.
      </p>

      <h2>10. Contact Us</h2>
      <p>
        Questions or privacy requests may be submitted through the KTownTriangle
        contact page or by email at{" "}
        <a href="mailto:support@ktowntriangle.com">
          support@ktowntriangle.com
        </a>.
      </p>
    </LegalPageShell>
  );
}
