"use client";

import { useState } from "react";

type Message = {
    role: "user" | "assistant";
    content: string;
};

export default function AskPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const question = input;
        setMessages((prev) => [...prev, { role: "user", content: question }]);
        setInput("")
        setLoading(true);

        try {
            const res = await fetch(
                `http://127.0.0.1:8000/ask?question=${encodeURIComponent(question)}`,
                { method: "POST"}
            );

            if (!res.ok) {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Something went wrong. Please try again."},
                ]);
                return;
            }

            const data = await res.json();
            setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Could not reach the server. Is the backend running?" },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 p-8 flex flex-col">
          <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Ask AI</h1>
    
            {messages.length > 0 && (
                <div className="flex-1 bg-white rounded-lg shadow-sm p-4 mb-4 overflow-y-auto min-h-[400px] flex flex-col gap-3">
                    {messages.map((m, i) => (
                        <div
                        key={i}
                        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                        m.role === "user"
                            ? "bg-blue-600 text-white self-end"
                            : "bg-gray-100 text-gray-900 self-start"
                        }`}
                    >
                        {m.content}
                    </div>
                    ))}

                    {loading && (
                    <div className="bg-gray-100 text-gray-500 text-sm px-4 py-2 rounded-lg self-start">
                        Thinking...
                    </div>
                    )}
                </div>
                )}
    
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about your spending..."
                className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-900"
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </main>
      );
}