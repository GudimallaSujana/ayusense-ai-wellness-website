import { useState } from "react";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const mockRemedyResult = {
  plants: [
    {
      name: "Ashwagandha (Withania somnifera)",
      reason: "Ashwagandha is a premier adaptogen in Ayurveda that directly targets stress-related symptoms by modulating cortisol levels and calming the nervous system.",
      mechanism: "Contains withanolides that regulate the HPA axis, reducing cortisol production and promoting GABA-like calming effects on neural pathways.",
      remedy: "Mix 1 tsp of Ashwagandha root powder in warm milk with a pinch of turmeric and honey. Drink before bedtime daily for 4-6 weeks.",
      precautions: "Avoid during pregnancy. May interact with thyroid medications. Start with a low dose to check sensitivity.",
      confidence: 92,
    },
    {
      name: "Brahmi (Bacopa monnieri)",
      reason: "Brahmi is traditionally used for calming the mind, improving focus, and reducing anxiety-related headaches — key symptoms mentioned.",
      mechanism: "Bacosides in Brahmi enhance serotonin synthesis and modulate dopamine, improving mood while reducing oxidative stress in neural tissues.",
      remedy: "Boil 5-6 fresh Brahmi leaves in water for 10 minutes. Strain and drink as herbal tea twice daily. Can also apply Brahmi oil to scalp before sleep.",
      precautions: "May cause mild digestive discomfort initially. Avoid on empty stomach. Not recommended with sedative medications.",
      confidence: 87,
    },
  ],
  alternatives: ["Jatamansi", "Shankhpushpi", "Vacha"],
};

const RemedyFinder = ({ onBack }: { onBack: () => void }) => {
  const [symptoms, setSymptoms] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof mockRemedyResult | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResult(mockRemedyResult);
      setLoading(false);
    }, 2500);
  };

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 text-sm"
      >
        <ArrowLeft size={16} /> Back to options
      </button>

      <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">Find Ayurvedic Remedy</h2>
      <p className="text-muted-foreground mb-8">Enter your symptoms for personalized plant recommendations.</p>

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground/80 mb-1 block">Symptoms / Disease</label>
          <Input
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. stress, headache, insomnia, fatigue"
            className="bg-background/50"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground/80 mb-1 block">Location (optional)</label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Mumbai, Maharashtra"
            className="bg-background/50"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !symptoms.trim()}
          className="w-full golden-glow bg-primary hover:bg-secondary text-primary-foreground"
        >
          {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Finding Remedies...</> : <><Search className="mr-2" size={16} /> Check Remedies</>}
        </Button>
      </form>

      {result && (
        <div className="mt-8 space-y-6 animate-fade-in-up">
          {result.plants.map((plant, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-xl font-bold text-primary">{plant.name}</h3>
                <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {plant.confidence}% match
                </span>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-accent mb-1">🧠 Why Recommended</h4>
                  <p className="text-foreground/80">{plant.reason}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-accent mb-1">⚙️ How It Works</h4>
                  <p className="text-foreground/80">{plant.mechanism}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-accent mb-1">🏡 Safe Home Remedy</h4>
                  <p className="text-foreground/80">{plant.remedy}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-accent mb-1">⚠️ Precautions</h4>
                  <p className="text-foreground/80">{plant.precautions}</p>
                </div>
              </div>
            </div>
          ))}

          <div className="glass-card p-6">
            <h4 className="font-semibold text-sm text-accent mb-2">🔄 Alternative Plant Suggestions</h4>
            <div className="flex flex-wrap gap-2">
              {result.alternatives.map((a, i) => (
                <span key={i} className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">{a}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemedyFinder;
