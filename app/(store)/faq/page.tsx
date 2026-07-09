import type { Metadata } from "next";
import { prisma } from "@/lib/db";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Shipping, sizing, returns and drops — answers to the questions we get most at CRAZYWORK.",
};

export default async function FaqPage() {
  const faqs = await prisma.faq.findMany({
    where: { published: true },
    orderBy: { sortOrder: "asc" },
  });

  const categories = [...new Set(faqs.map((f) => f.category ?? "General"))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Help</p>
      <h1 className="headline mt-1 text-7xl">FAQ</h1>

      {categories.map((category) => (
        <section key={category} className="mt-12">
          <h2 className="subhead border-b border-ink pb-2 text-2xl">{category}</h2>
          <div className="mt-2 divide-y divide-sand">
            {faqs
              .filter((f) => (f.category ?? "General") === category)
              .map((faq) => (
                <details key={faq.id} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 subhead text-lg hover:text-ember">
                    {faq.question}
                    <span className="text-ember transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-brown">
                    {faq.answer}
                  </p>
                </details>
              ))}
          </div>
        </section>
      ))}

      {faqs.length === 0 && (
        <p className="mt-12 text-sm text-brown">Questions and answers coming soon.</p>
      )}
    </div>
  );
}
