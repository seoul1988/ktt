import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WebsiteSettings = {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_style?: string;
  button_style?: string;
  layout_width?: string;
};

type Business = {
  id: number;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  website_url?: string | null;
  image_url?: string | null;
  rating?: number | string | null;
  review_count?: number | null;

  website_enabled?: boolean | null;
  website_slug?: string | null;
  template_key?: string | null;
  website_status?: string | null;
  website_settings?: WebsiteSettings | null;
};

type SectionContent = {
  headline?: string;
  subheadline?: string;
  description?: string;
  button_text?: string;
  button_url?: string;
  booking_url?: string;
  image_url?: string;
  images?: string[];
  items?: Array<{
    name?: string;
    title?: string;
    description?: string;
    price?: string;
    image_url?: string;
  }>;
};

type SectionSettings = {
  columns?: number;
  text_align?: "left" | "center" | "right";
  overlay?: boolean;
  height?: "small" | "medium" | "large";
  show_prices?: boolean;
  show_phone?: boolean;
  show_email?: boolean;
  show_address?: boolean;
  show_directions_button?: boolean;
};

type BusinessSection = {
  id: number;
  business_id: number;
  section_type: string;
  title: string | null;
  content: SectionContent;
  settings: SectionSettings;
  sort_order: number;
  is_visible: boolean;
};

function safeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;

  if (
    /^#[0-9a-f]{3}$/i.test(value) ||
    /^#[0-9a-f]{6}$/i.test(value) ||
    /^rgb\(/i.test(value) ||
    /^rgba\(/i.test(value) ||
    /^hsl\(/i.test(value) ||
    /^hsla\(/i.test(value)
  ) {
    return value;
  }

  return fallback;
}

function cleanUrl(value: string | undefined | null) {
  const url = String(value ?? "").trim();

  if (!url) return "";

  if (
    url.startsWith("#") ||
    url.startsWith("/") ||
    /^https?:\/\//i.test(url) ||
    /^tel:/i.test(url) ||
    /^mailto:/i.test(url)
  ) {
    return url;
  }

  return `https://${url}`;
}

function buildAddress(business: Business) {
  return [business.address, business.city, business.zip_code]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function getFontClass(fontStyle: string | undefined) {
  if (fontStyle === "classic") {
    return "font-serif";
  }

  return "font-sans";
}

function getContainerClass(layoutWidth: string | undefined) {
  if (layoutWidth === "full") {
    return "w-full";
  }

  if (layoutWidth === "narrow") {
    return "mx-auto w-full max-w-4xl";
  }

  return "mx-auto w-full max-w-6xl";
}

function getGridClass(columns: number | undefined) {
  if (columns === 2) {
    return "grid-cols-1 sm:grid-cols-2";
  }

  if (columns === 4) {
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  }

  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-3 text-base leading-7 text-gray-600">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function HeroSection({
  business,
  section,
  primaryColor,
  accentColor,
}: {
  business: Business;
  section: BusinessSection;
  primaryColor: string;
  accentColor: string;
}) {
  const content = section.content ?? {};
  const settings = section.settings ?? {};

  const imageUrl =
    cleanUrl(content.image_url) || cleanUrl(business.image_url);

  const headline =
    content.headline || business.name || "Welcome to Our Salon";

  const subheadline =
    content.subheadline ||
    business.description ||
    "Professional beauty services created for your unique style.";

  const buttonText = content.button_text || "Book an Appointment";
  const buttonUrl = cleanUrl(content.button_url) || "#booking";

  const heightClass =
    settings.height === "small"
      ? "min-h-[420px]"
      : settings.height === "medium"
        ? "min-h-[560px]"
        : "min-h-[680px]";

  const textAlignClass =
    settings.text_align === "left"
      ? "items-start text-left"
      : settings.text_align === "right"
        ? "items-end text-right"
        : "items-center text-center";

  return (
    <section
      className={`relative flex overflow-hidden ${heightClass}`}
      style={{
        backgroundColor: primaryColor,
        backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            settings.overlay === false
              ? "transparent"
              : "linear-gradient(180deg, rgba(0,0,0,0.32), rgba(0,0,0,0.68))",
        }}
      />

      <div
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center px-5 py-20 text-white sm:px-8 ${textAlignClass}`}
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
          {business.category || "Hair Salon"}
        </p>

        <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          {headline}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-xl">
          {subheadline}
        </p>

        <a
          href={buttonUrl}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-7 py-3 font-bold text-white shadow-lg transition hover:scale-[1.02]"
          style={{ backgroundColor: accentColor }}
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}

function AboutSection({
  business,
  section,
}: {
  business: Business;
  section: BusinessSection;
}) {
  const description =
    section.content?.description ||
    business.description ||
    "Tell customers about your salon, experience, and specialties.";

  const imageUrl =
    cleanUrl(section.content?.image_url) || cleanUrl(business.image_url);

  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
        <div className="overflow-hidden rounded-3xl bg-gray-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={business.name || "Business"}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-gray-400">
              Add an about image
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gray-500">
            About
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {section.title || "About Us"}
          </h2>

          <p className="mt-5 whitespace-pre-line text-base leading-8 text-gray-600">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function ServicesSection({
  section,
  accentColor,
}: {
  section: BusinessSection;
  accentColor: string;
}) {
  const items = section.content?.items ?? [];

  return (
    <section id="services" className="bg-gray-50 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title={section.title || "Our Services"}
          description={section.content?.description}
        />

        {items.length > 0 ? (
          <div
            className={`grid gap-5 ${getGridClass(section.settings?.columns)}`}
          >
            {items.map((item, index) => (
              <article
                key={`${item.name ?? "service"}-${index}`}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-bold text-gray-950">
                    {item.name || "Service"}
                  </h3>

                  {section.settings?.show_prices !== false && item.price ? (
                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-sm font-bold text-white"
                      style={{ backgroundColor: accentColor }}
                    >
                      {item.price}
                    </span>
                  ) : null}
                </div>

                {item.description ? (
                  <p className="mt-3 leading-7 text-gray-600">
                    {item.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Services will be added soon.
          </p>
        )}
      </div>
    </section>
  );
}

function StaffSection({ section }: { section: BusinessSection }) {
  const items = section.content?.items ?? [];

  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          title={section.title || "Meet Our Stylists"}
          description={section.content?.description}
        />

        {items.length > 0 ? (
          <div
            className={`grid gap-6 ${getGridClass(section.settings?.columns)}`}
          >
            {items.map((item, index) => (
              <article
                key={`${item.name ?? "staff"}-${index}`}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white"
              >
                {item.image_url ? (
                  <img
                    src={cleanUrl(item.image_url)}
                    alt={item.name || "Stylist"}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-gray-100 text-gray-400">
                    Stylist photo
                  </div>
                )}

                <div className="p-5 text-center">
                  <h3 className="text-xl font-bold text-gray-950">
                    {item.name || item.title || "Stylist"}
                  </h3>

                  {item.description ? (
                    <p className="mt-2 leading-6 text-gray-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Stylist profiles will be added soon.
          </p>
        )}
      </div>
    </section>
  );
}

function GallerySection({ section }: { section: BusinessSection }) {
  const images = section.content?.images ?? [];

  return (
    <section className="bg-gray-950 px-5 py-16 text-white sm:px-8 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            {section.title || "Gallery"}
          </h2>

          {section.content?.description ? (
            <p className="mt-3 leading-7 text-white/70">
              {section.content.description}
            </p>
          ) : null}
        </div>

        {images.length > 0 ? (
          <div
            className={`grid gap-3 ${getGridClass(section.settings?.columns)}`}
          >
            {images.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={cleanUrl(image)}
                alt={`Gallery image ${index + 1}`}
                className="aspect-square w-full rounded-2xl object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-white/60">
            Gallery images will be added soon.
          </p>
        )}
      </div>
    </section>
  );
}

function BookingSection({
  business,
  section,
  accentColor,
}: {
  business: Business;
  section: BusinessSection;
  accentColor: string;
}) {
  const bookingUrl =
    cleanUrl(section.content?.booking_url) ||
    (business.phone ? `tel:${business.phone}` : "");

  return (
    <section
      id="booking"
      className="px-5 py-16 text-white sm:px-8 sm:py-24"
      style={{ backgroundColor: accentColor }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold sm:text-5xl">
          {section.title || "Book an Appointment"}
        </h2>

        {section.content?.description ? (
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-white/85">
            {section.content.description}
          </p>
        ) : null}

        {bookingUrl ? (
          <a
            href={bookingUrl}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 py-3 font-bold text-gray-950 shadow-lg"
          >
            {section.content?.button_text || "Book Now"}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function ReviewsSection({
  business,
  section,
}: {
  business: Business;
  section: BusinessSection;
}) {
  const rating = Number(business.rating || 0);

  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <SectionHeading
          title={section.title || "Customer Reviews"}
          description={section.content?.description}
        />

        {rating > 0 ? (
          <div className="rounded-3xl bg-gray-50 p-8">
            <div className="text-4xl">★★★★★</div>

            <p className="mt-4 text-4xl font-black text-gray-950">
              {rating.toFixed(1)}
            </p>

            <p className="mt-2 text-gray-600">
              Based on {business.review_count ?? 0} reviews
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Customer reviews will appear here.</p>
        )}
      </div>
    </section>
  );
}

function HoursSection({
  business,
  section,
}: {
  business: Business;
  section: BusinessSection;
}) {
  return (
    <section className="bg-gray-50 px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-7 shadow-sm sm:p-10">
        <SectionHeading title={section.title || "Business Hours"} />

        <div className="grid gap-3 text-gray-700 sm:grid-cols-2">
          <p>Monday – Friday</p>
          <p className="font-semibold sm:text-right">Hours coming soon</p>

          <p>Saturday – Sunday</p>
          <p className="font-semibold sm:text-right">Hours coming soon</p>
        </div>

        {business.phone ? (
          <div className="mt-8 text-center">
            <a
              href={`tel:${business.phone}`}
              className="font-bold text-gray-950 underline"
            >
              Call {business.phone}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MapSection({
  business,
  section,
}: {
  business: Business;
  section: BusinessSection;
}) {
  const address = buildAddress(business);

  const directionsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address,
      )}`
    : "";

  return (
    <section className="bg-white px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <SectionHeading title={section.title || "Visit Us"} />

        {address ? (
          <>
            <p className="text-lg text-gray-700">{address}</p>

            {section.settings?.show_directions_button !== false ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-gray-950 px-7 py-3 font-bold text-white"
              >
                Get Directions
              </a>
            ) : null}
          </>
        ) : (
          <p className="text-gray-500">Address will be added soon.</p>
        )}
      </div>
    </section>
  );
}

function ContactSection({
  business,
  section,
  primaryColor,
}: {
  business: Business;
  section: BusinessSection;
  primaryColor: string;
}) {
  const address = buildAddress(business);

  return (
    <section
      id="contact"
      className="px-5 py-16 text-white sm:px-8 sm:py-24"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          {section.title || "Contact Us"}
        </h2>

        {section.content?.description ? (
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/75">
            {section.content.description}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {section.settings?.show_phone !== false && business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="rounded-full bg-white px-6 py-3 font-bold text-gray-950"
            >
              Call
            </a>
          ) : null}

          {section.settings?.show_address !== false && address ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                address,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/30 px-6 py-3 font-bold text-white"
            >
              Directions
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function UnknownSection({ section }: { section: BusinessSection }) {
  return (
    <section className="bg-white px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-5xl text-center">
        <h2 className="text-3xl font-bold text-gray-950">
          {section.title || section.section_type}
        </h2>

        {section.content?.description ? (
          <p className="mt-4 leading-7 text-gray-600">
            {section.content.description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function renderSection(
  business: Business,
  section: BusinessSection,
  primaryColor: string,
  accentColor: string,
) {
  switch (section.section_type) {
    case "hero":
      return (
        <HeroSection
          business={business}
          section={section}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      );

    case "about":
      return <AboutSection business={business} section={section} />;

    case "services":
      return (
        <ServicesSection section={section} accentColor={accentColor} />
      );

    case "staff":
      return <StaffSection section={section} />;

    case "gallery":
      return <GallerySection section={section} />;

    case "booking":
      return (
        <BookingSection
          business={business}
          section={section}
          accentColor={accentColor}
        />
      );

    case "reviews":
      return <ReviewsSection business={business} section={section} />;

    case "hours":
      return <HoursSection business={business} section={section} />;

    case "map":
      return <MapSection business={business} section={section} />;

    case "contact":
      return (
        <ContactSection
          business={business}
          section={section}
          primaryColor={primaryColor}
        />
      );

    default:
      return <UnknownSection section={section} />;
  }
}

export default async function BusinessWebsitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();

  const { data: businessData, error: businessError } = await supabase
    .from("businesses")
    .select("*")
    .eq("website_slug", normalizedSlug)
    .eq("website_enabled", true)
    .maybeSingle();

  if (businessError) {
    console.error("Business website query failed:", {
      message: businessError.message,
      code: businessError.code,
      details: businessError.details,
      hint: businessError.hint,
    });

    notFound();
  }

  if (!businessData) {
    console.error("No business found for website slug:", normalizedSlug);
    notFound();
  }

  const business = businessData as Business;

  /*
   * 테스트 단계에서는 draft도 표시합니다.
   * 실제 공개 운영 단계에서는 아래 조건을 활성화하세요.
   *
   * if (business.website_status !== "published") {
   *   notFound();
   * }
   */

  const { data: sectionData, error: sectionError } = await supabase
    .from("business_sections")
    .select(
      `
        id,
        business_id,
        section_type,
        title,
        content,
        settings,
        sort_order,
        is_visible
      `,
    )
    .eq("business_id", business.id)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (sectionError) {
    console.error("Business sections query failed:", sectionError);
  }

  const sections = (sectionData ?? []) as BusinessSection[];
  const settings = business.website_settings ?? {};

  const primaryColor = safeColor(settings.primary_color, "#111827");
  const secondaryColor = safeColor(settings.secondary_color, "#f3f4f6");
  const accentColor = safeColor(settings.accent_color, "#d97706");

  const pageStyle = {
    "--website-primary": primaryColor,
    "--website-secondary": secondaryColor,
    "--website-accent": accentColor,
  } as CSSProperties;

  return (
    <main
      style={pageStyle}
      className={`min-h-screen bg-white text-gray-950 ${getFontClass(
        settings.font_style,
      )}`}
    >
      <header className="border-b border-gray-200 bg-white">
        <div
          className={`${getContainerClass(
            settings.layout_width,
          )} flex min-h-16 items-center justify-between gap-4 px-5 sm:px-8`}
        >
          <a
            href={`/site/${encodeURIComponent(normalizedSlug)}`}
            className="truncate text-lg font-black text-gray-950"
          >
            {business.name || "Business"}
          </a>

          <nav className="flex items-center gap-2">
            {business.phone ? (
              <a
                href={`tel:${business.phone}`}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold"
              >
                Call
              </a>
            ) : null}

            <a
              href="#booking"
              className="rounded-full px-4 py-2 text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              Book
            </a>
          </nav>
        </div>
      </header>

      {sections.length > 0 ? (
        sections.map((section) => (
          <div key={section.id}>
            {renderSection(
              business,
              section,
              primaryColor,
              accentColor,
            )}
          </div>
        ))
      ) : (
        <section className="flex min-h-[70vh] items-center justify-center px-5 text-center">
          <div>
            <h1 className="text-3xl font-bold">
              Website setup is in progress
            </h1>

            <p className="mt-3 text-gray-600">
              Homepage sections have not been created yet.
            </p>
          </div>
        </section>
      )}

      <footer className="border-t border-gray-800 bg-gray-950 px-5 py-8 text-center text-sm text-white/65">
        <p>
          © {new Date().getFullYear()} {business.name || "Business"}. All
          rights reserved.
        </p>

        <p className="mt-2">
          Powered by{" "}
          <a
            href="https://www.ktowntriangle.com"
            className="font-semibold text-white"
          >
            KTownTriangle
          </a>
        </p>
      </footer>
    </main>
  );
}