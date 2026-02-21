import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const STEM_LABELS = {
  url_drum: 'Drums',
  url_bass: 'Bass',
  url_piano: 'Piano',
  url_guitar: 'Guitar',
  url_vocals: 'Vocals',
  url_other: 'Other',
};

// Stem suffix convention (must match backend/upload_stems_to_s3 and backend app.py)
const STEM_SUFFIXES = {
  url_drum: 'drums',
  url_bass: 'bass',
  url_piano: 'piano',
  url_guitar: 'guitar',
  url_vocals: 'vocals',
  url_other: 'other',
};

/**
 * Derive public stem URLs from a single S3 (or any) original URL.
 * Assumes stems are at same path with -{instrument}.wav (e.g. path/song-drums.wav).
 * Use this when you only have url_original and don't store stem URLs in Supabase.
 */
function getStemUrlsFromOriginal(urlOriginal) {
  if (!urlOriginal || typeof urlOriginal !== 'string') return {};
  const lastDot = urlOriginal.lastIndexOf('.');
  const base = lastDot > 0 ? urlOriginal.slice(0, lastDot) : urlOriginal;
  const out = {};
  for (const [key, suffix] of Object.entries(STEM_SUFFIXES)) {
    out[key] = `${base}-${suffix}.wav`;
  }
  console.log(out);
  return out;
}

/** Get stem URL for a song: use stored value, else derived from url_original (public S3 convention). */
function getStemUrl(song, stemKey) {
  if (song[stemKey]) return song[stemKey];
  const derived = getStemUrlsFromOriginal(song.url_original);
  return derived[stemKey] || null;
}

function App() {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [randomSong, setRandomSong] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [playingStem, setPlayingStem] = useState(null);
  const audioRef = useRef(null);
  const stemAudioRef = useRef(null);

  const API_URL = 'http://localhost:5001/api';

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      const response = await axios.get(`${API_URL}/songs`);
      setSongs(response.data);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const fetchRandomSong = async () => {
    setRandomLoading(true);
    setRandomSong(null);
    setPlayingStem(null);
    try {
      const response = await axios.get(`${API_URL}/songs/random`);
      setRandomSong(response.data);
    } catch (error) {
      console.error('Error fetching random song:', error);
    } finally {
      setRandomLoading(false);
    }
  };

  const playStem = (stemKey, url) => {
    if (!stemAudioRef.current || !url) return;
    const isSame = playingStem === stemKey;
    if (isSame) {
      stemAudioRef.current.pause();
      setPlayingStem(null);
      return;
    }
    stemAudioRef.current.src = url;
    stemAudioRef.current.play();
    setPlayingStem(stemKey);
  };

  // Resolve play/download URL: use Supabase url_original when present, else local API
  const getSongAudioUrl = (song) => {
    if (song.url_original) return song.url_original;
    return `${API_URL}/songs/${song.filename}`;
  };

  // Play a specific song by filename
  const playSpecificSong = (filename) => {
    const song = songs.find(s => s.filename === filename || s.id === filename);
    if (song) playSong(song);
  };

  // Download song to user's computer
  const downloadSong = (song) => {
    const link = document.createElement('a');
    link.href = getSongAudioUrl(song);
    link.download = song.name || song.filename || 'audio';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const playSong = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = getSongAudioUrl(song);
      audioRef.current.play();
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const stemEntries = randomSong
    ? Object.entries(STEM_LABELS)
        .map(([key, label]) => [key, label, getStemUrl(randomSong, key)])
        .filter(([, , url]) => url)
    : [];

  return (
    <div className="App">
      <div className="container">
        <h1>🎵 Music Player</h1>

        <div className="random-section">
          <h2>Random song + stems</h2>
          <button
            type="button"
            className="random-btn"
            onClick={fetchRandomSong}
            disabled={randomLoading}
          >
            {randomLoading ? 'Loading…' : '🎲 Get random song'}
          </button>
          {randomSong && (
            <div className="random-song-card">
              <div className="random-song-info">
                <div className="random-song-title">{randomSong.name}</div>
                {randomSong.artists && (
                  <div className="random-song-artists">{randomSong.artists}</div>
                )}
              </div>
              <div className="stems-row">
                <span className="stems-label">Stems:</span>
                <div className="stems-list">
                  {stemEntries.map(([key, label, url]) => (
                    <button
                      key={key}
                      type="button"
                      className={`stem-btn ${playingStem === key ? 'active' : ''}`}
                      onClick={() => playStem(key, url)}
                    >
                      {playingStem === key ? '⏸' : '▶'} {label}
                    </button>
                  ))}
                </div>
              </div>
              {stemEntries.length === 0 && (
                <p className="stems-empty">No stem URLs for this song.</p>
              )}
            </div>
          )}
          <audio
            ref={stemAudioRef}
            onEnded={() => setPlayingStem(null)}
            onPause={() => setPlayingStem(null)}
          />
        </div>

        <div className="songs-section">
          <h2>My Songs ({songs.length})</h2>
          {songs.length === 0 ? (
            <p className="empty">No songs yet. Download songs using the backend script!</p>
          ) : (
            <div className="song-list">
              {songs.map((song) => (
                <div
                  key={song.id}
                  className={`song-item ${currentSong?.id === song.id ? 'active' : ''}`}
                  onClick={() => playSong(song)}
                >
                  <span className="song-name">{song.name}</span>
                  <span className="play-icon">
                    {currentSong?.id === song.id && isPlaying ? '⏸' : '▶'}
                  </span>
                  <button 
                    className="download-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadSong(song);
                    }}
                  >
                    ⬇
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {currentSong && (
          <div className="player">
            <div className="player-info">
              <div className="now-playing">Now Playing:</div>
              <div className="song-title">{currentSong.name}</div>
            </div>
            <div className="player-controls">
              <button onClick={togglePlayPause} className="play-button">
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            </div>
            <audio
              ref={audioRef}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
