import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPin, Ruler, FileSignature, Zap } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { schema } from "@/db/client";

type Property = InferSelectModel<typeof schema.properties>;

interface Props {
  featured: Property[];
}

const features = [
  {
    icon: MapPin,
    title: "Marisol coverage",
    description:
      "Submarkets across Ellery, Calder, and Parkhurst, with expansion corridors in Orrington and Tolland.",
  },
  {
    icon: Ruler,
    title: "1,000 to 5,000 sqft units",
    description:
      "Right-sized flex bays for small operators, e-commerce fulfillment, light assembly, and trade contractors.",
  },
  {
    icon: FileSignature,
    title: "Triple net flex leases",
    description:
      "NNN terms with streamlined paperwork. Short-term options available for growing businesses.",
  },
  {
    icon: Zap,
    title: "Fast move-in",
    description:
      "Most units are move-in ready within 30 days. Drive-up dock or grade-level access on every bay.",
  },
];

export function KeystoneMockSite({ featured }: Props) {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">KF</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">
            Keystone Flex Partners
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#" className="hover:text-gray-900 transition-colors">
            Properties
          </a>
          <a href="#" className="hover:text-gray-900 transition-colors">
            About
          </a>
          <a href="#" className="hover:text-gray-900 transition-colors">
            Contact
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gray-950 text-white px-6 py-20 text-center">
        <p className="text-red-400 text-sm font-medium mb-3 uppercase tracking-widest">
          Flex Industrial Leasing
        </p>
        <h1 className="text-4xl md:text-5xl font-bold mb-5 max-w-3xl mx-auto leading-tight">
          Find your next flex industrial space
        </h1>
        <p className="text-gray-300 text-lg max-w-xl mx-auto">
          Flex industrial leasing across Marisol and expansion markets.
          Move-in ready units from 1,000 to 5,000 sqft with NNN terms and fast
          approvals.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <span className="inline-block bg-red-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:bg-red-700 transition-colors">
            Browse Properties
          </span>
          <span className="inline-block border border-white/30 text-white px-6 py-2.5 rounded-lg text-sm font-semibold cursor-pointer hover:bg-white/10 transition-colors">
            Talk to Leasing
          </span>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Why flex tenants choose us
        </h2>
        <p className="text-gray-500 text-center mb-10 text-sm">
          Built for businesses that need real space, fast.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="flex flex-col">
              <CardHeader>
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center mb-1">
                  <Icon className="w-5 h-5 text-red-600" />
                </div>
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured properties strip */}
      <section className="bg-gray-50 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Featured properties
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Recently added to our portfolio.
          </p>
          {featured.length === 0 ? (
            <p className="text-sm text-gray-400">
              No properties loaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:border-red-200 transition-colors cursor-pointer"
                >
                  <div className="w-full h-24 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">
                      {p.assetType ?? "Flex Industrial"}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {p.name}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {p.submarket ?? "Marisol"}
                  </p>
                  {p.totalSqft ? (
                    <p className="text-gray-700 text-xs mt-2 font-medium">
                      {p.totalSqft.toLocaleString()} sqft total
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-400 mb-3">
          <a href="#" className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Terms of Use
          </a>
          <a href="#" className="hover:text-gray-600 transition-colors">
            Sitemap
          </a>
        </div>
        <p className="text-xs text-gray-400">
          &copy; 2026 Keystone Flex Partners
        </p>
      </footer>
    </div>
  );
}
