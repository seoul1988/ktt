export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>

      <p className="mb-4">
        Last Updated: July 22, 2026
      </p>

      <h2 className="mt-8 mb-2 text-xl font-bold">Information We Collect</h2>
      <p>
        KTownTriangle may collect your name, email address, profile information,
        IP address, browser information, cookies, location data (when permitted),
        and any information you voluntarily submit.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-bold">How We Use Information</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Provide our community services.</li>
        <li>Improve user experience.</li>
        <li>Display business listings.</li>
        <li>Prevent spam and abuse.</li>
        <li>Send notifications when enabled.</li>
      </ul>

      <h2 className="mt-8 mb-2 text-xl font-bold">Cookies</h2>
      <p>
        We use cookies and similar technologies to improve your browsing
        experience.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-bold">Third-Party Services</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Google Analytics</li>
        <li>Google Maps</li>
        <li>Supabase</li>
      </ul>

      <h2 className="mt-8 mb-2 text-xl font-bold">Security</h2>
      <p>
        We take reasonable measures to protect your information, but no method
        of transmission is completely secure.
      </p>

      <h2 className="mt-8 mb-2 text-xl font-bold">Contact</h2>
      <p>Email: support@ktowntriangle.com</p>
    </main>
  );
}