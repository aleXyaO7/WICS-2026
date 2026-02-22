import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Box, IconButton, Menu, MenuItem, Typography, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import InfoIcon from '@mui/icons-material/Info';
import { useAuth } from './AuthContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#6750A4',
    },
  },
});

function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const userMenuOpen = Boolean(anchorEl);

  const hideUserMenu = location.pathname === '/login' || location.pathname === '/signup';
  const showHomeButton = location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/signup';

  const handleUserMenuClick = (event) => {
    if (anchorEl) {
      setAnchorEl(null);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenRules = () => {
    setRulesModalOpen(true);
  };

  const handleCloseRules = () => {
    setRulesModalOpen(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', width: '100%', position: 'relative' }}>
        {showHomeButton && (
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 1000,
              display: 'flex',
              gap: 1,
            }}
          >
            <Link
              to="/"
              style={{
                padding: '10px 20px',
                background: '#f8f9fa',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e9ecef';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8f9fa';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <HomeIcon />
            </Link>
            <IconButton
              onClick={handleOpenRules}
              sx={{
                background: '#f8f9fa',
                color: '#333',
                borderRadius: '8px',
                transition: 'background 0.2s, transform 0.2s',
                '&:hover': {
                  background: '#e9ecef',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <InfoIcon />
            </IconButton>
          </Box>
        )}
        {user && !hideUserMenu && (
          <Box
            onClick={handleUserMenuClick}
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: '8px 16px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              '&:hover': {
                transform: 'translateY(-1px)',
              },
            }}
          >
            <Typography variant="body2" sx={{ color: 'white' }}>
              Welcome, <strong style={{ color: 'white' }}>{user.username}</strong>
            </Typography>
            <IconButton
              size="small"
              sx={{
                color: 'white',
                pointerEvents: 'none',
              }}
              aria-label="User menu"
            >
              <AccountCircleIcon fontSize="medium" />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={userMenuOpen}
              onClose={handleUserMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 180,
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                },
              }}
            >
              <MenuItem disabled sx={{ opacity: 1, '&.Mui-disabled': { opacity: 1 } }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Signed in as
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {user.username}
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', fontWeight: 500 }}>
                Sign Out
              </MenuItem>
            </Menu>
          </Box>
        )}
        {children}
        
        <Dialog
          open={rulesModalOpen}
          onClose={handleCloseRules}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              padding: 2,
            },
          }}
        >
          <DialogTitle sx={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 600, color: '#6750A4' }}>
            How to Play
          </DialogTitle>
          <DialogContent>
            <Box sx={{ color: '#333', '& h3': { color: '#6750A4', marginTop: 2, marginBottom: 1 }, '& p': { marginBottom: 1.5, lineHeight: 1.6 } }}>
              <h3>Objective</h3>
              <p>
                Listen to a 15-second audio snippet and guess which song it is from a list of options. 
                The fewer instrumental stems you use to identify the song, the more points you earn!
              </p>
              
              <h3>How It Works</h3>
              <p>
                <strong>Stems:</strong> The audio is split into 6 instrumental tracks (stems):
              </p>
              <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                <li>Drums</li>
                <li>Bass</li>
                <li>Piano</li>
                <li>Guitar</li>
                <li>Vocals</li>
                <li>Other instruments</li>
              </ul>
              <p>
                Each stem starts <strong>muted</strong>. Click the volume icon next to a stem to adjust the volume (0-200%).
              </p>
              
              <h3>Controls</h3>
              <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                <li><strong>Play:</strong> Play all unmuted stems</li>
                <li><strong>Pause:</strong> Pause playback</li>
                <li><strong>Restart:</strong> Resets the snippet</li>
                <li><strong>Slider:</strong> Scroll through the snippet</li>
              </ul>
              
              <h3>Scoring System</h3>
              <p>
                Your base score is the <strong>similarity percentage</strong> between your guess and the actual song (based on tempo, key, energy, mood, and loudness).
              </p>
              <p>
                <strong>Point Deductions:</strong>
              </p>
              <ul style={{ marginLeft: '20px', marginBottom: '15px' }}>
                <li><strong>-10 points</strong> for each non-vocal stem you listen to (Drums, Bass, Piano, Guitar, Other)</li>
                <li><strong>-50 points</strong> if you use the Vocals stem</li>
              </ul>
              <p>
                <strong>Example:</strong> If your similarity score is 85% and you listened to Drums and Bass, your final score is:
                <br />
                85 - (2 × 10) = <strong>65 points</strong>
              </p>
              
              <Box sx={{ textAlign: 'center', marginTop: 3 }}>
                <IconButton
                  onClick={handleCloseRules}
                  sx={{
                    background: '#6750A4',
                    color: 'white',
                    padding: '10px 30px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    '&:hover': {
                      background: '#7c6bb5',
                    },
                  }}
                >
                  Got it!
                </IconButton>
              </Box>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default Layout;
