import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

function Results() {
  const location = useLocation();
  const API_URL = 'http://localhost:5001/api';
  
  const [loading, setLoading] = useState(true);
  const [similarityData, setSimilarityData] = useState(null);
  const [error, setError] = useState(null);
  const { actualSongId, guessedSongId, clipStartTime } = location.state || {};

  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (initialFetchDone.current) return;
    
    if (!actualSongId || !guessedSongId) {
      setError('Missing song information');
      setLoading(false);
      return;
    }

    initialFetchDone.current = true;
    fetchSimilarityData();
  }, [actualSongId, guessedSongId]);

  const fetchSimilarityData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/guess`, {
        actual_song_id: actualSongId,
        guessed_song_id: guessedSongId,
        clip_start_time: clipStartTime || 0
      });
      setSimilarityData(response.data);
    } catch (err) {
      console.error('Error fetching similarity data:', err);
      setError('Failed to fetch similarity data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="wav-player">
        <div className="wav-container">
          <Link to="/player" className="back-button">Back to Player</Link>
          <h1>Calculating Similarity...</h1>
          <p className="empty">Please wait while we compare the songs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wav-player">
        <div className="wav-container">
          <Link to="/player" className="back-button">Back to Player</Link>
          <h1>Error</h1>
          <p className="empty">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wav-player">
      <div className="wav-container">
        <Link to="/player" className="back-button">Back to Player</Link>
        <h1>Song Similarity Results</h1>
        
        {similarityData && (
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

            <div className="similarity-score">
              <h2>Similarity Score</h2>
              <div className="score-value">{similarityData.similarity_score}%</div>
              <p className="score-description">{similarityData.message}</p>
            </div>

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
        )}
      </div>
    </div>
  );
}

// Helper function to convert key number to key name
function getKeyName(key) {
  const keyNames = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  return keyNames[key] || 'Unknown';
}

export default Results;
