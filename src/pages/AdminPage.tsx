import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Users, BarChart3, BookOpen, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Syllabus form
  const [board, setBoard] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [chaptersJson, setChaptersJson] = useState('[\n  {\n    "title": "Chapter 1",\n    "topics": ["Topic A", "Topic B"]\n  }\n]');

  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard");
      return;
    }
    const fetchData = async () => {
      const [profilesRes, syllabiRes, quizRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("syllabi").select("*").order("created_at", { ascending: false }),
        supabase.from("quiz_results").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (profilesRes.data) setStudents(profilesRes.data);
      if (syllabiRes.data) setSyllabi(syllabiRes.data);
      if (quizRes.data) setQuizResults(quizRes.data);
    };
    fetchData();
  }, [role]);

  const createSyllabus = async () => {
    try {
      const chapters = JSON.parse(chaptersJson);
      const { error } = await supabase.from("syllabi").insert({
        board, grade, subject, chapters, created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast({ title: "Syllabus created!" });
      setDialogOpen(false);
      // Refresh
      const { data } = await supabase.from("syllabi").select("*").order("created_at", { ascending: false });
      if (data) setSyllabi(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteSyllabus = async (id: string) => {
    const { error } = await supabase.from("syllabi").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSyllabi(prev => prev.filter(s => s.id !== id));
      toast({ title: "Syllabus deleted" });
    }
  };

  // Analytics
  const avgScore = quizResults.length > 0
    ? Math.round(quizResults.reduce((acc, r) => acc + (r.score / r.total) * 100, 0) / quizResults.length)
    : 0;

  const topicScores: Record<string, { total: number; correct: number; count: number }> = {};
  quizResults.forEach(r => {
    if (!topicScores[r.topic]) topicScores[r.topic] = { total: 0, correct: 0, count: 0 };
    topicScores[r.topic].total += r.total;
    topicScores[r.topic].correct += r.score;
    topicScores[r.topic].count += 1;
  });
  const weakTopics = Object.entries(topicScores)
    .map(([topic, data]) => ({ topic, avg: Math.round((data.correct / data.total) * 100) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-heading font-semibold">Admin Dashboard</h1>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                <Users className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold">{students.length}</p>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
                <BookOpen className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold">{syllabi.length}</p>
                <p className="text-sm text-muted-foreground">Syllabi</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <BarChart3 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold">{avgScore}%</p>
                <p className="text-sm text-muted-foreground">Avg Score</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="syllabi">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="syllabi">Syllabi</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="syllabi" className="mt-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-heading font-semibold">Manage Syllabi</h3>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-secondary text-secondary-foreground"><Plus className="h-4 w-4 mr-1" /> Add Syllabus</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Syllabus</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <Input placeholder="Board (e.g., CBSE)" value={board} onChange={e => setBoard(e.target.value)} />
                    <Input placeholder="Grade (e.g., 10th)" value={grade} onChange={e => setGrade(e.target.value)} />
                    <Input placeholder="Subject (e.g., Physics)" value={subject} onChange={e => setSubject(e.target.value)} />
                    <div>
                      <label className="text-sm font-medium mb-1 block">Chapters (JSON)</label>
                      <Textarea rows={8} value={chaptersJson} onChange={e => setChaptersJson(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <Button onClick={createSyllabus} className="w-full bg-secondary text-secondary-foreground">Create</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {syllabi.map(s => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.subject}</p>
                    <p className="text-sm text-muted-foreground">{s.board} • {s.grade} • {(s.chapters || []).length} chapters</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteSyllabus(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <div className="space-y-2">
              {students.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.full_name || "Unnamed"}</p>
                      <p className="text-sm text-muted-foreground">ID: {s.user_id?.slice(0, 8)}...</p>
                    </div>
                    <Badge variant="secondary">Student</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6 space-y-6">
            <div>
              <h3 className="font-heading font-semibold mb-3">Weak Topics (Lowest Scores)</h3>
              {weakTopics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No quiz data yet</p>
              ) : (
                <div className="space-y-2">
                  {weakTopics.map((t, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-sm">{t.topic}</span>
                        <Badge variant={t.avg >= 70 ? "secondary" : "destructive"}>{t.avg}%</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
