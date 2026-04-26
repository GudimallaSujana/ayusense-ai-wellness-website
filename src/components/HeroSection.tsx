import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroBg}
          alt="Ayurvedic herbs and plants"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-3xl mx-auto animate-fade-in-up">
        <h1 className="font-serif text-5xl md:text-7xl font-bold text-primary mb-6 leading-tight">
          Ayusense
        </h1>
        <p className="font-serif text-xl md:text-2xl text-accent font-semibold mb-4 italic">
          Intelligent Ayurvedic Wellness
        </p>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          Combining Ancient Wisdom with Artificial Intelligence for Personalized Natural Healing.
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
