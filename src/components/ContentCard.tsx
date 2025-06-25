import React, { ReactNode } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader,
  Box,
  Typography,
  Stack,
  useMediaQuery,
  useTheme
} from '@mui/material';

interface ContentCardProps {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
  fullHeight?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  subtitle,
  headerActions,
  children,
  noPadding = false,
  fullHeight = false
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Card 
      sx={{ 
        height: fullHeight ? '100%' : 'auto',
        display: fullHeight ? 'flex' : 'block',
        flexDirection: fullHeight ? 'column' : 'row'
      }}
    >
      {(title || headerActions) && (
        <CardHeader
          title={
            <Stack 
              direction={isMobile ? "column" : "row"}
              justifyContent="space-between"
              alignItems={isMobile ? "flex-start" : "center"}
              spacing={isMobile ? 1 : 2}
              sx={{ width: '100%' }}
            >
              {(title || subtitle) && (
                <Box sx={{ flex: isMobile ? 'none' : 1, minWidth: 0 }}>
                  {title && (
                    <Typography 
                      variant={isMobile ? "subtitle1" : "h6"} 
                      component="h2"
                      sx={{
                        fontSize: isMobile ? '1rem' : '1.25rem',
                        fontWeight: 600,
                        lineHeight: 1.3,
                        mb: subtitle && isMobile ? 0.25 : 0
                      }}
                    >
                      {title}
                    </Typography>
                  )}
                  {subtitle && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{
                        fontSize: isMobile ? '0.75rem' : '0.875rem',
                        lineHeight: 1.4
                      }}
                    >
                      {subtitle}
                    </Typography>
                  )}
                </Box>
              )}
              
              {headerActions && (
                <Box 
                  sx={{ 
                    flexShrink: 0,
                    width: isMobile ? '100%' : 'auto'
                  }}
                >
                  {headerActions}
                </Box>
              )}
            </Stack>
          }
          sx={{ 
            pb: isMobile ? 1 : 2,
            px: isMobile ? 1.5 : 3,
            pt: isMobile ? 1.5 : 3,
            '& .MuiCardHeader-content': {
              width: '100%'
            }
          }}
        />
      )}
      
      <CardContent 
        sx={{ 
          p: noPadding ? 0 : (isMobile ? 1.5 : 3),
          '&:last-child': { pb: noPadding ? 0 : (isMobile ? 1.5 : 3) },
          flex: fullHeight ? 1 : 'none',
          display: fullHeight ? 'flex' : 'block',
          flexDirection: fullHeight ? 'column' : 'row',
          pt: (title || headerActions) ? 0 : (isMobile ? 1.5 : 3)
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}; 