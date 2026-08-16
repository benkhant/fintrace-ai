import os
from dotenv import load_dotenv
import plaid
from plaid.api import plaid_api

load_dotenv()

PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")
host = plaid.Environment.Sandbox if PLAID_ENV == "sandbox" else plaid.Environment.Production

configuration = plaid.Configuration(
    host=host,
    api_key={
        "clientId": os.getenv("PLAID_CLIENT_ID"),
        "secret": os.getenv("PLAID_SECRET"),
    },
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)