import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

function Results() {
  const location = useLocation();
  const API_URL = 'http://localhost:5001/api';
  
  const [loading, setLoading] = useState(true);
  const [similarityData, setSimilarityData] = useState(null);
  const [error, setError] = useState(null);
  
  const { actualSongId, guessedSongId } = location.state || {};

  useEffect(() => {
    if (!actualSongId || !guessedSongId) {
      setError('Missing song information');
      setLoading(false);
      return;
    }

    fetchSimilarityData();
  }, [actualSongId, guessedSongId]);

  const fetchSimilarityData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/guess`, {
        actual_song_id: actualSongId,
        guessed_song_id: guessedSongId
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

            <div className="similarity-breakdown">
              <h3>Detailed Breakdown</h3>
              <div className="breakdown-list">
                {Object.entries(similarityData.breakdown || {}).map(([key, value]) => (
                  <div key={key} className="breakdown-item">
                    <span className="breakdown-label">{key}:</span>
                    <span className="breakdown-value">{value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Results;
