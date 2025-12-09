import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Bot, 
  User,
  Github,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Project {
  id: string;
  name: string;
  github_url: string;
  github_data?: {
    readme?: string;
    structure?: string;
    dependencies?: string;
  } | null;
}

const ProjectChat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("projects")
          .select("id, name, github_url, github_data")
          .eq("id", id)
          .single();

        if (error) throw error;
        
        const githubData = data.github_data as { readme?: string; structure?: string; dependencies?: string } | null;
        setProject({
          ...data,
          github_data: githubData
        });

        // Add welcome message
        setMessages([{
          role: "assistant",
          content: `👋 Olá! Sou seu assistente AI para o projeto **${data.name}**.\n\nPosso responder perguntas sobre:\n- 📋 Arquitetura e estrutura do código\n- 🔧 Como implementar funcionalidades\n- 🐛 Debugging e resolução de problemas\n- 📚 Explicações sobre partes específicas do código\n- 💡 Sugestões de melhorias\n\nComo posso ajudar?`
        }]);
      } catch (error) {
        console.error("Error fetching project:", error);
        toast.error("Erro ao carregar projeto");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !project) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke("project-chat", {
        body: {
          projectId: project.id,
          message: userMessage,
          history: messages.slice(-10), // Last 10 messages for context
          projectContext: {
            name: project.name,
            github_url: project.github_url,
            readme: project.github_data?.readme?.substring(0, 3000),
            structure: project.github_data?.structure,
            dependencies: project.github_data?.dependencies
          }
        }
      });

      if (response.error) throw response.error;

      const assistantMessage = response.data?.response || "Desculpe, não consegui processar sua pergunta.";
      setMessages(prev => [...prev, { role: "assistant", content: assistantMessage }]);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Desculpe, ocorreu um erro ao processar sua pergunta. Por favor, tente novamente." 
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Projeto não encontrado</p>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/projeto/${id}`)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    Ask AI
                    <span className="text-sm font-normal text-muted-foreground">sobre</span>
                    {project.name}
                  </h1>
                  <a 
                    href={project.github_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Github className="w-3 h-3" />
                    {project.github_url.replace('https://github.com/', '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 container mx-auto px-4 py-4 flex flex-col max-w-4xl">
        <ScrollArea ref={scrollRef} className="flex-1 pr-4">
          <div className="space-y-4 pb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="p-2 rounded-full bg-primary/10 h-fit">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <Card className={`max-w-[80%] p-4 ${
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card"
                }`}>
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </Card>
                {message.role === "user" && (
                  <div className="p-2 rounded-full bg-primary h-fit">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="p-2 rounded-full bg-primary/10 h-fit">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <Card className="p-4 bg-card">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Pensando...</span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="pt-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pergunte algo sobre o projeto..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            O AI tem acesso ao README, estrutura e dependências do projeto para fornecer respostas contextualizadas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProjectChat;
