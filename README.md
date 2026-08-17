# Fintrace AI

A personal finance app that connects to real bank accounts (via Plaid) or CSV uploads, automatically categorizes transactions with AI, and lets you ask questions about your spending in plain English.

**Live app:** [fintrace-ai-weld.vercel.app](https://fintrace-ai-weld.vercel.app)

Connect a bank or upload a file, see your transactions and spending breakdown on the dashboard, then hop over to the chat and ask things like "how much did I spend on groceries this month?" or "any recurring subscriptions?"

## What it does

- **Bank connection (Plaid)** — securely connect a real bank account and sync transactions automatically
- **CSV upload** — import transactions manually, with automatic duplicate detection
- **AI categorization** — every transaction gets a category (Groceries, Dining & Drinks, Subscriptions, etc.) automatically
- **Manual category correction** — override any AI-assigned category directly from the table
- **Dashboard analytics** — income/expense summary cards and a spending-by-category chart, always in sync with the latest data
- **Ask AI** — a conversational agent that reasons over multiple tools (category totals with date filtering, merchant search, recurring subscription detection) to answer real questions, grounded in your actual data
- **Encrypted credentials** — bank access tokens are encrypted at rest, using separate keys per environment

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Recharts — deployed on Vercel
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL — deployed on Render
- **AI:** OpenAI (`gpt-4o-mini`) for categorization and the tool-calling chat agent
- **Bank data:** Plaid (sandbox environment)
- **Security:** Fernet symmetric encryption for stored bank credentials

## Getting started (local development)

You'll need Python 3, Node.js, PostgreSQL, an [OpenAI API key](https://platform.openai.com/api-keys), and a [Plaid sandbox account](https://dashboard.plaid.com).

### Clone the repo

```bash
git clone https://github.com/benkhant/fintrace-ai.git
cd fintrace-ai
```

### Database

```bash
brew install postgresql@16
brew services start postgresql@16
createdb fintrace_dev
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
venv/bin/python3 -m pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

OPENAI_API_KEY=your-openai-key
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-sandbox-secret
PLAID_ENV=sandbox
ENCRYPTION_KEY=your-generated-fernet-key

Generate an encryption key with:
```bash
venv/bin/python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Never commit `.env`** — it's already excluded via `.gitignore`, but worth double-checking before pushing.

Start the server:

```bash
venv/bin/python3 -m uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive docs at `http://127.0.0.1:8000/docs`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/`:

NEXT_PUBLIC_API_URL=http://127.0.0.1:8000

```bash
npm run dev
```

Open `http://localhost:3000`. The dashboard is at `/`, and the chat is at `/ask`.

### Try it with sample data

A sample CSV is included at `backend/sample_transactions.csv`, spanning three months with a mix of one-off and recurring transactions. Upload it from the dashboard, or connect a bank via Plaid Link using its sandbox test credentials (test phone: `415-555-0011`, test bank login: `user_good` / `pass_good`).

## CSV format

| Column      | Description                          |
|-------------|--------------------------------------|
| `Date`      | Transaction date (e.g. `2026-07-01`) |
| `Description` | Merchant or memo                  |
| `Amount`    | Negative for expenses, positive for income |
| `Category`  | Optional — AI assigns a category automatically, overriding anything here |

## Example questions

- "What are my category totals this month?"
- "How much did I spend at Amazon?"
- "Any recurring subscriptions?"
- "What's my income and expenses this year?"

## Project structure

fintrace-ai/
├── backend/
│ ├── main.py # FastAPI routes
│ ├── ai.py # Categorization + chat agent tools
│ ├── plaid_client.py # Plaid API configuration
│ ├── encryption.py # Access token encryption/decryption
│ ├── models.py # Transaction and PlaidItem models
│ ├── database.py # PostgreSQL connection setup
│ └── sample_transactions.csv
└── frontend/
└── app/
├── page.tsx # Dashboard
└── ask/page.tsx # Chat interface

## Security notes

- Plaid access tokens are encrypted at rest using Fernet symmetric encryption, with separate encryption keys for local and production environments.
- All secrets (API keys, encryption keys, database credentials) are stored as environment variables, never committed to the repository.

## Known Limitations

- Subscription detection requires consistent AI categorization across occurrences of the same merchant. Since categorization uses an LLM, the same merchant can occasionally be assigned different categories on different transactions, which can cause a genuinely recurring charge to be missed by the subscription detector.
- This app currently supports one connected bank account at a time — connecting a new bank replaces the previously stored connection rather than adding a second one.
- There is no authentication system yet; all data belongs to a single implicit user.