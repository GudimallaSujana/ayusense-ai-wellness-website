import { useState } from "react";
import { Leaf, Stethoscope } from "lucide-react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FloatingLeaves from "@/components/FloatingLeaves";
import PlantIdentifier from "@/components/PlantIdentifier";
import RemedyFinder from "@/components/RemedyFinder";
import Footer from "@/components/Footer";

type ActiveModule = null | "plant" | "remedy";

const Index = () => {
  const [active, setActive] = useState<ActiveModule>(null);

  return (
    <div className="min-h-screen bg-background relative">
      <FloatingLeaves />
      <Navbar />

      <main className="pt-20">
        <HeroSection />

        <section className="container mx-auto px-6 py-16 relative z-10" id="about">
          {active === null && (
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto animate-fade-in-up">
              {/* Plant Identifier Card */}
              <button
                onClick={() => setActive("plant")}
                className="glass-card p-10 text-left group hover:scale-[1.02] transition-all duration-300 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Leaf size={32} className="text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary mb-3">Identify Medicinal Plant</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Upload a plant image to discover its Ayurvedic benefits, uses, and safe remedies.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary golden-glow bg-primary/10 px-5 py-2.5 rounded-full group-hover:bg-primary/20 transition-colors">
                  Upload Plant →
                </span>
              </button>

              {/* Remedy Finder Card */}
              <button
                onClick={() => setActive("remedy")}
                className="glass-card p-10 text-left group hover:scale-[1.02] transition-all duration-300 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                  <Stethoscope size={32} className="text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary mb-3">Find Ayurvedic Remedy</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Enter your symptoms to receive personalized Ayurvedic plant recommendations.
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary golden-glow bg-primary/10 px-5 py-2.5 rounded-full group-hover:bg-primary/20 transition-colors">
                  Check Remedies →
                </span>
              </button>
            </div>
          )}

          {active === "plant" && (
            <div className="max-w-3xl mx-auto">
              <PlantIdentifier onBack={() => setActive(null)} />
            </div>
          )}

          {active === "remedy" && (
            <div className="max-w-3xl mx-auto">
              <RemedyFinder onBack={() => setActive(null)} />
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
