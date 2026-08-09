from dotenv import load_dotenv
import json
import os
from openai import OpenAI
from sqlalchemy.orm import Session
from sqlalchemy import func
import models

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CATEGORIES = [
    "Groceries",
    "Dining & Drinks",
    "Transportation",
    "Shopping",
    "Bills & Utilities",
    "Subscriptions",
    "Entertainment",
    "Income",
    "Other",
]

def categorize_transaction(description: str) -> str:
    prompt = f"""Categorize this transaction description into exactly one of these categories: 
{', '.join(CATEGORIES)}

Transaction description: "{description}"

Respond with ONLY the category name, nothing else."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )

    category = response.choices[0].message.content.strip()

    if category not in CATEGORIES:
        return "Other"

    return category

def get_category_totals(db: Session):
    results = (
        db.query(models.Transaction.category, func.sum(models.Transaction.amount))
        .group_by(models.Transaction.category)
        .all()
    )
    return {category: round(total, 2) for category, total in results}

def search_transactions(db: Session, keyword: str):
    results = (
        db.query(models.Transaction)
        .filter(models.Transaction.description.ilike(f"%{keyword}%"))
        .all()
    )

    total = sum(t.amount for t in results)

    return {
        "transactions": [
            {
                "date": str(t.date),
                "description": t.description,
                "amount": t.amount,
                "category": t.category,
            }
            for t in results
        ],
        "total": round(total, 2),
        "count": len(results),
    }

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_category_totals",
            "description": "Get the total amount spent or earned in each spending category.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_transactions",
            "description": "Search transactions by keyword, such as a merchant name or part of a description. Returns matching transactions and their total.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "The keyword to search for in transaction descriptions, e.g. 'Starbucks' or 'Amazon'.",
                    },
                },
                "required": ["keyword"],
            },
        },
    },
]

def ask_agent(question: str, db: Session):
    messages = [{"role": "user", "content": question}]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=tools,
    )

    reply = response.choices[0].message

    if reply.tool_calls:
        tool_call = reply.tool_calls[0]
        function_name = tool_call.function.name
        arguments = json.loads(tool_call.function.arguments)

        if function_name == "get_category_totals":
            result = get_category_totals(db)
        elif function_name == "search_transactions":
            result = search_transactions(db, arguments["keyword"])

        messages.append(reply)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": str(result),
        })

        second_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )

        return second_response.choices[0].message.content
    
    return reply.content