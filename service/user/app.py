import os
import time
import logging
import traceback
from werkzeug.utils import secure_filename
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin

import models
from engine import SBMWatsApp, background_worker

app = Flask(__name__)
CORS(app)

# Configure logging to a file
logging.basicConfig(filename='wacast.log',
                    level=logging.INFO,
                    format='%(asctime)s %(levelname)s: %(message)s')

# Set up the file upload folder and allowed extensions
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'xls', 'xlsx'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Utility function to check file extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


executor = None


def start_worker():
    executor = ThreadPoolExecutor(max_workers=1)
    # Start the background worker thread
    executor.submit(background_worker)
    app.logger.info("Background worker is running")


# Endpoint to retrieve details of all phone numbers
@app.route('/get-phone-status', methods=['GET'])
@cross_origin(origin='*')
def get_phone_status():
    try:
        with models.get_msg_db() as conn:
            cursor = conn.cursor()

            # Query to get all phone numbers and their details
            cursor.execute('SELECT * FROM phone_status')
            rows = cursor.fetchall()
    
            phone_status_list = []
            for row in rows:
                phone_status_list.append({
                    'phone_number': row['phone_number'],
                    'status': row['status'],
                    'last_sent_message': row['last_sent_message'],
                    'next_schedule': row['next_schedule']
                })
    
            return jsonify({
                'status': 'success',
                'phone_status': phone_status_list,

            })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'status': 'failed', 'message': str(e)}), 500


@app.route('/send-with-file', methods=['POST'])
@cross_origin(origin='*')
def send_message():
    try:
        if 'file' not in request.files:
            return jsonify({'status': 'failed', 'message': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'failed', 'message': 'No selected file'}), 400
        
        frequency = request.form['frequency']
        schedule_at = request.form['schedule_at']
        message =  request.form['message']


        if file and allowed_file(file.filename):
            # Secure the filename and create a timestamp-based unique name
            filename = secure_filename(file.filename)
            # Get current timestamp to ensure unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            # Split filename and extension
            name, ext = os.path.splitext(filename)
            # Postfix filename with timestamp to avoid overwriting
            unique_filename = f"{name}_{timestamp}{ext}"
            # Define the file path with the new unique filename
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            # Save the file
            file.save(file_path)

            with models.get_msg_db() as conn:
                #message = request.form['message']
                models.add_job(
                    conn=conn,
                    job_name="engine.SBMWatsApp.send_message_non_bulk",
                    updated_at=schedule_at or None,
                    frequency=frequency or None,
                    params={"file_path": file_path, "message": message},
                )
                return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'failed', 'message': 'Invalid file type'}), 400
    except Exception as e:
        return jsonify({'status': 'failed', 'message': str(e)}), 500


@app.route("/send-without-file", methods=["POST"])
@cross_origin(origin='*')
def send():
    app.logger.info("Receiving request")
    try:
        frequency = request.form['frequency']
        schedule_at = request.form['schedule_at'][:26]
        message =  request.form['message']
        google_sheet_url = request.form['file']

        if not message or not google_sheet_url:
            return jsonify({"status": "failed", "message": "Message or Google Sheet URL is missing"}), 400

        if schedule_at:
            try:
                schedule_at = datetime.strptime(schedule_at, "%Y-%m-%d %H:%M:%S.%f")
            except ValueError as e:
                return jsonify({"status": "failed", "message": "Invalid schedule_at format"}), 400

        with models.get_msg_db() as conn:
            models.add_job(
                conn=conn,
                job_name="engine.SBMWatsApp.send_message",
                updated_at=schedule_at or None,
                frequency=frequency or None,
                params={"google_sheet_url": google_sheet_url, "message": message}
            )
    
            return jsonify({"status": "success"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "failed", "message": "Internal server error"}), 500   


@app.route("/login", methods=["POST"])
@cross_origin(origin="*")
def login():
    try:
        whatsapp_interface = SBMWatsApp()
        start_time = time.time()
        whatsapp_interface.cleanup_destination()
        print("Cleanup took ", time.time() - start_time)
        whatsapp_interface.watsapp_login()
    except:
        traceback.print_exc()
        return jsonify({"status": "failed", "message": "Internal server error"}), 500
    return jsonify({"status": "success"})

@app.route("/login", methods=["GET"])
@cross_origin(origin="*")
def login_get():
    try:
        whatsapp_interface = SBMWatsApp()
        whatsapp_interface.watsapp_login(headless=True)
    except:
        traceback.print_exc()
        return jsonify({"status": "failed", "message": "Internal server error"}), 500
    return jsonify({"status": "success"})

def update_settings():
    gjson = request.form['gjson']
    inqpath = request.form['inqpath']
    sheet_name = request.form['sheet_name']
    browser_timeout = request.form['browser_timeout'] or 0
    try:
        with models.get_msg_db() as conn:
            models.update_settings(
                conn,
                gjson,
                inqpath,
                sheet_name,
                int(browser_timeout)
            )
        return jsonify({"status": "success"})
    except Exception as _e:
        traceback.print_exc()
        return jsonify({"status": "Internal server error"}), 500

def get_settings():
    try:
        with models.get_msg_db() as conn:
            settings = models.get_settings(
                conn=conn
            )
            if not settings:
                return jsonify({"gjson": "", "inqpath": ""})
            return jsonify({
                "gjson": settings[1],
                "inqpath": settings[2],
                "sheet_name": settings[3],
                "browser_timeout": settings[4]
            })
    except Exception as _e:
        traceback.print_exc()
        return jsonify({"status": "Internal server error"}), 500
    

@app.route("/settings", methods=["POST", "GET"])
@cross_origin(origin="*")
def settings():
    if request.method == "GET":
        return get_settings()
    else:
        return update_settings()


# Ensure initialization happens regardless of how the app is run
def initialize_app():
    if not os.path.exists(UPLOAD_FOLDER):
        app.logger.info("Creating directory")
        os.makedirs(UPLOAD_FOLDER)

    if not getattr(app, "initialized", False):  # Avoid reinitialization
        app.logger.info("Initializing DB")
        models.init_db()
        app.logger.info("Starting worker")
        start_worker()
        app.initialized = True  # Flag to prevent duplicate init

# Call the initialization at the import level
initialize_app()

if __name__ == '__main__':
    # Ensure the upload folder exists
    #if not os.path.exists(UPLOAD_FOLDER):
    #    app.logger.info("Creating directory")
    #    os.makedirs(UPLOAD_FOLDER)
    #if not executor:
    #    app.logger.info("Initializing DB")
    #    models.init_db()
    #    app.logger.info("Starting worker")
    #    start_worker()
    app.run(debug=False)
