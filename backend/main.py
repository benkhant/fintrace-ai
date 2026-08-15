from ai import categorize_transaction, ask_agent, get_category_totals, CATEGORIES
from database import Base, engine, SessionLocal
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import io
import models
import pandas as pd
from plaid_client import client
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from sqlalchemy.orm import Session

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://fintrace-ai-weld.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "FinanceFlow AI backend is running"}

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))
    df["Date"] = pd.to_datetime(df["Date"]).dt.date

    db: Session = SessionLocal()
    added_count = 0

    for _, row in df.iterrows():
        exists = db.query(models.Transaction).filter_by(
            date=row['Date'],
            description=row['Description'],
            amount=row['Amount'],
        ).first()

        if exists:
            continue

        category = categorize_transaction(row["Description"])

        transaction = models.Transaction(
            date=row['Date'],
            description=row['Description'],
            amount=row['Amount'],
            category=category
        )
        db.add(transaction)
        added_count += 1

    db.commit()
    db.close()

    return {"message": f"Uploaded {added_count} new transactions ({len(df) - added_count} duplicates skipped)"}
    
@app.get("/transactions")
def get_transactions():
    db: Session = SessionLocal()
    transactions = db.query(models.Transaction).all()
    db.close()
    return transactions

@app.post("/ask")
def ask(question: str):
    db: Session = SessionLocal()
    answer = ask_agent(question, db)
    db.close()
    return {"answer": answer}

@app.get("/summary")
def get_summary():
    db: Session = SessionLocal()
    category_totals = get_category_totals(db)
    db.close()

    total_income = sum(v for v in category_totals.values() if v > 0)
    total_expenses = sum(v for v in category_totals.values() if v < 0)
    net = total_income + total_expenses

    return {
        "category_totals": category_totals,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net": round(net, 2),
    }

@app.delete("/transactions")
def clear_transactions():
    db: Session = SessionLocal()
    db.query(models.Transaction).delete()
    db.commit()
    db.close()
    return {"message": "All transactions deleted"}

@app.patch("/transactions/{transaction_id}")
def update_category(transaction_id: int, category: str):
    if category not in CATEGORIES:
        return {"error": "Invalid category"}

    db: Session = SessionLocal()
    transaction = db.query(models.Transaction).filter_by(id=transaction_id).first()

    if not transaction:
        db.close()
        return {"error": "Transaction not found"}

    transaction.category = category
    db.commit()
    db.close()

    return {"message": "Category updated", "id": transaction_id, "category": category}

@app.get("/categories")
def get_categories():
    return CATEGORIES

@app.post("/plaid/create-link-token")
def create_link_token():
    request = LinkTokenCreateRequest(
        products=[Products('transactions')],
        client_name="Fintrace AI",
        country_codes=[CountryCode('US')],
        language='en',
        user=LinkTokenCreateRequestUser(client_user_id="fintrace-user-1"),
    )
    response = client.link_token_create(request)
    return {"link_token": response.link_token}

@app.post("/plaid/exchange-token")
def exchange_token(public_token: str):
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    access_token = response.access_token

    db: Session = SessionLocal()
    existing = db.query(models.PlaidItem).first()
    if existing:
        existing.access_token = access_token
    else:
        db.add(models.PlaidItem(access_token=access_token))
    db.commit()
    db.close()

    return {"message": "Bank connected successfully"}

@app.post("/plaid/sync-transactions")
def sync_plaid_transactions():
    db: Session = SessionLocal()
    plaid_item = db.query(models.PlaidItem).first()

    if not plaid_item:
        db.close()
        return {"error": "No bank connected yet"}

    request = TransactionsSyncRequest(access_token=plaid_item.access_token)
    response = client.transactions_sync(request)
    added_transactions = response.added

    added_count = 0
    for t in added_transactions:
        category = categorize_transaction(t.name)
        amount = abs(t.amount)
        if category != "Income":
            amount = -amount

        exists = db.query(models.Transaction).filter_by(
            date=t.date,
            description=t.name,
            amount=amount,
        ).first()

        if exists:
            continue

        transaction = models.Transaction(
            date=t.date,
            description=t.name,
            amount=amount,
            category=category,
        )
        db.add(transaction)
        added_count += 1

    db.commit()
    db.close()

    return {"message": f"Synced {added_count} new transactions from bank"}