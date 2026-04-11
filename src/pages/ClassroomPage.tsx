import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/lib/ai-stream";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export default function ClassroomPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syllabusId = searchParams.get("syllabus");
  
  const [syllabus, setSyllabus] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lessonPhase, setLessonPhase] = useState<"select" | "learning" | "quiz" | "results">("select");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!syllabusId) return;
    supabase.from("syllabi").select("*").eq("id", syllabusId).single().then(({ data }) => {
      if (data) setSyllabus(data);
    });
  }, [syllabusId]);

  const startLesson = async (topic: string) => {
    setSelectedTopic(topic);
    setLessonPhase("learning");
    setMessages([]);
    setIsLoading(true);

    const userMsg: Msg = { role: "user", content: `Please teach me about: ${topic}` };
    setMessages([userMsg]);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [userMsg],
        mode: "classroom",
        topic,
        syllabus_context: syllabus ? `${syllabus.board} ${syllabus.grade} ${syllabus.subject}` : undefined,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
      setIsLoading(false);
    }
  };

  const askFollowUp = async (prompt: string) => {
    if (isLoading) return;
    const userMsg: Msg = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        mode: "classroom",
        topic: selectedTopic || undefined,
        syllabus_context: syllabus ? `${syllabus.board} ${syllabus.grade} ${syllabus.subject}` : undefined,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}` }]);
      setIsLoading(false);
    }
  };

  const generateQuiz = async () => {
    setLessonPhase("quiz");
    setIsLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      let raw = "";
      await streamChat({
        messages: [{ role: "user", content: `Generate a quiz about: ${selectedTopic}` }],
        mode: "quiz",
        topic: selectedTopic || undefined,
        syllabus_context: syllabus ? `${syllabus.board} ${syllabus.grade} ${syllabus.subject}` : undefined,
        onDelta: (chunk) => { raw += chunk; },
        onDone: () => {},
      });

      // Try to parse JSON from the response
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        setQuizQuestions(questions);
      } else {
        setQuizQuestions([]);
      }
    } catch (e: any) {
      console.error("Quiz generation error:", e);
    }
    setIsLoading(false);
  };

  const submitQuiz = async () => {
    setQuizSubmitted(true);
    const score = quizQuestions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0);
    
    if (user && selectedTopic) {
      await supabase.from("quiz_results").insert({
        user_id: user.id,
        syllabus_id: syllabusId || undefined,
        topic: selectedTopic,
        score,
        total: quizQuestions.length,
        answers: quizAnswers,
      });

      // Update progress
      if (syllabusId && score / quizQuestions.length >= 0.6) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("progress")
          .eq("user_id", user.id)
          .eq("syllabus_id", syllabusId)
          .single();
        
        if (enrollment) {
          const progress = { ...(enrollment.progress as Record<string, boolean>), [selectedTopic]: true };
          await supabase.from("enrollments").update({ progress }).eq("user_id", user.id).eq("syllabus_id", syllabusId);
        }
      }
    }
    setLessonPhase("results");
  };

  const quizScore = quizQuestions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correct ? 1 : 0), 0);

  // Topic selection view
  if (lessonPhase === "select") {
    return (
      <div className="min-h-screen bg-background">
        <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading font-semibold">Virtual Classroom</h1>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          {!syllabus ? (
            <div className="text-center space-y-4">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-heading font-semibold">Select a course first</h2>
              <p className="text-muted-foreground">Go to your dashboard and select a course to start a lesson</p>
              <Button onClick={() => navigate("/dashboard")} className="bg-secondary text-secondary-foreground">Go to Dashboard</Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-heading font-bold">{syllabus.subject}</h2>
                <p className="text-muted-foreground">{syllabus.board} • {syllabus.grade}</p>
              </div>
              {(syllabus.chapters || []).map((ch: any, ci: number) => (
                <Card key={ci}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-heading">{ch.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {(ch.topics || []).map((topic: string, ti: number) => (
                      <button
                        key={ti}
                        onClick={() => startLesson(topic)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <span className="text-sm">{topic}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Quiz view
  if (lessonPhase === "quiz" || lessonPhase === "results") {
    return (
      <div className="min-h-screen bg-background">
        <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setLessonPhase("learning")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading font-semibold">Quiz: {selectedTopic}</h1>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
          {isLoading ? (
            <div className="text-center py-20">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-secondary" />
              <p className="mt-4 text-muted-foreground">Generating quiz questions...</p>
            </div>
          ) : quizQuestions.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Failed to generate quiz. Please try again.</p>
              <Button onClick={generateQuiz} className="mt-4 bg-secondary text-secondary-foreground">Retry</Button>
            </div>
          ) : (
            <>
              {lessonPhase === "results" && (
                <Card className="border-secondary/30">
                  <CardContent className="p-6 text-center">
                    <div className={`text-4xl font-heading font-bold ${quizScore / quizQuestions.length >= 0.7 ? "text-success" : quizScore / quizQuestions.length >= 0.4 ? "text-warning" : "text-destructive"}`}>
                      {quizScore}/{quizQuestions.length}
                    </div>
                    <p className="text-muted-foreground mt-1">
                      {quizScore / quizQuestions.length >= 0.7 ? "Great job! 🎉" : quizScore / quizQuestions.length >= 0.4 ? "Good effort! 📖" : "Keep practicing! 💪"}
                    </p>
                    <div className="flex gap-2 justify-center mt-4">
                      <Button onClick={() => setLessonPhase("select")} variant="outline">Back to Topics</Button>
                      <Button onClick={() => { setLessonPhase("learning"); }} className="bg-secondary text-secondary-foreground">Review Lesson</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {quizQuestions.map((q, qi) => (
                <Card key={qi} className={quizSubmitted && quizAnswers[qi] === q.correct ? "border-success/30" : quizSubmitted && quizAnswers[qi] !== undefined ? "border-destructive/30" : ""}>
                  <CardContent className="p-5 space-y-3">
                    <p className="font-medium text-sm">Q{qi + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                          className={`w-full text-left p-3 rounded-lg text-sm border transition-colors ${
                            quizSubmitted
                              ? oi === q.correct
                                ? "bg-success/10 border-success/30"
                                : quizAnswers[qi] === oi
                                  ? "bg-destructive/10 border-destructive/30"
                                  : "border-border"
                              : quizAnswers[qi] === oi
                                ? "bg-secondary/10 border-secondary"
                                : "border-border hover:bg-muted"
                          }`}
                          disabled={quizSubmitted}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {quizSubmitted && q.explanation && (
                      <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                        💡 {q.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}

              {!quizSubmitted && (
                <Button
                  onClick={submitQuiz}
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                >
                  Submit Quiz ({Object.keys(quizAnswers).length}/{quizQuestions.length} answered)
                </Button>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  // Learning view
  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="gradient-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setLessonPhase("select")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-heading font-semibold text-sm">{selectedTopic}</h1>
            <p className="text-xs opacity-70">{syllabus?.subject}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={generateQuiz} disabled={isLoading}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Take Quiz
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              m.role === "user"
                ? "bg-secondary text-secondary-foreground rounded-br-md"
                : "bg-card border rounded-bl-md"
            }`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick action buttons */}
      <div className="border-t bg-card px-4 py-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" onClick={() => askFollowUp("Explain again differently")} disabled={isLoading}>
            🔄 Explain differently
          </Button>
          <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" onClick={() => askFollowUp("Teach me like I'm 10 years old")} disabled={isLoading}>
            🧒 Like I'm 10
          </Button>
          <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" onClick={() => askFollowUp("Give me more examples")} disabled={isLoading}>
            📝 More examples
          </Button>
          <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" onClick={() => askFollowUp("Summarize everything so far")} disabled={isLoading}>
            📋 Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
