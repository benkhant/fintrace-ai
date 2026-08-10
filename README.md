# Fintrace AI

A personal finance app that lets you upload bank transactions from a CSV, automatically categorize them with AI, and ask questions about your spending in plain English.

Upload a file, see your transactions on a dashboard, then hop over to the chat and ask things like "how much did I spend on groceries?" or "any recurring subscriptions?"

## What it does

- **CSV upload** — import transactions and skip duplicates automatically
- **AI categorization** — each transaction gets a category (Groceries, Dining, Subscriptions, etc.) on upload
- **Transaction dashboard** — browse everything in a simple table
- **Ask AI** — chat with an agent that can look up your data using tools like category totals, merchant search, and subscription detection

## Tech stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, SQLite
- **AI:** OpenAI (`gpt-4o-mini`) for categorization and the chat agent

## Getting started

You'll need Python 3, Node.js, and an [OpenAI API key](https://platform.openai.com/api-keys).

### Clone the repo

```bash
git clone https://github.com/benkhant/fintrace-ai.git
cd fintrace-ai
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
venv/bin/python3 -m pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
OPENAI_API_KEY=your-key-here
```

**Never commit this file** — it's already excluded via `.gitignore`, but worth double-checking before pushing any changes.

Start the server:

```bash
venv/bin/python3 -m uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The dashboard is at `/`, and the chat is at `/ask`.

### Try it with sample data

A sample CSV is included at `backend/sample_transactions.csv`. Upload it from the dashboard to populate a few months of transactions.

## CSV format

Your file needs these columns:

| Column      | Description                          |
|-------------|--------------------------------------|
| `Date`      | Transaction date (e.g. `2026-07-01`) |
| `Description` | Merchant or memo                 |
| `Amount`    | Negative for expenses, positive for income |
| `Category`  | Optional — AI assigns a category automatically |

Example:

```csv
Date,Description,Amount,Category
2026-07-01,Starbucks,-5.75,
2026-07-02,Paycheck,2500.00,
```

## Example questions

Once you've uploaded transactions, try asking:

- "What are my category totals?"
- "How much did I spend at Amazon?"
- "Any recurring subscriptions?"

## Project structure

```
fintrace-ai/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── ai.py            # Categorization + chat agent tools
│   ├── models.py        # Transaction model
│   ├── database.py      # SQLite setup
│   └── sample_transactions.csv
└── frontend/
    └── app/
        ├── page.tsx     # Dashboard
        └── ask/page.tsx # Chat interface
```

## Notes

- Uploads are append-only — re-uploading the same row is skipped, but old rows aren't removed. Delete `backend/financeflow.db` if you want a clean slate.
- The backend only accepts requests from `http://localhost:3000` during local development.
