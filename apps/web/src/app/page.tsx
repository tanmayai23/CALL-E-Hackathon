import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { StatementBand } from "@/components/landing/StatementBand";
import { PropertiesBand } from "@/components/landing/PropertiesBand";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ResultShowcase } from "@/components/landing/ResultShowcase";
import { SafetySection } from "@/components/landing/SafetySection";
import { Faq } from "@/components/landing/Faq";
import { ClosingCta } from "@/components/landing/ClosingCta";

/**
 * Landing — a warm, editorial, scrolling page. Its rhythm alternates grounds so
 * each idea gets its own room: cream → ink → teal → cream → teal.
 *
 * Every section sits on the same 1200px, 12-column container, so their edges
 * line up down the page.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-dvh bg-canvas">
      <LandingNav />
      <Hero />
      <StatementBand />
      <HowItWorks />
      <PropertiesBand />
      <ResultShowcase />
      <SafetySection />
      <Faq />
      <ClosingCta />
    </main>
  );
}
