from dotenv import load_dotenv
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
    }
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

        if tool_call.function.name == "get_category_totals":
            result = get_category_totals(db)

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