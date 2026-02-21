import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './WavPlayer.css';
import './App.css';

const SNIPPET_LENGTH = 15;

const STEM_LABELS = {
  url_drum: 'Drums',
  url_bass: 'Bass',
  url_piano: 'Piano',
  url_guitar: 'Guitar',
  url_vocals: 'Vocals',
  url_other: 'Other',
};

const STEM_SUFFIXES = {
  url_drum: 'drums',
  url_bass: 'bass',
  url_piano: 'piano',
  url_guitar: 'guitar',
  url_vocals: 'vocals',
  url_other: 'other',
};

function getStemUrlsFromOriginal(urlOriginal) {
  if (!urlOriginal || typeof urlOriginal !== 'string') return {};
  const lastDot = urlOriginal.lastIndexOf('.');
  const base = lastDot > 0 ? urlOriginal.slice(0, lastDot) : urlOriginal;
  const out = {};
  for (const [key, suffix] of Object.entries(STEM_SUFFIXES)) {
    out[key] = `${base}-${suffix}.wav`;
  }
  return out;
}

function getStemUrl(song, stemKey) {
  if (song[stemKey]) return song[stemKey];
  const derived = getStemUrlsFromOriginal(song.url_original);
  return derived[stemKey] || null;
}

function WavPlayer() {
  const API_URL = 'http://localhost:5001/api';
  
  // Music player state
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [randomSong, setRandomSong] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [playingStem, setPlayingStem] = useState(null);
  const musicAudioRef = useRef(null);
  const stemAudioRef = useRef(null);

  // Stems player state (for synchronized multi-stem playback)
  const [stemTracks, setStemTracks] = useState([]);
  const stemAudioRefs = useRef([]);
  const [stemPlayingStates, setStemPlayingStates] = useState({});
  const [playingAllStems, setPlayingAllStems] = useState(false);
  const stemSnippetTimers = useRef({});
  const stemClipStartTime = useRef(null);

  useEffect(() => {
    // Fetch songs for music player
    fetchSongs();
    // Fetch a random song for stems on mount
    fetchRandomSong(false);
  }, []);

  // Load stem tracks when random song changes
  useEffect(() => {
    if (!randomSong) return;
    
    // Build stem tracks from random song
    const tracks = Object.entries(STEM_LABELS)
      .map(([key, label]) => ({
        key,
        label,
        url: getStemUrl(randomSong, key)
      }))
      .filter(track => track.url);
    
    setStemTracks(tracks);
    stemClipStartTime.current = null; // Reset clip start time
  }, [randomSong]);

  // Initialize audio refs and calculate synchronized start time for stems
  useEffect(() => {
    if (stemTracks.length === 0) return;
    
    stemAudioRefs.current = stemAudioRefs.current.slice(0, stemTracks.length);
    
    let loadedCount = 0;
    const durations = [];
    
    stemTracks.forEach((_, index) => {
      const audio = stemAudioRefs.current[index];
      if (audio) {
        audio.addEventListener('loadedmetadata', () => {
          durations[index] = audio.duration;
          loadedCount++;
          
          if (loadedCount === stemTracks.length && stemClipStartTime.current === null) {
            const maxStartTimes = durations.map(d => Math.max(0, d - SNIPPET_LENGTH));
            const minMaxStartTime = Math.min(...maxStartTimes);
            stemClipStartTime.current = Math.random() * minMaxStartTime;
            console.log('Stem clip start time:', stemClipStartTime.current);
          }
        }, { once: true });
        audio.load();
      }
    });
  }, [stemTracks]);

  const fetchSongs = async () => {
    try {
      const response = await axios.get(`${API_URL}/songs`);
      setSongs(response.data);
    } catch (error) {
      console.error('Error fetching songs:', error);
    }
  };

  const fetchRandomSong = async (showLoading = true) => {
    if (showLoading) {
      setRandomLoading(true);
      setRandomSong(null);
      setPlayingStem(null);
    }
    try {
      const response = await axios.get(`${API_URL}/songs/random`);
      setRandomSong(response.data);
      if (!showLoading) {
        console.log('Loaded random song for stems:', response.data.name);
      }
    } catch (error) {
      console.error('Error fetching random song:', error);
    } finally {
      if (showLoading) {
        setRandomLoading(false);
      }
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

  const getSongAudioUrl = (song) => {
    if (song.url_original) return song.url_original;
    return `${API_URL}/songs/${song.filename}`;
  };

  const playSong = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    if (musicAudioRef.current) {
      musicAudioRef.current.src = getSongAudioUrl(song);
      musicAudioRef.current.play();
    }
  };

  const togglePlayPause = () => {
    if (musicAudioRef.current) {
      if (isPlaying) {
        musicAudioRef.current.pause();
      } else {
        musicAudioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playStemClip = (index) => {
    const audio = stemAudioRefs.current[index];
    if (!audio) return;

    const startTime = stemClipStartTime.current || 0;
    
    audio.currentTime = startTime;
    audio.play();
    setStemPlayingStates((prev) => ({ ...prev, [index]: true }));

    if (stemSnippetTimers.current[index]) {
      clearTimeout(stemSnippetTimers.current[index]);
    }
    stemSnippetTimers.current[index] = setTimeout(() => {
      audio.pause();
      setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
      delete stemSnippetTimers.current[index];
    }, SNIPPET_LENGTH * 1000);
  };

  const pauseStemClip = (index) => {
    const audio = stemAudioRefs.current[index];
    if (!audio) return;

    audio.pause();
    setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
    
    if (stemSnippetTimers.current[index]) {
      clearTimeout(stemSnippetTimers.current[index]);
      delete stemSnippetTimers.current[index];
    }
  };

  const restartStemClip = (index) => {
    const audio = stemAudioRefs.current[index];
    if (!audio) return;

    if (stemSnippetTimers.current[index]) {
      clearTimeout(stemSnippetTimers.current[index]);
      delete stemSnippetTimers.current[index];
    }

    audio.pause();
    audio.currentTime = stemClipStartTime.current || 0;
    setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
  };

  const playAllStems = () => {
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        playStemClip(index);
      }
    });
    setPlayingAllStems(true);
  };

  const stopAllStems = () => {
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.pause();
        audio.currentTime = stemClipStartTime.current || 0;
        setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
        if (stemSnippetTimers.current[index]) {
          clearTimeout(stemSnippetTimers.current[index]);
          delete stemSnippetTimers.current[index];
        }
      }
    });
    setPlayingAllStems(false);
  };

  const pauseAllStems = () => {
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        pauseStemClip(index);
      }
    });
    setPlayingAllStems(false);
  };

  const handleStemTrackEnded = (index) => {
    setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
  };

  const singleStemEntries = randomSong
    ? Object.entries(STEM_LABELS)
        .map(([key, label]) => [key, label, getStemUrl(randomSong, key)])
        .filter(([, , url]) => url)
    : [];

  return (
    <div className="wav-player">
      <div className="wav-container">
        <Link to="/" className="back-button">Back to Home</Link>
        <h1>Multi-Track WAV Player</h1>

        <div className="random-section">
          <h2>Random song + stems</h2>
          <button
            type="button"
            className="random-btn"
            onClick={fetchRandomSong}
            disabled={randomLoading}
          >
            {randomLoading ? 'Loading…' : 'Get random song'}
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
                  {singleStemEntries.map(([key, label, url]) => (
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
              {singleStemEntries.length === 0 && (
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
              ref={musicAudioRef}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          </div>
        )}

        <div className="master-controls">
          <h2>Master Controls</h2>
          <div className="master-buttons">
            <button className="master-btn play-all" onClick={playAllStems}>
              Play All Stems
            </button>
            <button className="master-btn pause-all" onClick={pauseAllStems}>
              Pause All
            </button>
            <button className="master-btn stop-all" onClick={stopAllStems}>
              Restart All
            </button>
          </div>
        </div>

        <div className="tracks-section">
          <h2>Instrumental Stems ({stemTracks.length})</h2>
          {stemTracks.length === 0 ? (
            <p className="empty">Loading instrumental stems...</p>
          ) : (
            <div className="tracks-list">
              {stemTracks.map((track, index) => (
                <div key={track.key} className="track-item">
                  <span className="track-name">{track.label}</span>
                  <div className="track-buttons">
                    <button
                      className={`track-btn ${stemPlayingStates[index] ? 'playing' : ''}`}
                      onClick={() => playStemClip(index)}
                      disabled={stemPlayingStates[index]}
                    >
                      Play
                    </button>
                    <button
                      className="track-btn pause-btn"
                      onClick={() => pauseStemClip(index)}
                      disabled={!stemPlayingStates[index]}
                    >
                      Pause
                    </button>
                    <button
                      className="track-btn restart-btn"
                      onClick={() => restartStemClip(index)}
                    >
                      Restart
                    </button>
                  </div>
                  <audio
                    ref={(el) => (stemAudioRefs.current[index] = el)}
                    src={track.url}
                    onEnded={() => handleStemTrackEnded(index)}
                    onPlay={() => setStemPlayingStates((prev) => ({ ...prev, [index]: true }))}
                    onPause={() => setStemPlayingStates((prev) => ({ ...prev, [index]: false }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {playingAllStems && (
          <div className="status-banner">
            🎵 All stems playing simultaneously ({SNIPPET_LENGTH}s snippets)
          </div>
        )}
      </div>
    </div>
  );
}

export default WavPlayer;
