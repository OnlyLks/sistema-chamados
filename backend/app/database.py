import mysql.connector
from mysql.connector import Error
from app.config import settings

def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
            charset='utf8mb4'
        )
        return conn
    except Error as e:
        print(f"Erro ao conectar ao MySQL: {e}")
        raise
