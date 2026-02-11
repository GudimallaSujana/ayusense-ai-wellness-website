const Footer = () => {
  return (
    <footer className="border-t border-border bg-muted/30 mt-20" id="contact">
      <div className="container mx-auto px-6 py-12 text-center">
        <p className="font-serif text-2xl text-primary font-semibold mb-4">
          🌿 Preserving Ancient Wisdom Through AI
        </p>
        <div className="flex justify-center gap-6 mb-8 text-muted-foreground text-sm">
          <a href="#" className="hover:text-primary transition-colors">Twitter</a>
          <a href="#" className="hover:text-primary transition-colors">Instagram</a>
          <a href="#" className="hover:text-primary transition-colors">LinkedIn</a>
          <a href="#" className="hover:text-primary transition-colors">GitHub</a>
        </div>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
          ⚕️ Disclaimer: This platform provides guidance for minor ailments only. 
          Consult a medical professional for serious conditions. Ayusense does not replace professional medical advice.
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          © 2026 Ayusense. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
