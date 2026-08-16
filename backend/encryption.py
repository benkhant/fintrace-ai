import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()

fernet = Fernet(os.getenv("ENCRYPTION_KEY").encode())

def encrypt_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    return fernet.decrypt(encrypted_token.encode()).decode()