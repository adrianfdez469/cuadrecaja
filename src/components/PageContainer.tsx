import React, { ReactNode } from 'react';
import { 
  Box, 
  Typography, 
  Breadcrumbs, 
  Link, 
  Container,
  Fade,
  Stack,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { useRouter } from 'next/navigation';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface PageContainerProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  headerActions?: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  children: ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  subtitle,
  breadcrumbs,
  headerActions,
  maxWidth = 'xl',
  children
}) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleBreadcrumbClick = (href: string) => {
    router.push(href);
  };

  return (
    <Container 
      maxWidth={maxWidth} 
      sx={{ 
        py: isMobile ? 1.5 : 3,
        px: isMobile ? 1 : 3
      }}
    >
      <Fade in timeout={300}>
        <Box>
          {/* Header */}
          <Box sx={{ mb: isMobile ? 2 : 4 }}>
            {breadcrumbs && breadcrumbs.length > 0 && (
              <Breadcrumbs 
                separator={<NavigateNextIcon fontSize="small" />}
                sx={{ 
                  mb: isMobile ? 0.75 : 2,
                  py: isMobile ? 0.25 : 0.5,
                  '& .MuiBreadcrumbs-li': {
                    fontSize: isMobile ? '0.8125rem' : '1rem'
                  }
                }}
              >
                {breadcrumbs.map((crumb, index) => (
                  crumb.href ? (
                    <Link
                      key={index}
                      color="inherit"
                      href={crumb.href}
                      onClick={(e) => {
                        e.preventDefault();
                        handleBreadcrumbClick(crumb.href!);
                      }}
                      sx={{ 
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                        cursor: 'pointer',
                        fontSize: isMobile ? '0.8125rem' : '1rem'
                      }}
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <Typography 
                      key={index} 
                      color="text.primary"
                      sx={{ fontSize: isMobile ? '0.8125rem' : '1rem' }}
                    >
                      {crumb.label}
                    </Typography>
                  )
                ))}
              </Breadcrumbs>
            )}
            
            <Stack 
              direction="row"
              justifyContent="space-between" 
              alignItems="flex-start"
              spacing={1}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography 
                  variant={isMobile ? "h6" : "h4"} 
                  component="h1" 
                  gutterBottom={!isMobile}
                  sx={{
                    fontSize: isMobile ? '1.25rem' : '2.125rem',
                    fontWeight: 600,
                    lineHeight: isMobile ? 1.3 : 1.2,
                    mb: isMobile ? (subtitle ? 0.5 : 0) : undefined
                  }}
                >
                  {title}
                </Typography>
                {subtitle && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{
                      fontSize: isMobile ? '0.8125rem' : '1rem',
                      lineHeight: 1.4,
                      mb: isMobile ? 1 : 0
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </Box>
              
              {headerActions && (
                <Box 
                  sx={{ 
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'flex-start'
                  }}
                >
                  {headerActions}
                </Box>
              )}
            </Stack>
          </Box>

          {/* Content */}
          <Box>
            {children}
          </Box>
        </Box>
      </Fade>
    </Container>
  );
}; 