import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <img 
        src="/record-player.gif" 
        alt="Record Player" 
        className="background-gif"
      />
      
      <div className="overlay"></div>
      
      <img 
        src="/sheet-music.gif" 
        alt="Sheet Music" 
        className="sheet-music-gif"
      />
      
      <div className="home-content">
        <h1 className="home-title">Music Player App</h1>
        <p className="home-subtitle">Welcome to your music experience</p>
        
        <div className="home-buttons-row">
          <Link to="/player" className="home-button player-button">
            <span className="button-text">
              <div className="button-title">Music Player</div>
              <div className="button-desc">Listen to tracks</div>
            </span>
          </Link>

          <Link to="/login" className="home-button login-button">
            <span className="button-text">
              <div className="button-title">Login</div>
              <div className="button-desc">Access your account</div>
            </span>
          </Link>

          <Link to="/signup" className="home-button signup-button">
            <span className="button-text">
              <div className="button-title">Sign Up</div>
              <div className="button-desc">Create new account</div>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
