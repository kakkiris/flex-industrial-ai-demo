"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { id } from "@/lib/ids";

type Message = { role: "user" | "assistant"; content: string };

const INITIAL_GREETING =
  "Hi! I help match flex industrial space across Marisol. Tell me a bit about what you're looking for and I'll see what fits.";

const LEAD_MARKER = "[[LEAD_READY]]";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => id("cs"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [completed, setCompleted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasGreetedRef = useRef(false);
  const queryClient = useQueryClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  function handleOpen() {
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      setMessages([{ role: "assistant", content: INITIAL_GREETING }]);
    }
    setOpen(true);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming || completed) return;

    const userMsg: Message = { role: "user", content: text };
    const nextMessages: Message[] = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // placeholder assistant message that we'll grow as bytes arrive
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "" },
    ]);

    let accumulated = "";
    let leadReady = false;

    try {
      const res = await fetch("/api/chat/leasing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        // Check for lead marker anywhere in accumulated text
        if (accumulated.includes(LEAD_MARKER)) {
          leadReady = true;
          accumulated = accumulated.replace(LEAD_MARKER, "").trimEnd();
        }

        const displayText = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: displayText,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, the assistant ran into an issue. Try again.",
        };
        return updated;
      });
      setStreaming(false);
      return;
    }

    setStreaming(false);

    if (leadReady) {
      setCompleted(true);

      const finalMessages: Message[] = [
        ...nextMessages,
        { role: "assistant", content: accumulated },
      ];

      try {
        await fetch("/api/chat/leasing/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, transcript: finalMessages }),
        });
        await queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast.success("Lead saved to your inbox.");
      } catch {
        // non-fatal: lead may still have been saved
        toast.error("Lead capture had an issue. Check your inbox.");
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewConversation() {
    hasGreetedRef.current = false;
    setMessages([]);
    setCompleted(false);
    setInput("");
    setOpen(false);
    // reopen after a brief tick so the new greeting is injected
    setTimeout(() => {
      hasGreetedRef.current = true;
      setMessages([{ role: "assistant", content: INITIAL_GREETING }]);
      setOpen(true);
    }, 50);
  }

  return (
    <>
      {/* Visual revamp 2026-05-27. Brand-red kept only on the collapsed CTA
          (this is the "one primary action per surface", the prospect's
          single call to open the chat). Inside the panel, user bubbles use
          --foreground (charcoal) so brand indigo stays scarce. */}

      {/* Collapsed button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label="Open leasing chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[540px] rounded-md shadow-2xl bg-background border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Leasing Assistant</span>
            </div>
            <button
              onClick={handleClose}
              className="hover:opacity-70 transition-opacity"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-background-subtle">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isAssistant = msg.role === "assistant";
              return (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-md px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-foreground text-background rounded-br-sm"
                        : "bg-background border border-border text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                    {streaming && isLast && isAssistant && msg.content === "" ? (
                      <span className="inline-flex gap-0.5 items-center ml-1" aria-label="typing">
                        <span className="size-1 bg-foreground-faint rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="size-1 bg-foreground-faint rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="size-1 bg-foreground-faint rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : null}
                    {streaming && isLast && isAssistant && msg.content !== "" ? (
                      <span
                        aria-hidden="true"
                        className="inline-block w-px h-3 ml-0.5 align-middle bg-foreground animate-pulse"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Completed footer */}
          {completed ? (
            <div className="shrink-0 px-4 py-3 bg-background border-t border-border text-center">
              <p className="text-xs text-foreground-muted mb-1.5">Conversation complete</p>
              <button
                onClick={handleNewConversation}
                className="text-xs font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors"
              >
                Start a new conversation
              </button>
            </div>
          ) : (
            /* Input area */
            <div className="shrink-0 px-3 py-3 bg-background border-t border-border flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming || completed}
                placeholder="Type a message..."
                className="flex-1 h-9 text-sm rounded-sm border border-border bg-background px-3 focus:outline-none focus:border-foreground/30 placeholder:text-foreground-faint disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={streaming || completed || !input.trim()}
                className="w-9 h-9 rounded-sm bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
