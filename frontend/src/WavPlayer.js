import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import WaveSurfer from 'wavesurfer.js';
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
  const [currentPosition, setCurrentPosition] = useState(0);
  const positionUpdateInterval = useRef(null);
  const [stemVolumes, setStemVolumes] = useState({});
  
  // Web Audio API for volume amplification
  const audioContextRef = useRef(null);
  const gainNodesRef = useRef([]);
  const sourceNodesRef = useRef([]);
  const initialFetchDone = useRef(false);
  
  // Wavesurfer instances for waveform visualization
  const wavesurferRefs = useRef([]);
  const waveformContainerRefs = useRef([]);

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;
    
    fetchSongs();
    fetchRandomSong(false);
  }, []);

  useEffect(() => {
    if (!randomSong) return;
    
    const tracks = Object.entries(STEM_LABELS)
      .map(([key, label]) => ({
        key,
        label,
        url: getStemUrl(randomSong, key)
      }))
      .filter(track => track.url);
    
    setStemTracks(tracks);
    
    if (randomSong.clip_start_time !== undefined) {
      stemClipStartTime.current = randomSong.clip_start_time;
    } else {
      stemClipStartTime.current = null;
    }
    
    setCurrentPosition(0);
    
    const initialVolumes = {};
    tracks.forEach((_, index) => {
      initialVolumes[index] = 100;
    });
    setStemVolumes(initialVolumes);
  }, [randomSong]);

  useEffect(() => {
    if (stemTracks.length === 0) return;
    
    stemAudioRefs.current = stemAudioRefs.current.slice(0, stemTracks.length);
    
    stemTracks.forEach((_, index) => {
      const audio = stemAudioRefs.current[index];
      if (audio) {
        audio.load();
      }
    });
  }, [stemTracks]);

  useEffect(() => {
    if (stemTracks.length === 0) return;
    
    const timer = setTimeout(() => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      
      stemAudioRefs.current.forEach((audio, index) => {
        if (audio && !sourceNodesRef.current[index]) {
          try {
            const source = audioContext.createMediaElementSource(audio);
            
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;
            
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            sourceNodesRef.current[index] = source;
            gainNodesRef.current[index] = gainNode;
          } catch (error) {
            if (error.name !== 'InvalidStateError') {
              console.error('Error setting up Web Audio API for stem', index, error);
            }
          }
        }
      });
    }, 100);
    
    return () => clearTimeout(timer);
  }, [stemTracks]);

  useEffect(() => {
    if (stemTracks.length === 0) return;
    
    let isMounted = true;
    const timer = setTimeout(() => {
      if (!isMounted) return;
      
      stemTracks.forEach((track, index) => {
        const container = waveformContainerRefs.current[index];
        const audio = stemAudioRefs.current[index];
        
        if (container && !wavesurferRefs.current[index]) {
          try {
            const wavesurfer = WaveSurfer.create({
              container: container,
              waveColor: '#4a9eff',
              progressColor: '#1e3a8a',
              cursorColor: '#1e3a8a',
              barWidth: 2,
              barRadius: 3,
              cursorWidth: 2,
              height: 80,
              barGap: 2,
              responsive: true,
              normalize: true,
              mediaControls: false,
              interact: false,
            });
            
            wavesurfer.load(track.url).catch((error) => {
              if (error.name !== 'AbortError') {
                console.error('Error loading waveform for stem', index, error);
              }
            });
            
            wavesurferRefs.current[index] = wavesurfer;
          } catch (error) {
            console.error('Error creating WaveSurfer instance for stem', index, error);
          }
        }
      });
    }, 300);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (wavesurferRefs.current.length > stemTracks.length) {
        wavesurferRefs.current.forEach((ws) => {
          if (ws) ws.destroy();
        });
        wavesurferRefs.current = [];
      }
    };
  }, [stemTracks]);

  useEffect(() => {
    const updateWaveforms = () => {
      stemAudioRefs.current.forEach((audio, index) => {
        if (audio && wavesurferRefs.current[index]) {
          const wavesurfer = wavesurferRefs.current[index];
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const progress = audio.currentTime / duration;
            wavesurfer.seekTo(progress);
          }
        }
      });
    };

    let animationFrameId;
    if (playingAllStems || Object.values(stemPlayingStates).some(state => state)) {
      const animate = () => {
        updateWaveforms();
        animationFrameId = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playingAllStems, stemPlayingStates]);

  useEffect(() => {
    gainNodesRef.current.forEach((gainNode, index) => {
      if (gainNode && stemVolumes[index] !== undefined) {
        gainNode.gain.value = stemVolumes[index] / 100;
      }
    });
  }, [stemVolumes]);

  useEffect(() => {
    const updatePosition = () => {
      const playingAudio = stemAudioRefs.current.find(audio => audio && !audio.paused);
      if (playingAudio) {
        const relativePosition = playingAudio.currentTime - (stemClipStartTime.current || 0);
        const newPosition = Math.max(0, Math.min(SNIPPET_LENGTH, relativePosition));
        setCurrentPosition(newPosition);
        
        stemAudioRefs.current.forEach((audio) => {
          if (audio && audio !== playingAudio) {
            const expectedTime = (stemClipStartTime.current || 0) + newPosition;
            if (Math.abs(audio.currentTime - expectedTime) > 0.1) {
              audio.currentTime = expectedTime;
            }
          }
        });
      }
    };

    if (playingAllStems || Object.values(stemPlayingStates).some(state => state)) {
      positionUpdateInterval.current = setInterval(updatePosition, 100);
    } else {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
        positionUpdateInterval.current = null;
      }
    }

    return () => {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
      }
    };
  }, [playingAllStems, stemPlayingStates]);

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
      const response = await axios.get(`${API_URL}/songs/random`, {
        params: { snippet_length: SNIPPET_LENGTH }
      });
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

    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().then(() => {
          console.log('AudioContext resumed');
        });
      }
    }

    let playPosition = currentPosition;
    if (currentPosition >= SNIPPET_LENGTH - 0.1) {
      playPosition = 0;
      setCurrentPosition(0);
    }

    const absoluteTime = (stemClipStartTime.current || 0) + playPosition;
    audio.currentTime = absoluteTime;
    audio.play().catch(err => console.error('Error playing audio:', err));
    setStemPlayingStates((prev) => ({ ...prev, [index]: true }));

    if (stemSnippetTimers.current[index]) {
      clearTimeout(stemSnippetTimers.current[index]);
    }
    
    const remainingTime = (SNIPPET_LENGTH - playPosition) * 1000;
    stemSnippetTimers.current[index] = setTimeout(() => {
      audio.pause();
      setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
      delete stemSnippetTimers.current[index];
      setCurrentPosition(SNIPPET_LENGTH);
    }, remainingTime);
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
    const startTime = stemClipStartTime.current || 0;
    audio.currentTime = startTime;
    
    const wavesurfer = wavesurferRefs.current[index];
    if (wavesurfer) {
      const duration = wavesurfer.getDuration();
      if (duration > 0) {
        const progress = startTime / duration;
        wavesurfer.seekTo(progress);
      }
    }
    
    setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
    setCurrentPosition(0);
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
    const startTime = stemClipStartTime.current || 0;
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.pause();
        audio.currentTime = startTime;
        
        const wavesurfer = wavesurferRefs.current[index];
        if (wavesurfer) {
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const progress = startTime / duration;
            wavesurfer.seekTo(progress);
          }
        }
        
        setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
        if (stemSnippetTimers.current[index]) {
          clearTimeout(stemSnippetTimers.current[index]);
          delete stemSnippetTimers.current[index];
        }
      }
    });
    setPlayingAllStems(false);
    setCurrentPosition(0);
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

  const handleSliderChange = (e) => {
    const newPosition = parseFloat(e.target.value);
    setCurrentPosition(newPosition);
    
    const absoluteTime = (stemClipStartTime.current || 0) + newPosition;
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio) {
        audio.currentTime = absoluteTime;
        
        const wavesurfer = wavesurferRefs.current[index];
        if (wavesurfer) {
          const duration = wavesurfer.getDuration();
          if (duration > 0) {
            const progress = absoluteTime / duration;
            wavesurfer.seekTo(progress);
          }
        }
      }
    });
    
    stemAudioRefs.current.forEach((audio, index) => {
      if (audio && !audio.paused && stemSnippetTimers.current[index]) {
        clearTimeout(stemSnippetTimers.current[index]);
        const remainingTime = (SNIPPET_LENGTH - newPosition) * 1000;
        if (remainingTime > 0) {
          stemSnippetTimers.current[index] = setTimeout(() => {
            audio.pause();
            setStemPlayingStates((prev) => ({ ...prev, [index]: false }));
            delete stemSnippetTimers.current[index];
            setCurrentPosition(SNIPPET_LENGTH);
          }, remainingTime);
        }
      }
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (index, value) => {
    setStemVolumes((prev) => ({ ...prev, [index]: parseInt(value) }));
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
            crossOrigin="anonymous"
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
              crossOrigin="anonymous"
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
          
          <div className="playback-slider-container">
            <span className="time-label">{formatTime(currentPosition)}</span>
            <input
              type="range"
              min="0"
              max={SNIPPET_LENGTH}
              step="0.1"
              value={currentPosition}
              onChange={handleSliderChange}
              className="playback-slider"
            />
            <span className="time-label">{formatTime(SNIPPET_LENGTH)}</span>
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
                  <div className="track-header">
                    <span className="track-name">{track.label}</span>
                    <div className="volume-control">
                      <span className="volume-icon">🔊</span>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={stemVolumes[index] !== undefined ? stemVolumes[index] : 100}
                        onChange={(e) => handleVolumeChange(index, e.target.value)}
                        className="volume-slider"
                      />
                      <span className="volume-value">{stemVolumes[index] !== undefined ? stemVolumes[index] : 100}%</span>
                    </div>
                  </div>
                  <div 
                    ref={(el) => {
                      waveformContainerRefs.current[index] = el;
                    }}
                    className="waveform-container"
                  />
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
                    ref={(el) => {
                      stemAudioRefs.current[index] = el;
                    }}
                    src={track.url}
                    crossOrigin="anonymous"
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
