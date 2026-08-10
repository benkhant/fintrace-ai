"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
  }, []);

  const fetchTransactions = async () => {
    const res = await fetch("http://127.0.0.1:8000/transactions");
    const data = await res.json();
    setTransactions(data);
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/summary");
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
      const res = await fetch("http://127.0.0.1:8000/upload-csv", {
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
  } catch (err) {
    setMessage("Could not reach the server. Is the backend running?");
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
            onClick={fetchTransactions}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition"
          >
            Refresh Transactions
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
                  <td className="px-4 py-3 text-gray-500">{t.category ?? "—"}</td>
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