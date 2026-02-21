from flask import Flask, jsonify, send_file
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), 'downloads')

@app.route('/api/songs', methods=['GET'])
def get_songs():
    try:
        if not os.path.exists(DOWNLOADS_DIR):
            return jsonify([])
        
        songs = []
        for filename in os.listdir(DOWNLOADS_DIR):
            if filename.endswith(('.m4a', '.mp3', '.opus', '.webm')):
                songs.append({
                    'id': filename,
                    'name': os.path.splitext(filename)[0],
                    'filename': filename
                })
        
        return jsonify(songs)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/songs/<path:filename>', methods=['GET'])
def get_song(filename):
    try:
        filepath = os.path.join(DOWNLOADS_DIR, filename)
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='audio/mp4')
        else:
            return jsonify({'error': 'Song not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
