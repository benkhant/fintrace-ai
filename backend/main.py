from ai import categorize_transaction, ask_agent, get_category_totals
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import Base, engine, SessionLocal
import models
import pandas as pd
import io

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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