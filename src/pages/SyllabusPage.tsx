import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SyllabusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("syllabi").select("*").order("created_at", { ascending: false });
      if (data) setSyllabi(data);
      if (user) {
        const { data: enr } = await supabase.from("enrollments").select("syllabus_id").eq("user_id", user.id);
        if (enr) setEnrolledIds(new Set(enr.map(e => e.syllabus_id)));
      }
    };
    fetch();
  }, [user]);

  const enroll = async (syllabusId: string) => {
    if (!user) return;
    const { error } = await supabase.from("enrollments").insert({ user_id: user.id, syllabus_id: syllabusId });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEnrolledIds(prev => new Set([...prev, syllabusId]));
      toast({ title: "Enrolled!", description: "Course added to your dashboard" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-heading font-semibold">Browse Syllabi</h1>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {syllabi.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-heading font-semibold mt-4">No syllabi available yet</h2>
            <p className="text-muted-foreground mt-2">An admin needs to create syllabi first</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {syllabi.map(s => {
              const topicCount = (s.chapters || []).reduce((acc: number, ch: any) => acc + (ch.topics?.length || 0), 0);
              return (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-heading">{s.subject}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{s.grade}</Badge>
                        <Badge variant="outline">{s.board}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      {(s.chapters || []).length} chapters • {topicCount} topics
                    </p>
                    {enrolledIds.has(s.id) ? (
                      <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => navigate(`/classroom?syllabus=${s.id}`)}>
                        Go to Classroom
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => enroll(s.id)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                        <Plus className="h-4 w-4 mr-1" /> Enroll
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
