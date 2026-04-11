import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Stethoscope, Briefcase, School, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ACADEMIC_TYPES = [
  { value: "engineering", label: "Engineering", icon: GraduationCap, branches: ["Computer Science", "Mechanical", "Civil", "Electrical", "Electronics", "Chemical"] },
  { value: "mba", label: "MBA", icon: Briefcase, branches: ["Finance", "Marketing", "HR", "Operations", "IT Management"] },
  { value: "medical", label: "Medical", icon: Stethoscope, branches: ["MBBS", "BDS", "Pharmacy", "Nursing", "Physiotherapy"] },
  { value: "school", label: "School", icon: School, branches: ["CBSE", "ICSE", "State Board", "IB", "Cambridge"] },
];

export default function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<"type" | "branch">("type");
  const [selectedType, setSelectedType] = useState<typeof ACADEMIC_TYPES[0] | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSelectBranch = async (branch: string) => {
    if (!user || !selectedType) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ academic_type: selectedType.value, branch })
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    await refreshProfile();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <Card className="w-full max-w-lg border-0 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-heading">Welcome! Let's personalize your learning</CardTitle>
          <CardDescription>
            {step === "type" ? "What are you studying?" : `Select your ${selectedType?.label} stream`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {step === "type" ? (
              <motion.div key="type" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="grid grid-cols-2 gap-3">
                {ACADEMIC_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => { setSelectedType(t); setStep("branch"); }}
                      className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-border hover:border-secondary hover:bg-secondary/5 transition-all"
                    >
                      <Icon className="h-8 w-8 text-secondary" />
                      <span className="font-heading font-semibold text-sm">{t.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div key="branch" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-2">
                <Button variant="ghost" size="sm" className="mb-2 text-muted-foreground" onClick={() => setStep("type")}>
                  ← Back
                </Button>
                {selectedType?.branches.map((b) => (
                  <button
                    key={b}
                    disabled={saving}
                    onClick={() => handleSelectBranch(b)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-secondary hover:bg-secondary/5 transition-all text-left"
                  >
                    <span className="font-medium text-sm">{b}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
