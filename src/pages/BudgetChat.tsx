import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/budget-chat`;

const BudgetChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "G'day! 👋 I'm **Budget Mate**, your grocery budget assistant. I can help you save on groceries, plan meals on a budget, and make the most of specials.\n\nWhat can I help you with today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadContext();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadContext = async () => {
    // Gather household + spending data for personalised advice
    const [{ data: household }, { data: receipts }] = await Promise.all([
      supabase
        .from('households')
        .select('*')
        .eq('user_id', user!.id)
        .single(),
      supabase
        .from('receipts')
        .select('store_name, total_amount, shop_date')
        .eq('user_id', user!.id)
        .in('status', ['confirmed', 'reviewed'])
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const parts: string[] = [];
    if (household) {
      parts.push(
        `Household: ${household.adults} adults, ${household.children} children, type: ${household.household_type}`
      );
      if (household.dietary_preferences)
        parts.push(`Dietary: ${household.dietary_preferences}`);
      if (household.budget_priority)
        parts.push(`Priority: ${household.budget_priority}`);
      if ((household as any).weekly_budget)
        parts.push(`Weekly budget: ${(household as any).weekly_budget}`);
      if ((household as any).brand_preference)
        parts.push(`Brand preference: ${(household as any).brand_preference}`);
      if ((household as any).shopping_frequency)
        parts.push(`Shopping frequency: ${(household as any).shopping_frequency}`);
    }
    if (receipts && receipts.length > 0) {
      const total = receipts.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
      const stores = [...new Set(receipts.map((r) => r.store_name).filter(Boolean))];
      parts.push(`Recent spending: $${total.toFixed(2)} across ${receipts.length} shops`);
      if (stores.length > 0) parts.push(`Shops at: ${stores.join(', ')}`);
    }
    setUserContext(parts.join('\n'));
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          context: userContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        toast({ title: err.error || 'Something went wrong', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length > updatedMessages.length) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
            );
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast({ title: 'Failed to get response', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="px-4 pt-6 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Budget Mate</h1>
              <p className="text-xs text-muted-foreground">Your grocery budget assistant</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <Card
                className={`max-w-[80%] px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </Card>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <Card className="bg-muted px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </Card>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your grocery budget..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Budget Mate uses AI and may not always be accurate
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default BudgetChat;
