import { useState, useRef } from "react";
import { Upload, ArrowLeft, Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockResult = {
  plantName: "Tulsi (Holy Basil)",
  scientificName: "Ocimum tenuiflorum",
  benefits: [
    "Boosts immunity and fights infections",
    "Reduces stress and anxiety (adaptogen)",
    "Supports respiratory health",
    "Anti-inflammatory and antioxidant properties",
  ],
  remedies: [
    "Tulsi Tea: Steep 8-10 fresh leaves in hot water for 5 min. Drink 2x daily.",
    "Cold Relief: Chew 4-5 leaves with honey every morning.",
    "Skin Care: Paste of leaves applied on acne for 15 minutes.",
  ],
  climate: "Tropical and subtropical climates, thrives in warm humid areas",
  availability: "Widely available across India, Southeast Asia, and can be grown in home gardens",
  alternatives: ["Peppermint", "Lemon Balm", "Ashwagandha"],
  confidence: 94,
  features: ["Serrated leaf edges", "Aromatic oil glands", "Purple-green stem coloring", "Opposite leaf arrangement"],
};

const PlantIdentifier = ({ onBack }: { onBack: () => void }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof mockResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    setResult(null);
  };

  const handleIdentify = () => {
    setLoading(true);
    setTimeout(() => {
      setResult(mockResult);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 text-sm"
      >
        <ArrowLeft size={16} /> Back to options
      </button>

      <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">Identify Medicinal Plant</h2>
      <p className="text-muted-foreground mb-8">Upload a plant image to discover its Ayurvedic benefits.</p>

      <div className="glass-card p-8">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        {!image ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer"
          >
            <Upload size={40} className="text-muted-foreground" />
            <span className="text-muted-foreground">Click to upload a plant image</span>
          </button>
        ) : (
          <div className="space-y-4">
            <img src={image} alt="Uploaded plant" className="w-full max-h-72 object-contain rounded-lg" />
            <div className="flex gap-3">
              <Button onClick={() => { setImage(null); setResult(null); }} variant="outline" className="flex-1">
                Change Image
              </Button>
              <Button onClick={handleIdentify} disabled={loading} className="flex-1 golden-glow bg-primary hover:bg-secondary text-primary-foreground">
                {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Analyzing...</> : <><Leaf className="mr-2" size={16} /> Identify Plant</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="mt-8 space-y-6 animate-fade-in-up">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-2xl font-bold text-primary">{result.plantName}</h3>
              <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                {result.confidence}% confidence
              </span>
            </div>
            <p className="text-muted-foreground italic mb-4">{result.scientificName}</p>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-sm text-accent mb-2">🌿 Health Benefits</h4>
                <ul className="space-y-1 text-sm text-foreground/80">
                  {result.benefits.map((b, i) => <li key={i}>• {b}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-accent mb-2">🏡 Safe Home Remedies</h4>
                <ul className="space-y-1 text-sm text-foreground/80">
                  {result.remedies.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-semibold text-sm text-accent mb-1">🌤️ Climate Suitability</h4>
                <p className="text-sm text-foreground/80">{result.climate}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-accent mb-1">📍 Regional Availability</h4>
                <p className="text-sm text-foreground/80">{result.availability}</p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-semibold text-sm text-accent mb-2">🔄 Alternative Plants</h4>
              <div className="flex flex-wrap gap-2">
                {result.alternatives.map((a, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">{a}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Explainable AI */}
          <div className="glass-card p-6">
            <h3 className="font-serif text-xl font-bold text-primary mb-3">🧠 Why This Plant Was Identified</h3>
            <p className="text-sm text-foreground/80 mb-4">
              The AI model detected key morphological features with <strong>{result.confidence}%</strong> confidence based on leaf structure analysis.
            </p>
            <h4 className="font-semibold text-sm text-accent mb-2">Key Features Detected</h4>
            <div className="flex flex-wrap gap-2">
              {result.features.map((f, i) => (
                <span key={i} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full">{f}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantIdentifier;
