from flask import Flask, jsonify, send_file
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

DOWNLOADS_DIR = os.path.join(os.path.dirname(__file__), 'downloads')

# Supabase (optional): set SUPABASE_URL and SUPABASE_KEY in .env to use DB
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_KEY')
supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        supabase_client = None


def _row_to_song(row):
    """Map Supabase songs row to API shape (id, name, filename + URLs for frontend)."""
    return {
        'id': str(row['id']),
        'name': row.get('title') or '',
        'filename': row.get('url_original'),  # frontend can use url_original for play when from Supabase
        'artists': row.get('artists'),
        'year': row.get('year'),
        'metadata': row.get('metadata'),
        'url_original': row.get('url_original'),
        'url_drum': row.get('url_drum'),
        'url_bass': row.get('url_bass'),
        'url_piano': row.get('url_piano'),
        'url_guitar': row.get('url_guitar'),
        'url_other': row.get('url_other'),
    }


@app.route('/api/songs', methods=['GET'])
def get_songs():
    try:
        if supabase_client:
            r = supabase_client.table('songs').select('*').order('created_at', desc=True).execute()
            return jsonify([_row_to_song(row) for row in (r.data or [])])

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
    """Serve local file; not used when songs come from Supabase (frontend uses url_original)."""
    try:
        filepath = os.path.join(DOWNLOADS_DIR, filename)
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='audio/mp4')
        return jsonify({'error': 'Song not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(debug=True, port=5001)
