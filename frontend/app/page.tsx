"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { usePlaidLink } from "react-plaid-link";
import { useState, useEffect } from "react";

type Transaction = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string | null;
};

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    category_totals: Record<string, number>;
    total_income: number;
    total_expenses: number;
    net: number;
  } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token: string | null) => {
      if (!public_token) return;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plaid/exchange-token?public_token=${public_token}`, {
          method: "POST",
        });
        setMessage("Bank connected successfully!");
      } catch (err) {
        setMessage("Could not connect bank.");
      }
    },
  });

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
    fetchLinkToken();
  }, []);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`)
      .then((res) => res.json())
      .then(setCategories);
  }, []);

  const fetchTransactions = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`);
    const data = await res.json();
    setTransactions(data);
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error("Could not load summary");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please choose a CSV file first.");
      return;
    }

    setMessage("Uploading CSV file...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload-csv`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setMessage("Upload failed. Please check the file format and try again.");
      return;
    }

    const data = await res.json();
    setMessage(data.message);
    fetchTransactions();
    fetchSummary();
  } catch (err) {
    setMessage("Could not reach the server. Is the backend running?");
  }
};

  const handleClearAll = async () => {
    if (!confirm("Delete all transactions? This cannot be undone.")) return;

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions`, { method: "DELETE" });
      fetchTransactions();
      fetchSummary();
      setMessage("All transactions deleted.")
    } catch (err) {
      setMessage("Could not reach the server.");
    }
  };

  const handleCategoryChange = async (id: number, newCategory: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/transactions/${id}?category=${encodeURIComponent(newCategory)}`, {
        method: "PATCH",
      });
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, category: newCategory } : t))
      );
      fetchSummary();
    } catch (error) {
      console.error("Could not update category");
    }
  };

  const fetchLinkToken = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plaid/create-link-token`, {
        method: "POST",
      });
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error("Could not connect to Plaid.");
    }
  };

  const handleSyncTransactions = async () => {
    setMessage("Syncing transactions from bank...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/plaid/sync-transactions`, {
        method: "POST",
    });
    const data = await res.json();
    setMessage(data.message || data.error);
    fetchTransactions();
    fetchSummary();
  } catch (err) {
    setMessage("Could not sync transactions.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Fintrace AI</h1>

        {summary && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Total Income</p>
                <p className="text-2xl font-bold text-green-600">
                  ${summary.total_income.toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  ${Math.abs(summary.total_expenses).toFixed(2)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Net</p>
                <p className={`text-2xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${summary.net.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <p className="text-sm text-gray-500 mb-2">Spending by Category</p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={Object.entries(summary.category_totals)
                    .filter(([, value]) => value < 0)
                    .map(([category, value]) => ({ category, amount: Math.abs(value) }))}
                >
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
  
        <div className="flex items-center gap-3 mb-6 bg-white p-4 rounded-lg shadow-sm">
        <label className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition border border-gray-300">
          Choose File
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>

        <span className="text-sm text-gray-500">
          {file ? file.name : "No file chosen"}
        </span>

          <button
            onClick={handleUpload}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
          >
            Upload CSV
          </button>
          <button
            onClick={handleClearAll}
            className="bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-200 transition"
          >
            Clear All Data
          </button>
          <button
            onClick={() => open()}
            disabled={!ready}
            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
          >
            Connect Bank
          </button>
          <button
            onClick={handleSyncTransactions}
            className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition"
          >
            Sync Transactions
          </button>
        </div>

        {message && (
          <p className="text-sm text-gray-600 mb-4"> {message} </p>
        )}
  
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-600">{t.date}</td>
                  <td className="px-4 py-3 text-gray-900">{t.description}</td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      t.amount < 0 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {t.amount < 0 ? "-" : "+"}${Math.abs(t.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.category ?? ""}
                      onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                      className="text-sm text-gray-700 border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
  
          {transactions.length === 0 && (
            <p className="text-center text-gray-400 py-8">
              No transactions yet. Upload a CSV to get started.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}