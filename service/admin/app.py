from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin

CHAT_BOX = '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div[1]/div/div[1]'

app = Flask(__name__)
CORS(app)

@app.route('/get-chat-box', methods=['GET'])
@cross_origin(origin='*')
def get_chat_box():
    return jsonify({'chat_box': CHAT_BOX})

@app.route('/set-chat-box', methods=['POST'])
def set_chat_box():
    global CHAT_BOX
    CHAT_BOX = request.get_json()['chat_box']
    return jsonify({'chat_box': CHAT_BOX})

if __name__ == "__main__":
    app.run(port=5001)
