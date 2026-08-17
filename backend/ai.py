from collections import defaultdict
from datetime import date
from dotenv import load_dotenv
import json
import models
import os
from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

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

def get_category_totals(db: Session, start_date: date = None, end_date: date = None):
    query = db.query(models.Transaction.category, func.sum(models.Transaction.amount))

    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)

    results = query.group_by(models.Transaction.category).all()
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

def detect_recurring_subscriptions(db: Session):
    all_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.amount < 0)
        .all()
    )

    grouped = defaultdict(list)
    for t in all_transactions:
        grouped[t.description].append(t)

    subscriptions = []
    for description, txns in grouped.items():
        if len(txns) < 2:
            continue

        categories = {t.category for t in txns if t.category}
        if categories and "Subscriptions" not in categories:
            continue

        amounts = [round(t.amount, 2) for t in txns]
        if len(set(amounts)) > 1:
            continue

        months = {(t.date.year, t.date.month) for t in txns}
        if len(months) != len(txns):
            continue

        avg_amount = sum(amounts) / len(amounts)
        subscriptions.append({
            "description": description,
            "occurrences": len(txns),
            "average_amount": round(avg_amount, 2),
            "dates": sorted(str(t.date) for t in txns),
        })

    subscriptions.sort(key=lambda s: s["average_amount"])
    return {"subscriptions": subscriptions, "count": len(subscriptions)}


def format_recurring_subscriptions(result: dict) -> str:
    subs = result.get("subscriptions", [])
    if not subs:
        return "No recurring subscriptions found in your transaction history."

    lines = [f"Found {len(subs)} recurring charge(s):\n"]
    for sub in subs:
        amount = abs(sub["average_amount"])
        lines.append(f"• {sub['description']}")
        lines.append(f"  ${amount:.2f} × {sub['occurrences']} charges")
        lines.append(f"  Dates: {', '.join(sub['dates'])}")
        lines.append("")

    monthly_total = sum(abs(s["average_amount"]) for s in subs)
    lines.append(f"Estimated monthly total: ${monthly_total:.2f}")
    return "\n".join(lines)

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_category_totals",
            "description": "Get the total amount spent or earned in each spending category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format. Omit for no start limit.",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format. Omit for no end limit.",
                    },
                },
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
    {
        "type": "function",
        "function": {
            "name": "detect_recurring_subscriptions",
            "description": "Find transactions that repeat with a consistent amount over time, which often indicates a subscription or recurring expense.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format. Omit for no start limit.",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format. Omit for no end limit.",
                    },
                },
                "required": [],
            },
        },
    },
]

def ask_agent(question: str, db: Session):
    messages = [{"role": "user", "content": question}]
    today = date.today().isoformat()

    for _ in range(5):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                { 
                    "role": "system",
                    "content": (
                        f"You are a personal finance assistant. Today's date is {today}. "
                        "When the user asks about a relative time period like 'this month', "
                        "'last week', or 'this year', calculate the actual date range based on "
                        "today's date before calling any tools. Present tool results clearly "
                        "using plain text with line breaks. Do not use markdown formatting."
                    ),
                },
                *messages,
            ],
            tools=tools,
        )

        reply = response.choices[0].message

        if not reply.tool_calls:
            return reply.content

        messages.append(reply)

        for tool_call in reply.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            if function_name == "get_category_totals":
                start = arguments.get("start_date")
                end = arguments.get("end_date")
                result = get_category_totals(
                    db,
                    date.fromisoformat(start) if start else None,
                    date.fromisoformat(end) if end else None,
                )
            elif function_name == "search_transactions":
                result = search_transactions(db, arguments["keyword"])
            elif function_name == "detect_recurring_subscriptions":
                raw_result = detect_recurring_subscriptions(db)
                result = format_recurring_subscriptions(raw_result)
            else: 
                result = "Unknown tool."

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result if isinstance(result, str) else json.dumps(result),
            })
    
    return "Sorry, I wasn't able to fully answer that question."