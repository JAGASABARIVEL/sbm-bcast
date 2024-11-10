import os, json
import sqlite3
from datetime import datetime
from contextlib import contextmanager

MSG_DB = os.path.join("Database", "messages.db")

def init_db():
    with get_msg_db() as conn:
        create_settings_table(conn)
        create_job_queue_table(conn)
        create_message_table(conn)

# Function to connect to the SQLite database
@contextmanager
def get_msg_db():
    conn = sqlite3.connect(MSG_DB)
    conn.row_factory = sqlite3.Row  # To fetch rows as dictionaries
    try:
        yield conn
    finally:
        conn.commit()
        conn.close()

def create_job_queue_table(conn):
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT NOT NULL,
            job_name TEXT NOT NULL,  -- Name of the function to execute
            params TEXT,
            created_at TIMESTAMP NOT NULL,
            frequency INTEGER,  -- Frequency in days
            updated_at TIMESTAMP NOT NULL
        )
    ''')

def create_message_table(conn):
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS phone_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_number TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            last_sent_message TEXT,
            next_schedule TIMESTAMP,
            UNIQUE(phone_number)
        )
    ''')

def create_settings_table(conn):
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gjson TEXT,
            chat_box_inqpath TEXT NOT NULL,
            sheet_name TEXT,
            browser_timeout INTEGER
        )
    ''')

def get_settings(conn):
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM settings WHERE id = 1')
    row = cursor.fetchone()
    return row

def update_settings(conn, gjson, chat_box_inqpath, sheet_name, browser_timeout):
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM settings WHERE id = 1')
    row = cursor.fetchone()
    if row:
        cursor.execute('''
            UPDATE settings
            SET gjson = ?, chat_box_inqpath = ?, sheet_name = ?, browser_timeout = ?
            WHERE id = ?
        ''', (gjson, chat_box_inqpath, sheet_name, browser_timeout, 1))
    else:
        cursor.execute('''
            INSERT INTO settings (gjson, chat_box_inqpath, sheet_name, browser_timeout)
            VALUES (?, ?, ?, ?)
        ''', (gjson, chat_box_inqpath, sheet_name, browser_timeout))

def update_message_status(conn, phone, message="", status="success", at=datetime.now()):
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM phone_status WHERE phone_number = ?', (phone,))
    row = cursor.fetchone()
    if row:
        cursor.execute('''
            UPDATE phone_status
            SET status = ?, last_sent_message = ?, next_schedule = ?
            WHERE phone_number = ?
        ''', (status, message, at, phone))
    else:
        cursor.execute('''
            INSERT INTO phone_status (phone_number, status, last_sent_message, next_schedule)
            VALUES (?, ?, ?, ?)
        ''', (phone, status, message, at))


def add_job(conn, job_name, params="", updated_at=None, frequency=None):
    """
    Adds a job to the queue.
    - `params`: parameters for the job.
    - `frequency`: optional frequency in days to reschedule the job.
    """
    updated_at = created_at = None
    if not updated_at:
        curr_date = datetime.now()
        updated_at = created_at = curr_date
    cursor = conn.cursor()
    cursor.execute('INSERT INTO jobs (job_name, status, params, frequency, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
       (job_name, 'queued', json.dumps(params), frequency, updated_at, created_at))


def get_next_job(conn):
    """
    Retrieves the next job based on its status and schedule criteria.
    - A job is eligible if:
        1. Status is 'queued' AND
        2. The time since `updated_at` surpasses the `frequency` (if set).
    """
    cursor = conn.cursor()

    # Fetch the next job based on frequency, if it's due for execution
    cursor.execute('''
        SELECT * FROM jobs
        WHERE status = 'queued' 
        OR frequency IS NOT NULL
        ORDER BY updated_at ASC
    ''')  # Pass current time minus the dynamic frequency
    job = cursor.fetchall()
    return job

def update_job_status(conn, job_id, status):
    print("Updating job_id, status ", job_id, status)
    cursor = conn.cursor()
    cursor.execute('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?',
               (status, datetime.now(), job_id))
