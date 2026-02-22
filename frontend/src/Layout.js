import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
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
  const userMenuOpen = Boolean(anchorEl);

  const hideUserMenu = location.pathname === '/login' || location.pathname === '/signup';

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

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', width: '100%', position: 'relative' }}>
        {!user && !hideUserMenu && (
          <Box
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '8px 16px',
              borderRadius: '24px',
            }}
          >
            <Typography
              component={Link}
              to="/login"
              variant="body2"
              sx={{
                color: 'white',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Login
            </Typography>
            <Typography
              component={Link}
              to="/signup"
              variant="body2"
              sx={{
                color: 'white',
                fontWeight: 600,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Sign Up
            </Typography>
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
      </Box>
    </ThemeProvider>
  );
}

export default Layout;
