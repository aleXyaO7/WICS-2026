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
        <h1 className="home-title">wavelength.</h1>
        <p className="home-subtitle">train your brain to hear musical composition</p>
        
        <div className="home-buttons-row">
          <Link to="/player" className="home-button player-button">
            <span className="button-text">
              <div className="button-title">Play</div>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
