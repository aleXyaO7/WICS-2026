import json
import sys
import requests

BASE_URL = "https://api.reccobeats.com/v1"

# the audio features that we acc want to store

AUDIO_FEATURE_KEYS = [
    "acousticness", "danceability", "energy", "instrumentalness",
    "key", "liveness", "loudness", "mode", "speechiness", "tempo", "valence",
]

def _audio_features_only(item):
    """Return dict with only keys from acousticness onward."""
    return {k: item[k] for k in AUDIO_FEATURE_KEYS if k in item}

def get_audio_features(ids):
    response = requests.get(
        f"{BASE_URL}/audio-features",
        params={"ids": ",".join(ids)},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def get_metadata_for_track(spotify_id: str):
    """
    Get audio-features metadata for a single track by Spotify ID.
    Returns a dict with AUDIO_FEATURE_KEYS only, or None if not found.
    """
    data = get_audio_features([spotify_id])
    for item in data.get("content", []):
        return _audio_features_only(item)
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python recco_beats.py <ids_file.txt>", file=sys.stderr)
        print("  ids_file.txt: one track ID per line (blank lines ignored)", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    with open(path) as f:
        ids = [line.strip() for line in f if line.strip()]
    if not ids:
        print("No IDs found in file.", file=sys.stderr)
        sys.exit(1)
    for track_id in ids:
        try:
            data = get_audio_features([track_id])
            for item in data.get("content", []):
                print(json.dumps(_audio_features_only(item)))
        except requests.RequestException as e:
            print(json.dumps({"id": track_id, "error": str(e)}), file=sys.stderr)

if __name__ == "__main__":
    main()