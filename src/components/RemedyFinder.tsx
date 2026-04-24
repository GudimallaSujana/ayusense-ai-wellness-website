import { useState } from "react";
import { ArrowLeft, Search, Loader2, AlertTriangle, Salad, Dumbbell, Leaf, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { findRemedy, type RemedyResult } from "@/lib/api";

const plainLanguageTerms: Record<string, string> = {
  "Ushna Virya": "a warming effect on the body",
  Ushna: "warming",
  Virya: "effect on the body",
  Pitta: "heat and acidity imbalance",
  Kapha: "heaviness, mucus, or sluggishness imbalance",
  Vata: "dryness, gas, or restlessness imbalance",
  Rasa: "taste profile",
  Guna: "natural qualities",
  Vipaka: "after-digestion effect",
  Prabhav: "special traditional action",
};

const toPlainLanguage = (value?: string) => {
  if (!value) return "";
  return Object.entries(plainLanguageTerms).reduce(
    (text, [term, replacement]) => text.replace(new RegExp(`\\b${term}\\b`, "g"), replacement),
    value,
  );
};

const SectionList = ({ icon: Icon, title, items }: { icon: typeof Leaf; title: string; items?: string[] }) => {
  const safeItems = items || [];
  if (safeItems.length === 0) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold text-sm text-accent mb-3 flex items-center gap-2">
        <Icon size={16} /> {title}
      </h3>
      <ul className="space-y-2 text-sm text-foreground/80">
        {safeItems.map((item, index) => (
          <li key={index} className="leading-relaxed">• {toPlainLanguage(item)}</li>
        ))}
      </ul>
    </div>
  );
};

const RemedyFinder = ({ onBack }: { onBack: () => void }) => {
  const [symptoms, setSymptoms] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemedyResult | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await findRemedy(symptoms, location || undefined);
      if (data.error) setError(data.error);
      setResult(data);
    } catch (err: any) {
      const message = err.message || "Could not analyze symptoms. Please try again.";
      setError(message);
      toast({ title: "Analysis Failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasResults = Boolean(
    (result?.matchedConditions || []).length ||
    (result?.herbs || []).length ||
    (result?.remedies || []).length ||
    result?.explanation,
  );

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6 text-sm"
      >
        <ArrowLeft size={16} /> Back to options
      </button>

      <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">Find Ayurvedic Remedy</h2>
      <p className="text-muted-foreground mb-8">Enter your symptoms for database-matched Ayurvedic recommendations with simple explanations.</p>

      <form onSubmit={handleSubmit} className="glass-card p-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground/80 mb-1 block">Symptoms / Disease</label>
          <Input
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. stress, headache, insomnia, fatigue, joint pain"
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
          {loading ? <><Loader2 className="animate-spin mr-2" size={16} /> Finding Remedies...</> : <><Search className="mr-2" size={16} /> Find Remedies</>}
        </Button>
      </form>

      {error && <div className="mt-6 p-4 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">{error}</div>}

      {result && (
        <div className="mt-8 space-y-6 animate-fade-in-up">
          {!hasResults && <div className="glass-card p-6 text-sm text-muted-foreground">No remedy matches were found. Try adding more specific symptoms.</div>}

          {(result.matchedConditions || []).length > 0 && (
            <div className="glass-card p-6">
              <h3 className="font-serif text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <Stethoscope size={18} /> Matched Conditions
              </h3>
              <div className="flex flex-wrap gap-2">
                {(result.matchedConditions || []).map((condition, index) => (
                  <span key={index} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{condition}</span>
                ))}
              </div>
              {(result.severity || result.duration) && (
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  {result.severity && <span className="bg-accent/10 text-accent px-3 py-1 rounded-full">Severity: {result.severity}</span>}
                  {result.duration && <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">Duration: {result.duration}</span>}
                </div>
              )}
            </div>
          )}

          {result.explanation && (
            <div className="glass-card p-6 border-l-4 border-accent">
              <h3 className="font-serif text-xl font-bold text-primary mb-3">Simple Explanation</h3>
              <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{toPlainLanguage(result.explanation)}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <SectionList icon={Leaf} title="Recommended Herbs" items={result.herbs} />
            <SectionList icon={AlertTriangle} title="Database Remedies" items={result.remedies} />
            <SectionList icon={Salad} title="Diet & Lifestyle" items={result.diet} />
            <SectionList icon={Dumbbell} title="Yoga & Therapy" items={result.yoga} />
          </div>

          {result.disclaimer && (
            <div className="text-xs text-muted-foreground text-center p-4 border border-border/50 rounded-lg">
              ⚕️ {result.disclaimer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RemedyFinder;
