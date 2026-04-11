import { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, MessageSquare, BookOpen, Trophy, LogOut, BarChart3, Settings } from "lucide-react";

interface Enrollment {
  id: string;
  syllabus_id: string;
  progress: Record<string, boolean>;
  syllabi: { board: string; grade: string; subject: string; chapters: any[] };
}

export default function DashboardPage() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [quizScores, setQuizScores] = useState<{ topic: string; score: number; total: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: enr } = await supabase
        .from("enrollments")
        .select("id, syllabus_id, progress, syllabi(board, grade, subject, chapters)")
        .eq("user_id", user.id) as any;
      if (enr) setEnrollments(enr);

      const { data: scores } = await supabase
        .from("quiz_results")
        .select("topic, score, total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (scores) setQuizScores(scores);
    };
    fetchData();
  }, [user]);

  const getProgress = (enrollment: Enrollment) => {
    const chapters = enrollment.syllabi?.chapters || [];
    let totalTopics = 0;
    let completedTopics = 0;
    chapters.forEach((ch: any) => {
      (ch.topics || []).forEach((t: string) => {
        totalTopics++;
        if (enrollment.progress?.[t]) completedTopics++;
      });
    });
    return totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <GraduationCap className="h-5 w-5 text-secondary-foreground" />
            </div>
            <h1 className="text-xl font-heading font-bold">Virtual AI Classroom</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80">{profile?.full_name || user?.email}</span>
            {role === "admin" && (
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            Welcome back, {profile?.full_name || "Student"} 👋
          </h2>
          <p className="text-muted-foreground mt-1">Continue your learning journey</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-secondary/20" onClick={() => navigate("/chat")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                <MessageSquare className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="font-heading font-semibold">AI Assistant</p>
                <p className="text-sm text-muted-foreground">Ask anything</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-secondary/20" onClick={() => navigate("/classroom")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20">
                <BookOpen className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="font-heading font-semibold">Classroom</p>
                <p className="text-sm text-muted-foreground">Start a lesson</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-secondary/20" onClick={() => navigate("/syllabus")}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Trophy className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="font-heading font-semibold">Browse Syllabi</p>
                <p className="text-sm text-muted-foreground">Enroll in courses</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enrolled Courses */}
        <section>
          <h3 className="text-lg font-heading font-semibold mb-4">My Courses</h3>
          {enrollments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No courses yet.</p>
                <Button className="mt-4 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => navigate("/syllabus")}>
                  Browse Syllabi
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrollments.map(e => (
                <Card key={e.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-heading">{e.syllabi?.subject}</CardTitle>
                      <Badge variant="secondary">{e.syllabi?.grade}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{e.syllabi?.board}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={getProgress(e)} className="flex-1" />
                      <span className="text-sm font-medium text-muted-foreground">{getProgress(e)}%</span>
                    </div>
                    <Button size="sm" className="mt-3 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => navigate(`/classroom?syllabus=${e.syllabus_id}`)}>
                      Continue Learning
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Quiz Scores */}
        {quizScores.length > 0 && (
          <section>
            <h3 className="text-lg font-heading font-semibold mb-4">Recent Quiz Scores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quizScores.map((q, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{q.topic}</p>
                      <p className="text-xs text-muted-foreground">Score</p>
                    </div>
                    <div className={`text-xl font-heading font-bold ${q.score / q.total >= 0.7 ? "text-success" : q.score / q.total >= 0.4 ? "text-warning" : "text-destructive"}`}>
                      {q.score}/{q.total}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
