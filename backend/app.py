from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
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
        'url_vocals': row.get('url_vocals'),
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


def _s3_bucket_from_url(url):
    """Extract bucket name from S3 url_original (e.g. https://my-bucket.s3.region.amazonaws.com/...)."""
    if not url:
        return None
    try:
        from urllib.parse import urlparse
        netloc = urlparse(url).netloc
        if ".s3." in netloc:
            return netloc.split(".s3.")[0]
        if "s3.amazonaws.com" in netloc:
            return netloc.replace(".s3.amazonaws.com", "")
    except Exception:
        pass
    return None


STEM_INSTRUMENTS = ["drums", "bass", "piano", "guitar", "vocals", "other"]
STEM_URL_KEYS = {"drums": "url_drum", "bass": "url_bass", "piano": "url_piano", "guitar": "url_guitar", "vocals": "url_vocals", "other": "url_other"}


def _public_stem_urls(url_original):
    """Build public stem URLs by appending -drums.wav, -bass.wav, etc. to the base URL (no signing)."""
    if not url_original or not url_original.strip():
        return {}
    base = url_original.rsplit(".", 1)[0] if "." in url_original else url_original
    out = {}
    for inst in STEM_INSTRUMENTS:
        out[STEM_URL_KEYS[inst]] = f"{base}-{inst}.wav"
    return out


def _stem_urls_for_song(url_original, bucket=None):
    """Build stem URLs from url_original. Uses public URLs (no signatures)."""
    if not url_original:
        return {}
    urls = _public_stem_urls(url_original)
    print(f"[S3] public stem URLs: url_original={url_original!r} -> {list(urls.keys())}")
    return urls


@app.route('/api/songs/random', methods=['GET'])
def get_random_song():
    """Return a random song from the DB with stem URLs built from S3 (base + instrument)."""
    if not supabase_client:
        return jsonify({'error': 'Supabase not configured'}), 503
    bucket = os.environ.get('S3_BUCKET') or os.environ.get('AWS_S3_BUCKET')
    try:
        r = supabase_client.table('songs').select('*').execute()
        rows = r.data or []
        if not rows:
            return jsonify({'error': 'No songs in database'}), 404
        import random
        row = random.choice(rows)
        song = _row_to_song(row)
        url_original = row.get('url_original')
        if url_original:
            bucket = bucket or _s3_bucket_from_url(url_original)
        if bucket and url_original:
            stems = _stem_urls_for_song(url_original, bucket)
            for k, v in stems.items():
                song[k] = v
        return jsonify(song)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stem-urls', methods=['GET'])
def get_stem_urls():
    """
    Derive public stem URLs from url_original (no Supabase or signing).
    Query: url_original=<full S3 or any public URL>
    Returns: url_original + url_drum, url_bass, url_piano, url_guitar, url_vocals, url_other.
    """
    url_original = (request.args.get('url_original') or '').strip()
    if not url_original:
        return jsonify({'error': 'Missing url_original query parameter'}), 400
    stems = _stem_urls_for_song(url_original)
    out = {'url_original': url_original, **stems}
    return jsonify(out)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


# ===== USER ENDPOINTS =====

@app.route('/api/users/signup', methods=['POST'])
def signup():
    """Create a new user account."""
    try:
        if not supabase_client:
            return jsonify({'error': 'Database not configured'}), 500
        
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Check if username already exists
        existing_user = supabase_client.table('users').select('id').eq('username', username).execute()
        if existing_user.data:
            return jsonify({'error': 'Username already taken'}), 409
        
        # Check if email already exists
        existing_email = supabase_client.table('users').select('id').eq('email', email).execute()
        if existing_email.data:
            return jsonify({'error': 'Email already registered'}), 409
        
        # Hash password
        password_hash = generate_password_hash(password)
        
        # Create user in database
        result = supabase_client.table('users').insert({
            'username': username,
            'email': email,
            'password_hash': password_hash,
            'elo_rating': 1200  # Default ELO rating
        }).execute()
        
        if result.data:
            user = result.data[0]
            return jsonify({
                'message': 'Account created successfully',
                'user': {
                    'id': user['id'],
                    'username': user['username'],
                    'email': user['email'],
                    'elo_rating': user['elo_rating']
                }
            }), 201
        else:
            return jsonify({'error': 'Failed to create account'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/login', methods=['POST'])
def login():
    """Authenticate a user."""
    try:
        if not supabase_client:
            return jsonify({'error': 'Database not configured'}), 500
        
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Get user from database
        result = supabase_client.table('users').select('*').eq('username', username).execute()
        
        if not result.data:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        user = result.data[0]
        
        # Check password
        if not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Return user data (without password hash)
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'elo_rating': user['elo_rating'],
                'created_at': user['created_at']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<username>', methods=['GET'])
def get_user(username):
    """Get user information by username."""
    try:
        if not supabase_client:
            return jsonify({'error': 'Database not configured'}), 500
        
        result = supabase_client.table('users').select('id, username, email, elo_rating, created_at').eq('username', username).execute()
        
        if not result.data:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': result.data[0]}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/users/<user_id>/elo', methods=['PATCH'])
def update_elo(user_id):
    """Update user's ELO rating."""
    try:
        if not supabase_client:
            return jsonify({'error': 'Database not configured'}), 500
        
        data = request.get_json()
        new_elo = data.get('elo_rating')
        
        if new_elo is None:
            return jsonify({'error': 'elo_rating is required'}), 400
        
        result = supabase_client.table('users').update({
            'elo_rating': new_elo
        }).eq('id', user_id).execute()
        
        if result.data:
            return jsonify({
                'message': 'ELO rating updated',
                'user': result.data[0]
            }), 200
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)
