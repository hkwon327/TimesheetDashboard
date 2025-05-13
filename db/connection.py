import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT')
    )
############################################

# class DatabaseConnection:
#     def __init__(self):
#         self.config = {
#             'dbname': 'your_db_name',
#             'user': 'your_username',
#             'password': 'your_password',
#             'host': 'localhost',
#             'port': '5432'
#         }

#     @contextmanager
#     def get_connection(self):
#         conn = None
#         try:
#             # Connect to PostgreSQL
#             conn = psycopg2.connect(**self.config)
#             # Return dictionary cursor for easier data handling
#             yield conn.cursor(cursor_factory=RealDictCursor)
#             # Commit the transaction
#             conn.commit()
#         except psycopg2.Error as e:
#             # Rollback in case of error
#             if conn:
#                 conn.rollback()
#             print(f"Database error: {e}")
#             raise
#         finally:
#             # Close connection in any case
#             if conn:
#                 conn.close()

# # Usage example:
# def execute_query(query, params=None):
#     db = DatabaseConnection()
#     with db.get_connection() as cursor:
#         cursor.execute(query, params)
#         return cursor.fetchall()

# # Example queries
# def get_user(user_id):
#     query = "SELECT * FROM users WHERE id = %s"
#     return execute_query(query, (user_id,))

# def create_user(name, email):
#     query = "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING id"
#     return execute_query(query, (name, email))
