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

        transaction = models.Transaction(
            date=row['Date'],
            description=row['Description'],
            amount=row['Amount'],
            category=row['Category'] if pd.notna(row['Category']) else None
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