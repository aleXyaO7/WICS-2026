import yt_dlp
from pydub import AudioSegment
import os

def download_song_as_wav(song_name):

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'downloads/%(title)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'external_downloader': 'ffmpeg', 
        'postprocessor_args': [
            '-ar', '48000', 
            '-ac', '1'
        ],
    }
    os.makedirs('downloads', exist_ok=True)

    search_query = f"ytsearch1:{song_name} audio"
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Searching for: {song_name} (audio only)")
            info = ydl.extract_info(search_query, download=True)
            
            if 'entries' in info:
                video = info['entries'][0]
                print(f"Downloaded {video['title']}")
                print(f"Saved {video['title']}.m4a")
            else:
                print(f"Downloaded {info['title']}")
                print(f"Saved {info['title']}.m4a")
                
    except Exception as e:
        print(f"Error downloading song: {e}")


def download_and_upload_to_s3(song_name, bucket, object_name=None):
    """
    Pipeline: download the song as WAV (via download_song_as_wav), then upload
    the resulting file to the given S3 bucket.

    Parameters
    ----------
    song_name : str
        Query to search and download (e.g. "Blinding Lights The Weeknd").
    bucket : str
        S3 bucket name to upload to.
    object_name : str, optional
        S3 object key. If None, uses the downloaded filename (e.g. "Title.wav").

    Returns
    -------
    bool
        True if both download and upload succeeded, False otherwise.
    """
    import glob
    import aws

    download_song_as_wav(song_name)

    downloads_dir = "downloads"
    wavs = glob.glob(os.path.join(downloads_dir, "*.wav"))
    if not wavs:
        print("No WAV file found in downloads/ after download.")
        return False

    latest_wav = max(wavs, key=os.path.getmtime)
    if object_name is None:
        object_name = os.path.basename(latest_wav)
    elif not object_name.lower().endswith(".wav"):
        object_name = object_name.rstrip("/") + ".wav"

    if not aws.upload_file(latest_wav, bucket, object_name):
        return False
    print(f"Uploaded to https://{bucket}.s3.us-east-2.amazonaws.com/{object_name}")
    return True


def main():
    song_name = input("Song name to download: ")

    if song_name.strip():
        download_song_as_wav(song_name)
    else:
        print("Invalid name")


if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 4 and sys.argv[1].lower() == "s3":
        song_name = sys.argv[2]
        bucket = sys.argv[3]
        object_name = sys.argv[4] if len(sys.argv) > 4 else None
        ok = download_and_upload_to_s3(song_name, bucket, object_name)
        sys.exit(0 if ok else 1)
    elif len(sys.argv) == 2:
        song_name = sys.argv[1]
        if song_name.strip():
            download_song_as_wav(song_name)
        else:
            print("Invalid name")
            sys.exit(1)
    else:
        print("Usage:")
        print("  Download only:     python download_song.py \"Song name\"")
        print("  Download + S3:     python download_song.py s3 \"Song name\" <bucket> [s3_key.wav]")
        print("  Interactive:       python download_song.py  (no args)")
        main()