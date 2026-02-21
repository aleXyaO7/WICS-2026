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
            '-ar', '16000', 
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

def main():
    song_name = input("Song name to download: ")
    
    if song_name.strip():
        download_song_as_wav(song_name)
    else:
        print("Invalid name")

if __name__ == "__main__":
    main()