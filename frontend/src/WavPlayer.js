import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './WavPlayer.css';

function WavPlayer() {
  const API_URL = 'http://localhost:5001/api';
  
  const [wavFiles] = useState([
    { 
      id: 1, 
      name: 'Kanye West - All of the Lights', 
      url: `${API_URL}/songs/Kanye West - All of the Lights.wav` 
    },
    { 
      id: 2, 
      name: 'Mark Ronson - Uptown Funk ft. Bruno Mars', 
      url: `${API_URL}/songs/Mark Ronson - Uptown Funk (Official Audio) ft. Bruno Mars.wav` 
    },
    { 
      id: 3, 
      name: 'Owl City - Fireflies', 
      url: `${API_URL}/songs/Owl City - Fireflies (HQ).wav` 
    },
    { 
      id: 4, 
      name: 'Payphone', 
      url: `${API_URL}/songs/Payphone.wav` 
    },
    { 
      id: 5, 
      name: 'The Weeknd - Blinding Lights', 
      url: `${API_URL}/songs/The Weeknd - Blinding Lights (Official Audio).wav` 
    },
  ]);

  const audioRefs = useRef([]);
  const [playingStates, setPlayingStates] = useState({});
  const [playingAll, setPlayingAll] = useState(false);
  const snippetTimers = useRef({});
  const clipStartTime = useRef(null);

  useEffect(() => {
    audioRefs.current = audioRefs.current.slice(0, wavFiles.length);
    
    let loadedCount = 0;
    const durations = [];
    
    wavFiles.forEach((_, index) => {
      const audio = audioRefs.current[index];
      if (audio) {
        audio.addEventListener('loadedmetadata', () => {
          durations[index] = audio.duration;
          loadedCount++;
          
          if (loadedCount === wavFiles.length && clipStartTime.current === null) {
            const snippetLength = 30;
            const maxStartTimes = durations.map(d => Math.max(0, d - snippetLength));
            const minMaxStartTime = Math.min(...maxStartTimes);
            clipStartTime.current = Math.random() * minMaxStartTime;
          }
        }, { once: true });
        audio.load();
      }
    });
  }, [wavFiles]);

  const playClip = (index) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    const snippetLength = 30;
    const startTime = clipStartTime.current || 0;
    
    audio.currentTime = startTime;
    audio.play();
    setPlayingStates((prev) => ({ ...prev, [index]: true }));

    if (snippetTimers.current[index]) {
      clearTimeout(snippetTimers.current[index]);
    }
    snippetTimers.current[index] = setTimeout(() => {
      audio.pause();
      setPlayingStates((prev) => ({ ...prev, [index]: false }));
      delete snippetTimers.current[index];
    }, snippetLength * 1000);
  };

  const pauseClip = (index) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    audio.pause();
    setPlayingStates((prev) => ({ ...prev, [index]: false }));
    
    if (snippetTimers.current[index]) {
      clearTimeout(snippetTimers.current[index]);
      delete snippetTimers.current[index];
    }
  };

  const restartClip = (index) => {
    const audio = audioRefs.current[index];
    if (!audio) return;

    if (snippetTimers.current[index]) {
      clearTimeout(snippetTimers.current[index]);
      delete snippetTimers.current[index];
    }

    audio.pause();
    audio.currentTime = clipStartTime.current || 0;
    setPlayingStates((prev) => ({ ...prev, [index]: false }));
  };

  const playAllTracks = () => {
    audioRefs.current.forEach((audio, index) => {
      if (audio) {
        playClip(index);
      }
    });
    setPlayingAll(true);
  };

  const stopAllTracks = () => {
    audioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.pause();
        audio.currentTime = clipStartTime.current || 0;
        setPlayingStates((prev) => ({ ...prev, [index]: false }));
        if (snippetTimers.current[index]) {
          clearTimeout(snippetTimers.current[index]);
          delete snippetTimers.current[index];
        }
      }
    });
    setPlayingAll(false);
  };

  const pauseAllTracks = () => {
    audioRefs.current.forEach((audio, index) => {
      if (audio) {
        pauseClip(index);
      }
    });
    setPlayingAll(false);
  };

  const handleTrackEnded = (index) => {
    setPlayingStates((prev) => ({ ...prev, [index]: false }));
  };

  return (
    <div className="wav-player">
      <div className="wav-container">
        <Link to="/" className="back-button">← Back to Home</Link>
        <h1>🎼 Multi-Track WAV Player</h1>

        <div className="master-controls">
          <h2>Master Controls</h2>
          <div className="master-buttons">
            <button className="master-btn play-all" onClick={playAllTracks}>
              ▶ Play All Clips
            </button>
            <button className="master-btn pause-all" onClick={pauseAllTracks}>
              ⏸ Pause All
            </button>
            <button className="master-btn stop-all" onClick={stopAllTracks}>
              🔄 Restart All
            </button>
          </div>
        </div>

        <div className="tracks-section">
          <h2>Individual Tracks ({wavFiles.length})</h2>
          <div className="tracks-list">
            {wavFiles.map((file, index) => (
              <div key={file.id} className="track-item">
                <span className="track-name">{file.name}</span>
                <div className="track-buttons">
                  <button
                    className={`track-btn ${playingStates[index] ? 'playing' : ''}`}
                    onClick={() => playClip(index)}
                    disabled={playingStates[index]}
                  >
                    ▶ Play
                  </button>
                  <button
                    className="track-btn pause-btn"
                    onClick={() => pauseClip(index)}
                    disabled={!playingStates[index]}
                  >
                    ⏸ Pause
                  </button>
                  <button
                    className="track-btn restart-btn"
                    onClick={() => restartClip(index)}
                  >
                    🔄 Restart
                  </button>
                </div>
                <audio
                  ref={(el) => (audioRefs.current[index] = el)}
                  src={file.url}
                  onEnded={() => handleTrackEnded(index)}
                  onPlay={() => setPlayingStates((prev) => ({ ...prev, [index]: true }))}
                  onPause={() => setPlayingStates((prev) => ({ ...prev, [index]: false }))}
                />
              </div>
            ))}
          </div>
        </div>

        {playingAll && (
          <div className="status-banner">
            🎵 All clips playing simultaneously (30s random snippets)
          </div>
        )}
      </div>
    </div>
  );
}

export default WavPlayer;
