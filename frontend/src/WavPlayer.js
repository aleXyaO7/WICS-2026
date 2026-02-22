import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import WaveSurfer from 'wavesurfer.js';
import { Box, Slider, IconButton, Dialog, DialogTitle, DialogContent, CircularProgress, TextField, MenuItem, FormControl, InputLabel, Select } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import { useAuth } from './AuthContext';
import './WavPlayer.css';
import './App.css';

const SNIPPET_LENGTH = 15;

const POINTS_PER_NON_VOCAL_STEM = 10; // Points deducted for each non-vocal stem unmuted
const POINTS_FOR_VOCALS = 50; // Points deducted if vocals are unmuted

const theme = createTheme({
  palette: {
    primary: {
      main: '#6750A4',
    },
  },
});

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
  const { user } = useAuth();
  
  // Music player state
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [randomSong, setRandomSong] = useState(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [playingStem, setPlayingStem] = useState(null);
  const musicAudioRef = useRef(null);
  const stemAudioRef = useRef(null);

  // Song guessing state
  const [guessedSongId, setGuessedSongId] = useState('');

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
  const [volumeControlsVisible, setVolumeControlsVisible] = useState({});
  const [stemsUnmuted, setStemsUnmuted] = useState({});
  
  // Results modal state
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [similarityData, setSimilarityData] = useState(null);
  const [resultsError, setResultsError] = useState(null);
  
  // ELO tracking state
  const [currentElo, setCurrentElo] = useState(1200);
  const [calculatedNewElo, setCalculatedNewElo] = useState(null);
  const [eloChange, setEloChange] = useState(null);
  
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
    
    // Initialize ELO from user data
    if (user && user.elo_rating) {
      setCurrentElo(user.elo_rating);
    }
    
    fetchSongs();
    fetchRandomSong(false);
  }, [user]);

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
      initialVolumes[index] = 0; // Start muted
    });
    setStemVolumes(initialVolumes);
    setStemsUnmuted({}); // Reset unmuted tracking
    setVolumeControlsVisible({}); // Hide volume sliders when song changes
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
            // Set initial gain based on current volume state (starts at 0)
            gainNode.gain.value = (stemVolumes[index] !== undefined ? stemVolumes[index] : 0) / 100;
            
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
              waveColor: '#ffffff',
              progressColor: '#6b7280',
              cursorColor: '#6b7280',
              backgroundColor: '#000000',
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
      const sorted = [...response.data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      );
      setSongs(sorted);
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
    setVolumeControlsVisible({});
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

  const handleSliderChange = (event, newValue) => {
    const newPosition = newValue;
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

  const handleVolumeChange = (index) => (event, newValue) => {
    setStemVolumes((prev) => ({ ...prev, [index]: newValue }));
    
    // Track if this stem has been unmuted (volume > 0)
    if (newValue > 0 && stemTracks[index]) {
      const stemLabel = stemTracks[index].label;
      setStemsUnmuted((prev) => ({ ...prev, [stemLabel]: true }));
    }
  };

  const toggleVolumeControl = (index) => {
    setVolumeControlsVisible((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSubmitGuess = async () => {
    if (!guessedSongId) {
      alert('Please select a song guess');
      return;
    }
    
    if (!randomSong || !randomSong.id) {
      alert('No song is currently loaded');
      return;
    }

    // Open modal and start loading
    setResultsModalOpen(true);
    setLoadingResults(true);
    setResultsError(null);
    
    try {
      const response = await axios.post(`${API_URL}/guess`, {
        actual_song_id: randomSong.id,
        guessed_song_id: guessedSongId,
        clip_start_time: randomSong.clip_start_time || 0
      });
      setSimilarityData(response.data);
      
      // Calculate ELO change once when results arrive
      const baseScore = response.data.similarity_score;
      const nonVocalStems = Object.keys(stemsUnmuted).filter(stem => stem !== 'Vocals').length;
      const vocalsUnmuted = stemsUnmuted['Vocals'] ? 1 : 0;
      const finalPoints = baseScore - (nonVocalStems * POINTS_PER_NON_VOCAL_STEM) - (vocalsUnmuted * POINTS_FOR_VOCALS);
      const newElo = currentElo + finalPoints;
      
      setCalculatedNewElo(newElo);
      setEloChange(finalPoints);
    } catch (err) {
      console.error('Error fetching similarity data:', err);
      setResultsError('Failed to fetch similarity data');
    } finally {
      setLoadingResults(false);
    }
  };

  const handleCloseModal = async () => {
    // Update ELO using the pre-calculated value
    if (calculatedNewElo !== null && user) {
      // Update local state
      setCurrentElo(calculatedNewElo);
      
      // Update ELO on backend
      try {
        await axios.patch(`${API_URL}/users/${user.id}/elo`, {
          elo_rating: calculatedNewElo
        });
        
        // Update user in localStorage to persist the new ELO
        const updatedUser = { ...user, elo_rating: calculatedNewElo };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        console.log('ELO updated successfully:', calculatedNewElo);
      } catch (error) {
        console.error('Error updating ELO:', error);
      }
    }
    
    setResultsModalOpen(false);
    setSimilarityData(null);
    setResultsError(null);
    setGuessedSongId('');
    setCalculatedNewElo(null);
    setEloChange(null);
    fetchRandomSong(true);
  };

  const getKeyName = (key) => {
    const keyNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
    return keyNames[key] || 'Unknown';
  };

  const singleStemEntries = randomSong
    ? Object.entries(STEM_LABELS)
        .map(([key, label]) => [key, label, getStemUrl(randomSong, key)])
        .filter(([, , url]) => url)
    : [];

  return (
    <ThemeProvider theme={theme}>
      <div className="wav-player">
        <div className="wav-container">
        <div className="single-column-layout">
          <div className="tracks-section">
            {stemTracks.length === 0 ? (
              <p className="empty">Loading instrumental stems...</p>
            ) : (
              <div className="tracks-table">
                {stemTracks.map((track, index) => (
                  <div key={track.key} className="track-row">
                    <div className="track-controls">
                      <span className="track-name">{track.label}</span>
                      <IconButton
                        onClick={() => toggleVolumeControl(index)}
                        size="small"
                        sx={{
                          color: 'white',
                          marginLeft: '8px',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          },
                        }}
                        aria-label={`Toggle ${track.label} volume control`}
                      >
                        {stemVolumes[index] === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
                      </IconButton>
                      {volumeControlsVisible[index] && (
                        <>
                          <Slider
                            orientation="horizontal"
                            value={stemVolumes[index] !== undefined ? stemVolumes[index] : 0}
                            onChange={handleVolumeChange(index)}
                            min={0}
                            max={200}
                            step={1}
                            aria-label={`${track.label} volume`}
                            sx={{
                              width: 80,
                              marginLeft: '8px',
                              marginRight: '6px',
                              color: 'white',
                              '& .MuiSlider-thumb': {
                                width: 14,
                                height: 14,
                                backgroundColor: 'white',
                              },
                              '& .MuiSlider-track': { height: 3 },
                              '& .MuiSlider-rail': { height: 3, opacity: 0.5 },
                            }}
                          />
                          <span className="volume-value">{stemVolumes[index] !== undefined ? stemVolumes[index] : 0}%</span>
                        </>
                      )}
                    </div>
                    <div className="track-waveform">
                      <div 
                        ref={(el) => {
                          waveformContainerRefs.current[index] = el;
                        }}
                        className="waveform-container"
                      />
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

          <div className="master-controls">
            <div className="playback-slider-container">
              <span className="time-label">{formatTime(currentPosition)}</span>
              <Slider
                value={currentPosition}
                onChange={handleSliderChange}
                min={0}
                max={SNIPPET_LENGTH}
                step={0.1}
                aria-label="Playback position"
                sx={{
                  flex: 1,
                  mx: 2,
                  color: '#ffffff',
                  '& .MuiSlider-thumb': {
                    width: 16,
                    height: 16,
                    backgroundColor: 'white',
                  },
                  '& .MuiSlider-track': {
                    height: 4,
                    backgroundColor: '#6b7280',
                  },
                  '& .MuiSlider-rail': {
                    height: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  },
                }}
              />
              <span className="time-label">{formatTime(SNIPPET_LENGTH)}</span>
            </div>
            
            <div className="master-buttons">
              <button className="master-btn play-all" onClick={playAllStems}>
                <PlayArrowIcon />
              </button>
              <button className="master-btn pause-all" onClick={pauseAllStems}>
                <PauseIcon />
              </button>
              <button className="master-btn stop-all" onClick={stopAllStems}>
                <ReplayIcon />
              </button>
            </div>
          </div>

          <div className="guess-section">
            <div className="guess-controls">
              <FormControl variant="outlined" disabled={!randomSong} sx={{ flex: 1, minWidth: 0, maxWidth: 400 }}>
                <InputLabel id="song-select-label" sx={{ color: 'white', '&.Mui-focused': { color: 'white' }, '&.MuiInputLabel-shrink': { color: 'white' } }}>Select a song</InputLabel>
                <Select
                  labelId="song-select-label"
                  value={guessedSongId}
                  onChange={(e) => setGuessedSongId(e.target.value)}
                  label="Select a song"
                  sx={{
                    color: 'white',
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.7)',
                    },
                    '& .MuiSvgIcon-root': { color: 'white' },
                    '& .MuiSelect-select': { color: 'white' },
                    '& .MuiInputBase-input': { color: 'white' },
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: '#1a1a1a',
                        color: 'white',
                        '& .MuiMenuItem-root': { color: 'white' },
                        '& .MuiMenuItem-root.Mui-selected': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                        '& .MuiMenuItem-root.Mui-selected:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
                      },
                    },
                  }}
                >
                  <MenuItem value="">
                    <em>Select a song...</em>
                  </MenuItem>
                  {songs.map((song) => (
                    <MenuItem key={song.id} value={song.id}>
                      {song.artists ? `${song.name} - ${song.artists}` : song.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <button 
                className="submit-guess-btn"
                onClick={handleSubmitGuess}
                disabled={!guessedSongId || !randomSong}
              >
                Submit Guess
              </button>
            </div>
          </div>
        </div>

        <Dialog
          open={resultsModalOpen}
          onClose={handleCloseModal}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              padding: 2,
              backgroundColor: 'black',
              color: 'white',
              '& .MuiDialogContent-root': {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              },
            },
          }}
        >
          {loadingResults ? (
            <DialogContent sx={{ textAlign: 'center', py: 6, color: 'white' }}>
              <CircularProgress size={60} sx={{ mb: 3, color: 'white' }} />
              <DialogTitle sx={{ p: 0, color: 'white' }}>Calculating Similarity...</DialogTitle>
              <p style={{ color: 'rgba(255,255,255,0.9)', marginTop: '10px' }}>Please wait while we compare the songs...</p>
            </DialogContent>
          ) : resultsError ? (
            <DialogContent sx={{ textAlign: 'center', py: 4, color: 'white' }}>
              <DialogTitle sx={{ p: 0, color: '#f87171' }}>Error</DialogTitle>
              <p style={{ color: 'rgba(255,255,255,0.9)', marginTop: '10px' }}>{resultsError}</p>
              <button onClick={handleCloseModal} className="submit-guess-btn" style={{ marginTop: '20px' }}>
                Close
              </button>
            </DialogContent>
          ) : similarityData ? (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', px: 2, pt: 1, pb: 0 }}>
                <Box component="span" sx={{ fontSize: '1.8rem', fontWeight: 600, color: 'white', fontFamily: '"IM Fell French Canon", serif' }}>
                  wavelength.
                </Box>
                <button type="button" onClick={handleCloseModal} className="results-play-again-btn">
                  Play again
                </button>
              </Box>
              <DialogContent className="wavplayer-results-content">
                <div className="results-section">
                  <div className="song-comparison">
                    <div className="comparison-item">
                      <h3>Actual Song</h3>
                      <p className="song-title">{similarityData.actual_song.name}</p>
                      {similarityData.actual_song.artists && (
                        <p className="song-artists">{similarityData.actual_song.artists}</p>
                      )}
                    </div>
                    
                    <div className="comparison-arrow">→</div>
                    
                    <div className="comparison-item">
                      <h3>Your Guess</h3>
                      <p className="song-title">{similarityData.guessed_song.name}</p>
                      {similarityData.guessed_song.artists && (
                        <p className="song-artists">{similarityData.guessed_song.artists}</p>
                      )}
                    </div>
                  </div>

                  {(() => {
                    // Use pre-calculated values to avoid double-calculation
                    const finalPoints = eloChange || 0;
                    const newElo = calculatedNewElo || currentElo;
                    
                    let eloColor;
                    let eloDisplay;
                    
                    if (finalPoints > 0) {
                      eloColor = '#22c55e';
                      eloDisplay = `+${finalPoints}`;
                    } else if (finalPoints < 0) {
                      eloColor = '#ef4444';
                      eloDisplay = finalPoints;
                    } else {
                      eloColor = '#9ca3af';
                      eloDisplay = '0';
                    }
                    
                    return (
                      <div style={{ 
                        display: 'flex', 
                        gap: '20px', 
                        marginBottom: '30px',
                        marginTop: '20px'
                      }}>
                        <div style={{ 
                          flex: 1,
                          background: 'white',
                          borderRadius: '15px',
                          padding: '30px',
                          color: 'black',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: '"Courier Prime", monospace'
                        }}>
                          <h2 style={{ margin: '0 0 15px 0', fontSize: '1.3rem', fontWeight: 600, color: 'black', fontFamily: '"Courier Prime", monospace' }}>Similarity Score</h2>
                          <div style={{ fontSize: '3.5rem', fontWeight: 'bold', margin: '10px 0', color: 'black', fontFamily: '"Courier Prime", monospace' }}>
                            {similarityData.similarity_score}%
                          </div>
                          <p style={{ margin: '10px 0 0 0', fontSize: '1rem', color: '#333', textAlign: 'center', fontFamily: '"Courier Prime", monospace' }}>
                            {similarityData.message}
                          </p>
                        </div>
                        
                        <div style={{ 
                          flex: 1,
                          background: 'white',
                          borderRadius: '15px',
                          padding: '30px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-around',
                          color: 'black',
                          fontFamily: '"Courier Prime", monospace'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '15px 0',
                            borderBottom: '2px solid #e9ecef'
                          }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#495057', fontFamily: '"Courier Prime", monospace' }}>Stems Used</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#333', fontFamily: '"Courier Prime", monospace' }}>
                              {Object.keys(stemsUnmuted).length} / {stemTracks.length}
                            </span>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '15px 0',
                            borderBottom: '2px solid #e9ecef'
                          }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#495057', fontFamily: '"Courier Prime", monospace' }}>ELO Gained</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: eloColor, fontFamily: '"Courier Prime", monospace' }}>
                              {eloDisplay}
                            </span>
                          </div>
                          
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '15px 0'
                          }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#495057', fontFamily: '"Courier Prime", monospace' }}>New Overall ELO</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#333', fontFamily: '"Courier Prime", monospace' }}>
                              {newElo}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {similarityData.actual_song_metadata && similarityData.guessed_song_metadata && (
                    <div className="metadata-comparison">
                      <h3>Audio Characteristics Comparison</h3>
                      
                      <div className="metadata-grid metadata-grid-4col">
                        <div className="metadata-header"></div>
                        <div className="metadata-header actual-header">Actual Song</div>
                        <div className="metadata-header guessed-header">Your Guess</div>
                        <div className="metadata-header match-header">Match %</div>
                        
                        <div className="metadata-row-label">Key</div>
                        <div className="metadata-value metadata-actual">
                          {getKeyName(similarityData.actual_song_metadata.key)} {similarityData.actual_song_metadata.mode === 1 ? 'Major' : 'Minor'}
                        </div>
                        <div className="metadata-value metadata-guessed">
                          {getKeyName(similarityData.guessed_song_metadata.key)} {similarityData.guessed_song_metadata.mode === 1 ? 'Major' : 'Minor'}
                        </div>
                        <div className="metadata-value metadata-match">{similarityData.breakdown?.['Key Match'] || 0}%</div>
                        
                        <div className="metadata-row-label">Tempo (BPM)</div>
                        <div className="metadata-value metadata-actual">{similarityData.actual_song_metadata.tempo}</div>
                        <div className="metadata-value metadata-guessed">{similarityData.guessed_song_metadata.tempo}</div>
                        <div className="metadata-value metadata-match">{similarityData.breakdown?.['Tempo Match'] || 0}%</div>
                        
                        <div className="metadata-row-label">Energy</div>
                        <div className="metadata-value metadata-actual">{(similarityData.actual_song_metadata.energy * 100).toFixed(0)}%</div>
                        <div className="metadata-value metadata-guessed">{(similarityData.guessed_song_metadata.energy * 100).toFixed(0)}%</div>
                        <div className="metadata-value metadata-match">{similarityData.breakdown?.['Energy Match'] || 0}%</div>
                        
                        <div className="metadata-row-label">Valence (Mood)</div>
                        <div className="metadata-value metadata-actual">{(similarityData.actual_song_metadata.valence * 100).toFixed(0)}%</div>
                        <div className="metadata-value metadata-guessed">{(similarityData.guessed_song_metadata.valence * 100).toFixed(0)}%</div>
                        <div className="metadata-value metadata-match">{similarityData.breakdown?.['Mood Match'] || 0}%</div>
                        
                        <div className="metadata-row-label">Loudness (dB)</div>
                        <div className="metadata-value metadata-actual">{similarityData.actual_song_metadata.loudness}</div>
                        <div className="metadata-value metadata-guessed">{similarityData.guessed_song_metadata.loudness}</div>
                        <div className="metadata-value metadata-match">{similarityData.breakdown?.['Loudness Match'] || 0}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </>
          ) : null}
        </Dialog>
      </div>
    </div>
    </ThemeProvider>
  );
}

export default WavPlayer;
