import React, { ReactNode } from 'react';
import {
  Box,
  BoxProps,
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
  /**
   * Sits on the title's baseline, to its right: a state the page is in rather
   * than something to do. The supplier's «activo» and the business's base
   * currency both live here in the redesign.
   */
  titleAdornment?: ReactNode;
  headerActions?: ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  /** Props forwarded to the content wrapper Box */
  contentProps?: BoxProps;
  children: ReactNode;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  subtitle,
  breadcrumbs,
  titleAdornment,
  headerActions,
  maxWidth = 'xl',
  contentProps,
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

            {/* One row in both sizes. Stacking the actions under the title on a
                phone pushed them to full width, so a lone refresh icon became a
                banner. Callers whose primary action really is full-width put it
                in `children`, where the design puts it. */}
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              spacing={isMobile ? 1.5 : 1}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ flexWrap: 'wrap' }}
                >
                <Typography
                  variant={isMobile ? "h5" : "h4"}
                  component="h1"
                  gutterBottom={!isMobile}
                  sx={{
                    // The redesign's page-title steps: 34px desktop, 26px phone.
                    fontSize: isMobile ? '1.625rem' : '2.125rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    letterSpacing: isMobile ? '-0.02em' : '-0.025em',
                    mb: subtitle ? 0.5 : (isMobile ? 1 : undefined)
                  }}
                >
                  {title}
                </Typography>
                {titleAdornment}
                </Stack>
                {subtitle && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: '0.9375rem', lineHeight: 1.45 }}
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
                    alignItems: 'flex-start',
                    width: 'auto'
                  }}
                >
                  {headerActions}
                </Box>
              )}
            </Stack>
          </Box>

          {/* Content */}
          <Box {...contentProps}>
            {children}
          </Box>
        </Box>
      </Fade>
    </Container>
  );
}; 