import LegalPageShell from "../components/LegalPageShell";

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Rules for using KTownTriangle"
      title="Terms of Service"
      description="These terms describe the rules, responsibilities, and limitations that apply when you access or use KTownTriangle."
      updated="October 26, 2026"
    >
      <div className="notice">
        By creating an account or using KTownTriangle, you agree to these Terms
        of Service.
      </div>

      <h2>1. Eligibility and Acceptance</h2>
      <p>
        You must be legally able to enter into an agreement and provide accurate
        information when creating or maintaining an account.
      </p>

      <h2>2. Account Responsibilities</h2>
      <ul>
        <li>Keep your login credentials secure.</li>
        <li>Provide accurate and current account information.</li>
        <li>Accept responsibility for activity performed through your account.</li>
        <li>Notify us if you believe your account has been accessed without permission.</li>
      </ul>

      <h2>3. Acceptable Use</h2>
      <p>You may not use KTownTriangle to:</p>
      <ul>
        <li>Post unlawful, fraudulent, threatening, hateful, or abusive content.</li>
        <li>Impersonate another person or misrepresent a business.</li>
        <li>Upload malware, scrape the service, or disrupt its operation.</li>
        <li>Post spam, deceptive advertising, or fake reviews.</li>
        <li>Infringe copyrights, trademarks, privacy rights, or other legal rights.</li>
      </ul>

      <h2>4. Business Listings and Community Content</h2>
      <p>
        Users are responsible for the accuracy and legality of content they
        submit. KTownTriangle may edit, hide, reject, or remove content when it
        is inaccurate, outdated, misleading, unlawful, or inconsistent with our
        policies.
      </p>

      <h2>5. Ownership and License</h2>
      <p>
        You retain ownership of content you submit. By posting it, you grant
        KTownTriangle a non-exclusive license to host, display, format, and
        distribute that content as needed to operate and promote the service.
      </p>

      <h2>6. Third-Party Businesses and Links</h2>
      <p>
        KTownTriangle may display information about independent businesses,
        events, products, services, and external websites. We do not control or
        guarantee those third parties.
      </p>

      <h2>7. No Warranty</h2>
      <p>
        KTownTriangle is provided on an “as is” and “as available” basis.
        Listings, hours, prices, availability, reviews, and other information
        may contain errors or become outdated.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, KTownTriangle is not liable for
        indirect, incidental, special, consequential, or business losses arising
        from use of the service or reliance on third-party information.
      </p>

      <h2>9. Suspension or Termination</h2>
      <p>
        We may restrict, suspend, or terminate access when a user violates these
        terms, creates legal or security risk, or abuses the service.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may revise these terms from time to time. Continued use after an
        update means you accept the revised terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms may be sent to{" "}
        <a href="mailto:ktowntriangle@gmail.com">
          ktowntriangle@gmail.com
        </a>.
      </p>

      <h2>12. SMS Terms &amp; Conditions</h2>
      <p>
        KTownTriangle may send transactional text messages to customers who
        expressly opt in through our website checkout form. These messages may
        include order confirmations, food preparation updates, pickup readiness,
        and delivery status notifications. SMS consent is optional and is not a
        condition of purchase.
      </p>
      <ul>
        <li>Message frequency varies based on your order activity.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply STOP to unsubscribe from text messages at any time.</li>
        <li>Reply HELP for assistance, or email ktowntriangle@gmail.com.</li>
        <li>Mobile carriers are not liable for delayed or undelivered messages.</li>
        <li>
          See our <a href="/privacy">Privacy Policy</a> for information
          about how personal information is handled.
        </li>
      </ul>
      <p>
        We do not share SMS opt-in consent or mobile phone numbers with third
        parties or affiliates for their own marketing or promotional purposes.
        Service providers may process information as needed to deliver requested
        messaging services.
      </p>
    </LegalPageShell>
  );
}
