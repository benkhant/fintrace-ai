"use client";

import { useState } from "react";

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

  const fetchTransactions = async () => {
    const res = await fetch("http://127.0.0.1:8000/transactions");
    const data = await res.json();
    setTransactions(data);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">FinanceFlow AI</h1>
  
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